import { randomUUID } from 'node:crypto';
import { query } from '../db/index.js';
import type { Account, AccountCurrency, AccountStatus } from '../types/account.js';

export const accountRepository = {
  async create(userId: string, currency: AccountCurrency) {
    const rows = await query<Account>(
      `
        INSERT INTO accounts (id, user_id, currency, balance, status)
        VALUES ($1, $2, $3, 0, 'ACTIVE')
        RETURNING *
      `,
      [randomUUID(), userId, currency],
    );

    return rows[0] ?? null;
  },

  async findById(id: string) {
    const rows = await query<Account>(`SELECT * FROM accounts WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async listByUser(userId: string) {
    return query<Account>(`SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
  },

  async listAll() {
    return query<Account>(`SELECT * FROM accounts ORDER BY created_at DESC`);
  },

  async updateBalance(id: string, balance: string) {
    const rows = await query<Account>(
      `
        UPDATE accounts
        SET balance = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, balance],
    );

    return rows[0] ?? null;
  },

  async setStatus(id: string, status: AccountStatus) {
    const rows = await query<Account>(
      `
        UPDATE accounts
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, status],
    );

    return rows[0] ?? null;
  },

  async lockById(id: string) {
    const rows = await query<Account>(`SELECT * FROM accounts WHERE id = $1 FOR UPDATE`, [id]);
    return rows[0] ?? null;
  },
};
