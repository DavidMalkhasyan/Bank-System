import { query } from '../db/index.js';
import { cacheDel } from '../db/redis.js';
import { accountRepository, toAccountDto } from '../repositories/accountRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { toUserDto, userRepository } from '../repositories/userRepository.js';
import type { AuthUser, UserRole } from '../types/domain.js';
import { badRequest, notFound } from '../utils/errors.js';

export const adminService = {
  async stats() {
    const [counts] = await query<{
      users: number;
      new_users_30d: number;
      accounts: number;
      active_accounts: number;
      frozen_accounts: number;
      transactions: number;
      transactions_24h: number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM users WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
        (SELECT COUNT(*)::int FROM accounts) AS accounts,
        (SELECT COUNT(*)::int FROM accounts WHERE status = 'ACTIVE') AS active_accounts,
        (SELECT COUNT(*)::int FROM accounts WHERE status = 'FROZEN') AS frozen_accounts,
        (SELECT COUNT(*)::int FROM transactions) AS transactions,
        (SELECT COUNT(*)::int FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours') AS transactions_24h
    `);

    const deposits = await query<{ currency: string; total: string; accounts: number }>(`
      SELECT currency, SUM(balance)::text AS total, COUNT(*)::int AS accounts
      FROM accounts
      WHERE status <> 'CLOSED'
      GROUP BY currency
      ORDER BY currency
    `);

    const activity = await query<{ date: string; deposits: number; withdrawals: number; transfers: number }>(`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
        COUNT(t.id) FILTER (WHERE t.type = 'DEPOSIT')::int AS deposits,
        COUNT(t.id) FILTER (WHERE t.type = 'WITHDRAWAL')::int AS withdrawals,
        COUNT(t.id) FILTER (WHERE t.type = 'TRANSFER')::int AS transfers
      FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') AS d(day)
      LEFT JOIN transactions t ON t.created_at::date = d.day::date
      GROUP BY d.day
      ORDER BY d.day
    `);

    return {
      users: counts!.users,
      newUsers30d: counts!.new_users_30d,
      accounts: counts!.accounts,
      activeAccounts: counts!.active_accounts,
      frozenAccounts: counts!.frozen_accounts,
      transactions: counts!.transactions,
      transactions24h: counts!.transactions_24h,
      depositsByCurrency: deposits,
      activity,
    };
  },

  async setAccountStatus(admin: AuthUser, accountId: string, status: 'ACTIVE' | 'FROZEN', reason?: string) {
    const account = await accountRepository.findById(accountId);
    if (!account) throw notFound('Account not found');
    if (account.status === 'CLOSED') throw badRequest('Closed accounts cannot be changed');
    if (account.status === status) return toAccountDto(account);

    const updated = await accountRepository.setStatus(accountId, status);
    await auditRepository.create({
      userId: admin.id,
      action: status === 'FROZEN' ? 'ACCOUNT_FROZEN' : 'ACCOUNT_UNFROZEN',
      entityType: 'account',
      entityId: accountId,
      metadata: { accountNumber: account.account_number, ownerId: account.user_id, reason },
    });
    await cacheDel(`account:${accountId}`);
    return toAccountDto(updated!);
  },

  async setUserRole(admin: AuthUser, userId: string, role: UserRole) {
    if (admin.id === userId) {
      throw badRequest('You cannot change your own role');
    }
    const updated = await userRepository.updateRole(userId, role);
    if (!updated) throw notFound('User not found');
    await auditRepository.create({
      userId: admin.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'user',
      entityId: userId,
      metadata: { role },
    });
    return toUserDto(updated);
  },
};
