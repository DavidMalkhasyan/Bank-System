import { pool, query, type Db } from '../db/index.js';
import type { Currency, Page, TransactionRow, TransactionStatus, TransactionType } from '../types/domain.js';
import { fromCents, toCents } from '../utils/money.js';

interface TransactionJoinRow extends TransactionRow {
  source_number: string | null;
  source_name: string | null;
  source_user_id: string | null;
  source_owner: string | null;
  dest_number: string | null;
  dest_name: string | null;
  dest_user_id: string | null;
  dest_owner: string | null;
}

const SELECT_WITH_PARTIES = `
  SELECT t.*,
    sa.account_number AS source_number, sa.name AS source_name, sa.user_id AS source_user_id, su.full_name AS source_owner,
    da.account_number AS dest_number, da.name AS dest_name, da.user_id AS dest_user_id, du.full_name AS dest_owner
  FROM transactions t
  LEFT JOIN accounts sa ON sa.id = t.source_account_id
  LEFT JOIN users su ON su.id = sa.user_id
  LEFT JOIN accounts da ON da.id = t.destination_account_id
  LEFT JOIN users du ON du.id = da.user_id
`;

export type Direction = 'CREDIT' | 'DEBIT' | 'INTERNAL';

const maskNumber = (accountNumber: string) => `•••• ${accountNumber.slice(-4)}`;

/**
 * Shapes a transaction for one viewer. Accounts that belong to someone else
 * only expose the owner's name and the last four digits of the number.
 * Pass viewerId = null for admins, who see everything.
 */
function toTransactionDto(row: TransactionJoinRow, viewerId: string | null, focusAccountId?: string) {
  const party = (
    accountId: string | null,
    accountNumber: string | null,
    accountName: string | null,
    ownerId: string | null,
    ownerName: string | null,
  ) => {
    if (!accountId || !accountNumber) return null;
    const visible = viewerId === null || ownerId === viewerId;
    return {
      accountId: visible ? accountId : null,
      accountNumber: visible ? accountNumber : maskNumber(accountNumber),
      accountName: visible ? accountName : null,
      ownerName,
      isOwn: viewerId !== null && ownerId === viewerId,
    };
  };

  const source = party(row.source_account_id, row.source_number, row.source_name, row.source_user_id, row.source_owner);
  const destination = party(row.destination_account_id, row.dest_number, row.dest_name, row.dest_user_id, row.dest_owner);

  let direction: Direction;
  if (row.type === 'DEPOSIT') direction = 'CREDIT';
  else if (row.type === 'WITHDRAWAL') direction = 'DEBIT';
  else if (focusAccountId) direction = row.source_account_id === focusAccountId ? 'DEBIT' : 'CREDIT';
  else if (source?.isOwn && destination?.isOwn) direction = 'INTERNAL';
  else if (source?.isOwn) direction = 'DEBIT';
  else if (destination?.isOwn) direction = 'CREDIT';
  else direction = 'INTERNAL';

  return {
    id: row.id,
    reference: row.id.slice(0, 8).toUpperCase(),
    type: row.type,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    direction,
    source,
    destination,
    createdAt: row.created_at,
  };
}

export type TransactionDto = ReturnType<typeof toTransactionDto>;

export interface TransactionFilter {
  page: number;
  pageSize: number;
  type?: TransactionType;
  accountId?: string;
  search?: string;
  from?: string;
  to?: string;
}

