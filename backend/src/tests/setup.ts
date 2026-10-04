import { afterAll, beforeAll } from 'vitest';

// Must run before the app (and its env config) is imported.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:15432/banking_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? '';
process.env.SEED_DEMO_DATA = 'false';

beforeAll(async () => {
  const { runMigrations } = await import('../db/migrations.js');
  const { pool } = await import('../db/index.js');
  await runMigrations({ silent: true });
  await pool.query('TRUNCATE audit_logs, transactions, refresh_tokens, accounts, users CASCADE');
});

afterAll(async () => {
  const { pool } = await import('../db/index.js');
  await pool.end();
});
