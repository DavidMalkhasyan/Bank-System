import { pool } from './index.js';

interface Migration {
  id: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    id: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER', 'ADMIN')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'AMD')),
        balance NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'FROZEN')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        source_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
        destination_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
        amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
        currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'AMD')),
        type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')),
        status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_source_account_id ON transactions(source_account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_destination_account_id ON transactions(destination_account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id UUID,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `,
  },
  {
    id: '002_account_numbers_profiles_and_tokens',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120) NOT NULL DEFAULT '';
      UPDATE users SET full_name = initcap(split_part(email, '@', 1)) WHERE full_name = '';

      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(16);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name VARCHAR(60) NOT NULL DEFAULT 'Account';
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'CHECKING';
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
      ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
      ALTER TABLE accounts ADD CONSTRAINT accounts_type_check CHECK (type IN ('CHECKING', 'SAVINGS'));

      UPDATE accounts
      SET account_number = '4000' || lpad((floor(random() * 1000000000000))::bigint::text, 12, '0')
      WHERE account_number IS NULL;
      ALTER TABLE accounts ALTER COLUMN account_number SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);

      ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_status_check;
      UPDATE accounts SET status = 'CLOSED', closed_at = COALESCE(closed_at, updated_at) WHERE status = 'INACTIVE';
      ALTER TABLE accounts ADD CONSTRAINT accounts_status_check CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED'));

      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description VARCHAR(140);
      UPDATE transactions SET description = metadata->>'description'
      WHERE description IS NULL AND metadata ? 'description';

      -- Refresh tokens are now stored as SHA-256 digests; older bcrypt rows can never match.
      DELETE FROM refresh_tokens;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
    `,
  },
];

const MIGRATION_LOCK_ID = 727_274;

/** Applies pending migrations in order. Safe to call on every startup. */
export async function runMigrations({ silent = false } = {}) {
  const client = await pool.connect();

  try {
    // Several app instances may start at once; only one applies migrations.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = new Set(
      (await client.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map((row) => row.id),
    );

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;

      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
        await client.query('COMMIT');
        if (!silent) console.log(`Applied migration ${migration.id}`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