function buildFilters(filter: TransactionFilter, params: unknown[], conditions: string[]) {
  if (filter.accountId) {
    params.push(filter.accountId);
    conditions.push(`(t.source_account_id = $${params.length} OR t.destination_account_id = $${params.length})`);
  }
  if (filter.type) {
    params.push(filter.type);
    conditions.push(`t.type = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    conditions.push(`(t.description ILIKE $${params.length} OR su.full_name ILIKE $${params.length} OR du.full_name ILIKE $${params.length})`);
  }
  if (filter.from) {
    params.push(filter.from);
    conditions.push(`t.created_at >= $${params.length}::date`);
  }
  if (filter.to) {
    params.push(filter.to);
    conditions.push(`t.created_at < $${params.length}::date + 1`);
  }
}

async function listPage(
  conditions: string[],
  params: unknown[],
  filter: TransactionFilter,
  toDto: (row: TransactionJoinRow) => TransactionDto,
): Promise<Page<TransactionDto>> {
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRow] = await query<{ total: number }>(
    `
      SELECT COUNT(*)::int AS total
      FROM transactions t
      LEFT JOIN accounts sa ON sa.id = t.source_account_id
      LEFT JOIN users su ON su.id = sa.user_id
      LEFT JOIN accounts da ON da.id = t.destination_account_id
      LEFT JOIN users du ON du.id = da.user_id
      ${where}
    `,
    params,
  );

  const rows = await query<TransactionJoinRow>(
    `${SELECT_WITH_PARTIES} ${where}
     ORDER BY t.created_at DESC, t.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
  );

  return { items: rows.map(toDto), page: filter.page, pageSize: filter.pageSize, total: countRow?.total ?? 0 };
}

export const transactionRepository = {
  async create(
    payload: {
      initiatorId: string;
      sourceAccountId: string | null;
      destinationAccountId: string | null;
      amount: string;
      currency: Currency;
      type: TransactionType;
      status?: TransactionStatus;
      description?: string | null;
      metadata?: Record<string, unknown>;
      createdAt?: Date;
    },
    db: Db = pool,
  ) {
    const rows = await query<TransactionRow>(
      `
        INSERT INTO transactions
          (user_id, source_account_id, destination_account_id, amount, currency, type, status, description, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()))
        RETURNING *
      `,
      [
        payload.initiatorId,
        payload.sourceAccountId,
        payload.destinationAccountId,
        payload.amount,
        payload.currency,
        payload.type,
        payload.status ?? 'COMPLETED',
        payload.description ?? null,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
        payload.createdAt ?? null,
      ],
      db,
    );
    return rows[0]!;
  },

  async findForViewer(id: string, viewerId: string | null) {
    const rows = await query<TransactionJoinRow>(`${SELECT_WITH_PARTIES} WHERE t.id = $1`, [id]);
    const row = rows[0];
    if (!row) return null;
    if (viewerId !== null && row.source_user_id !== viewerId && row.dest_user_id !== viewerId) return null;
    return toTransactionDto(row, viewerId);
  },

  /** Every transaction that touches one of the user's accounts, in either direction. */
  async listForUser(userId: string, filter: TransactionFilter) {
    const params: unknown[] = [userId];
    const conditions = [
      `(t.source_account_id IN (SELECT id FROM accounts WHERE user_id = $1)
        OR t.destination_account_id IN (SELECT id FROM accounts WHERE user_id = $1))`,
    ];
    buildFilters(filter, params, conditions);
    return listPage(conditions, params, filter, (row) => toTransactionDto(row, userId, filter.accountId));
  },

  async listAll(filter: TransactionFilter) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    buildFilters(filter, params, conditions);
    return listPage(conditions, params, filter, (row) => toTransactionDto(row, null));
  },

  /**
   * Daily money in / money out for one currency over the last `days` days,
   * excluding moves between the user's own accounts, plus the end-of-day
   * total balance reconstructed backwards from today's balance.
   */
  async cashflow(userId: string, currency: Currency, days: number) {
    const rows = await query<{ day: string; income: string; expense: string }>(
      `
        WITH flows AS (
          SELECT t.created_at::date AS day,
            SUM(CASE WHEN da.user_id = $1 AND sa.user_id IS DISTINCT FROM $1 THEN t.amount ELSE 0 END) AS income,
            SUM(CASE WHEN sa.user_id = $1 AND da.user_id IS DISTINCT FROM $1 THEN t.amount ELSE 0 END) AS expense
          FROM transactions t
          LEFT JOIN accounts sa ON sa.id = t.source_account_id
          LEFT JOIN accounts da ON da.id = t.destination_account_id
          WHERE t.currency = $2
            AND t.status = 'COMPLETED'
            AND t.created_at >= CURRENT_DATE - ($3::int - 1)
            AND (sa.user_id = $1 OR da.user_id = $1)
          GROUP BY 1
        )
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
          COALESCE(f.income, 0)::numeric(18, 2)::text AS income,
          COALESCE(f.expense, 0)::numeric(18, 2)::text AS expense
        FROM generate_series(CURRENT_DATE - ($3::int - 1), CURRENT_DATE, INTERVAL '1 day') AS d(day)
        LEFT JOIN flows f ON f.day = d.day::date
        ORDER BY d.day
      `,
      [userId, currency, days],
    );

    const [balanceRow] = await query<{ total: string }>(
      `SELECT COALESCE(SUM(balance), 0)::text AS total FROM accounts WHERE user_id = $1 AND currency = $2`,
      [userId, currency],
    );

    let runningBalance = toCents(balanceRow?.total ?? '0');
    const series = new Array<{ date: string; income: string; expense: string; balance: string }>(rows.length);
    let totalIncome = 0;
    let totalExpense = 0;

    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index]!;
      const income = toCents(row.income);
      const expense = toCents(row.expense);
      series[index] = { date: row.day, income: row.income, expense: row.expense, balance: fromCents(runningBalance) };
      runningBalance -= income - expense;
      totalIncome += income;
      totalExpense += expense;
    }

    return {
      currency,
      days: series,
      totals: { income: fromCents(totalIncome), expense: fromCents(totalExpense), net: fromCents(totalIncome - totalExpense) },
    };
  },
};
