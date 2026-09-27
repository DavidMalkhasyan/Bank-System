import { randomUUID } from 'node:crypto';
import { query } from '../db/index.js';
import type { AccountCurrency, TransactionRecord } from '../types/account.js';

export const transactionRepository = {
  async create(payload: {
    userId: string;
    sourceAccountId: string | null;
    destinationAccountId: string | null;
    amount: string;
    currency: AccountCurrency;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
    status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
    metadata?: Record<string, unknown>;
  }) {
    const rows = await query<TransactionRecord>(
      `
        INSERT INTO transactions (id, user_id, source_account_id, destination_account_id, amount, currency, type, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        randomUUID(),
        payload.userId,
        payload.sourceAccountId,
        payload.destinationAccountId,
        payload.amount,
        payload.currency,
        payload.type,
        payload.status ?? 'COMPLETED',
        payload.metadata ? JSON.stringify(payload.metadata) : null,
      ],
    );

    return rows[0] ?? null;
  },

  async listForUser(userId: string, filter?: { accountId?: string; type?: string; page?: number; pageSize?: number }) {
    const page = filter?.page ?? 1;
    const pageSize = filter?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const params: unknown[] = [userId];
    let sql = `
      SELECT *
      FROM transactions
      WHERE user_id = $1
    `;

    if (filter?.accountId) {
      sql += ` AND (source_account_id = $${params.length + 1} OR destination_account_id = $${params.length + 1})`;
      params.push(filter.accountId);
    }

    if (filter?.type) {
      sql += ` AND type = $${params.length + 1}`;
      params.push(filter.type);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);

    return query<TransactionRecord>(sql, params);
  },

  async listAll(filter?: { type?: string; page?: number; pageSize?: number }) {
    const page = filter?.page ?? 1;
    const pageSize = filter?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const params: unknown[] = [];
    let sql = `SELECT * FROM transactions`;

    if (filter?.type) {
      sql += ` WHERE type = $1`;
      params.push(filter.type);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);

    return query<TransactionRecord>(sql, params);
  },
};
