import { randomInt } from 'node:crypto';
import type pg from 'pg';

import { pool, query, type Db } from '../db/index.js';
import type { AccountRow, AccountStatus, AccountType, Currency } from '../types/domain.js';

export const toAccountDto = (account: AccountRow) => ({
  id: account.id,
  accountNumber: account.account_number,
  name: account.name,
  type: account.type,
  currency: account.currency,
  balance: account.balance,
  status: account.status,
  createdAt: account.created_at,
  updatedAt: account.updated_at,
  closedAt: account.closed_at,
});

export type AccountDto = ReturnType<typeof toAccountDto>;

/** 16 digits starting with 4000, like a card-style account number. */
const generateAccountNumber = () => `4000${String(randomInt(0, 1_000_000)).padStart(6, '0')}${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;

export const accountRepository = {
  async create(
    { userId, name, type, currency }: { userId: string; name: string; type: AccountType; currency: Currency },
    db: Db = pool,
  ) {
    // Retry on the (very unlikely) account number collision.
    for (let attempt = 0; ; attempt += 1) {
      try {
        const rows = await query<AccountRow>(
          `
            INSERT INTO accounts (user_id, account_number, name, type, currency, balance, status)
            VALUES ($1, $2, $3, $4, $5, 0, 'ACTIVE')
            RETURNING *
          `,
          [userId, generateAccountNumber(), name, type, currency],
          db,
        );
        return rows[0]!;
      } catch (error) {
        const isCollision = (error as { code?: string; constraint?: string }).code === '23505'
          && (error as { constraint?: string }).constraint === 'idx_accounts_account_number';
        if (!isCollision || attempt >= 3) throw error;
      }
    }
  },

  async findById(id: string, db: Db = pool) {
    const rows = await query<AccountRow>(`SELECT * FROM accounts WHERE id = $1`, [id], db);
    return rows[0] ?? null;
  },

  async findByNumber(accountNumber: string, db: Db = pool) {
    const rows = await query<AccountRow>(`SELECT * FROM accounts WHERE account_number = $1`, [accountNumber], db);
    return rows[0] ?? null;
  },

  async listByUser(userId: string) {
    return query<AccountRow>(
      `
        SELECT * FROM accounts
        WHERE user_id = $1
        ORDER BY (status = 'CLOSED'), created_at ASC
      `,
      [userId],
    );
  },

  /**
   * Locks the rows with SELECT ... FOR UPDATE in a fixed (id) order so two
   * opposite transfers cannot deadlock each other.
   */
  async lockForUpdate(client: pg.PoolClient, ids: string[]) {
    const rows = await query<AccountRow>(
      `SELECT * FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [[...new Set(ids)].sort()],
      client,
    );
    return new Map(rows.map((row) => [row.id, row]));
  },

  /** Adds `delta` (a NUMERIC string, may be negative) to the balance in SQL. */
  async applyDelta(client: pg.PoolClient, id: string, delta: string) {
    const rows = await query<AccountRow>(
      `
        UPDATE accounts
        SET balance = balance + $2::numeric, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, delta],
      client,
    );
    return rows[0]!;
  },

  async rename(id: string, name: string) {
    const rows = await query<AccountRow>(
      `UPDATE accounts SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, name],
    );
    return rows[0] ?? null;
  },

  async setStatus(id: string, status: AccountStatus, db: Db = pool) {
    const rows = await query<AccountRow>(
      `
        UPDATE accounts
        SET status = $2::varchar,
            closed_at = CASE WHEN $2::varchar = 'CLOSED' THEN NOW() ELSE closed_at END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, status],
      db,
    );
    return rows[0] ?? null;
  },

  async listAll({ page, pageSize, search, status }: { page: number; pageSize: number; search?: string; status?: AccountStatus }) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(a.account_number LIKE $${params.length} OR a.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM accounts a JOIN users u ON u.id = a.user_id ${where}`,
      params,
    );
    const rows = await query<AccountRow & { owner_email: string; owner_name: string }>(
      `
        SELECT a.*, u.email AS owner_email, u.full_name AS owner_name
        FROM accounts a
        JOIN users u ON u.id = a.user_id
        ${where}
        ORDER BY a.created_at DESC, a.id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, pageSize, (page - 1) * pageSize],
    );

    return {
      items: rows.map((row) => ({
        ...toAccountDto(row),
        owner: { id: row.user_id, email: row.owner_email, fullName: row.owner_name },
      })),
      page,
      pageSize,
      total: countRow?.total ?? 0,
    };
  },
};
