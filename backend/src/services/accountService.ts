import { randomUUID } from 'node:crypto';

import { pool } from '../db/index.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import type { Account, AccountCurrency } from '../types/account.js';
import { AppError, badRequest, forbidden, notFound } from '../utils/errors.js';
import { userRepository } from '../repositories/userRepository.js';
import { getJson, setJson, del as redisDel, connectRedis } from '../db/redis.js';

const normalizeMoney = (value: string) => {
  const numeric = Number.parseFloat(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw badRequest('Amount must be a positive number');
  }

  return numeric.toFixed(2);
};

const canAccessAccount = (accountUserId: string, requesterId: string, requesterRole: string) => {
  if (requesterRole === 'ADMIN') {
    return true;
  }

  return accountUserId === requesterId;
};

export const accountService = {
  async createAccount(userId: string, currency: AccountCurrency) {
    const account = await accountRepository.create(userId, currency);

    if (!account) {
      throw new AppError('Failed to create account', 500);
    }

    await auditRepository.create({
      userId,
      action: 'ACCOUNT_CREATED',
      entityType: 'account',
      entityId: account.id,
      metadata: { currency, balance: account.balance },
    });

    return account;
  },

  async getAccountById(accountId: string, requesterId: string, requesterRole: string) {
    const account = await accountRepository.findById(accountId);
    if (!account) {
      throw notFound('Account not found');
    }

    if (!canAccessAccount(account.user_id, requesterId, requesterRole)) {
      throw forbidden('You do not have access to this account');
    }

    return account;
  },

  async getUserAccounts(userId: string) {
    return accountRepository.listByUser(userId);
  },

  async getBalance(accountId: string, requesterId: string, requesterRole: string) {
    const cacheKey = `account:${accountId}`;
    try {
      await connectRedis();
      const cached = await getJson<{ id: string; user_id: string; currency: string; balance: string }>(cacheKey);
      if (cached) {
        if (requesterRole !== 'ADMIN' && cached.user_id !== requesterId) {
          throw forbidden('You do not have access to this account');
        }

        return { accountId: cached.id, currency: cached.currency, balance: cached.balance };
      }
    } catch {
      // ignore redis errors, fallback to DB
    }

    const account = await this.getAccountById(accountId, requesterId, requesterRole);

    try {
      await setJson(cacheKey, { id: account.id, user_id: account.user_id, currency: account.currency, balance: account.balance }, 60);
    } catch {
      // ignore
    }

    return { accountId: account.id, currency: account.currency, balance: account.balance };
  },

  async deposit(accountId: string, amountRaw: string, requesterId: string, requesterRole: string) {
    const account = await this.getAccountById(accountId, requesterId, requesterRole);
    const amount = normalizeMoney(amountRaw);

    const client: any = await pool.connect();

    try {
      await client.query('BEGIN');

      const accountRow = (await client.query(
        `SELECT * FROM accounts WHERE id = $1 FOR UPDATE`,
        [accountId],
      )) as { rows: Account[] };

      const lockedAccount = accountRow.rows[0];
      if (!lockedAccount) {
        throw notFound('Account not found');
      }

      if (lockedAccount.status !== 'ACTIVE') {
        throw badRequest('Account is not active');
      }

      const currentBalance = Number.parseFloat(lockedAccount.balance);
      const newBalance = (currentBalance + Number.parseFloat(amount)).toFixed(2);

      const updated = (await client.query(
        `
          UPDATE accounts
          SET balance = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `,
        [newBalance, accountId],
      )) as { rows: Account[] };
      const updatedAccount = updated.rows[0];
      if (!updatedAccount) {
        throw notFound('Account not found after update');
      }

      await client.query(
        `
          INSERT INTO transactions (id, user_id, source_account_id, destination_account_id, amount, currency, type, status)
          VALUES ($1, $2, NULL, $3, $4, $5, 'DEPOSIT', 'COMPLETED')
        `,
        [randomUUID(), lockedAccount.user_id, lockedAccount.id, amount, lockedAccount.currency],
      );

      await client.query('COMMIT');

      await auditRepository.create({
        userId: lockedAccount.user_id,
        action: 'DEPOSIT',
        entityType: 'account',
        entityId: lockedAccount.id,
        metadata: { amount, currency: lockedAccount.currency },
      });

      try {
        await setJson(`account:${lockedAccount.id}`, { id: lockedAccount.id, user_id: lockedAccount.user_id, currency: lockedAccount.currency, balance: updatedAccount.balance }, 60);
      } catch {}

      return updatedAccount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async withdraw(accountId: string, amountRaw: string, requesterId: string, requesterRole: string) {
    const account = await this.getAccountById(accountId, requesterId, requesterRole);
    const amount = normalizeMoney(amountRaw);

    const client: any = await pool.connect();

    try {
      await client.query('BEGIN');

      const accountRow = (await client.query(
        `SELECT * FROM accounts WHERE id = $1 FOR UPDATE`,
        [accountId],
      )) as { rows: Account[] };

      const lockedAccount = accountRow.rows[0];
      if (!lockedAccount) {
        throw notFound('Account not found');
      }

      if (lockedAccount.status !== 'ACTIVE') {
        throw badRequest('Account is not active');
      }

      const currentBalance = Number.parseFloat(lockedAccount.balance);
      const withdrawalAmount = Number.parseFloat(amount);
      if (currentBalance < withdrawalAmount) {
        throw badRequest('Insufficient funds for withdrawal');
      }

      const newBalance = (currentBalance - withdrawalAmount).toFixed(2);
      const updated = (await client.query(
        `
          UPDATE accounts
          SET balance = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `,
        [newBalance, accountId],
      )) as { rows: Account[] };
      const updatedAccount = updated.rows[0];
      if (!updatedAccount) {
        throw notFound('Account not found after update');
      }

      await client.query(
        `
          INSERT INTO transactions (id, user_id, source_account_id, destination_account_id, amount, currency, type, status)
          VALUES ($1, $2, $3, NULL, $4, $5, 'WITHDRAWAL', 'COMPLETED')
        `,
        [randomUUID(), lockedAccount.user_id, lockedAccount.id, amount, lockedAccount.currency],
      );

      await client.query('COMMIT');

      await auditRepository.create({
        userId: lockedAccount.user_id,
        action: 'WITHDRAWAL',
        entityType: 'account',
        entityId: lockedAccount.id,
        metadata: { amount, currency: lockedAccount.currency },
      });

      try {
        await setJson(`account:${lockedAccount.id}`, { id: lockedAccount.id, user_id: lockedAccount.user_id, currency: lockedAccount.currency, balance: updatedAccount.balance }, 60);
      } catch {}

      return updatedAccount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async transfer({
    sourceAccountId,
    destinationAccountId,
    amountRaw,
    requesterId,
    requesterRole,
    description,
  }: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountRaw: string;
    requesterId: string;
    requesterRole: string;
    description?: string;
  }) {
    const amount = normalizeMoney(amountRaw);

    if (sourceAccountId === destinationAccountId) {
      throw badRequest('Source and destination accounts must be different');
    }

    const orderedIds = [sourceAccountId, destinationAccountId].sort();
    const client: any = await pool.connect();

    try {
      await client.query('BEGIN');

      const rows = (await client.query(
        `SELECT * FROM accounts WHERE id = ANY($1) ORDER BY id FOR UPDATE`,
        [orderedIds],
      )) as { rows: Account[] };

      const accountMap = new Map<string, Account>();
      for (const row of rows.rows) {
        accountMap.set(row.id, row);
      }

      const sourceAccount = accountMap.get(sourceAccountId);
      const destinationAccount = accountMap.get(destinationAccountId);

      if (!sourceAccount) {
        throw notFound('Source account not found');
      }

      if (!destinationAccount) {
        throw notFound('Destination account not found');
      }

      if (!canAccessAccount(sourceAccount.user_id, requesterId, requesterRole)) {
        throw forbidden('You do not have permission to transfer from this account');
      }

      if (sourceAccount.currency !== destinationAccount.currency) {
        throw badRequest('Transfer currency mismatch');
      }

      if (sourceAccount.status !== 'ACTIVE' || destinationAccount.status !== 'ACTIVE') {
        throw badRequest('Both accounts must be active');
      }

      const sourceBalance = Number.parseFloat(sourceAccount.balance);
      const transferAmount = Number.parseFloat(amount);
      if (sourceBalance < transferAmount) {
        throw badRequest('Insufficient funds for transfer');
      }

      const updatedSourceBalance = (sourceBalance - transferAmount).toFixed(2);
      const updatedDestinationBalance = (Number.parseFloat(destinationAccount.balance) + transferAmount).toFixed(2);

      await client.query(
        `
          UPDATE accounts
          SET balance = $1, updated_at = NOW()
          WHERE id = $2
        `,
        [updatedSourceBalance, sourceAccount.id],
      );

      await client.query(
        `
          UPDATE accounts
          SET balance = $1, updated_at = NOW()
          WHERE id = $2
        `,
        [updatedDestinationBalance, destinationAccount.id],
      );

      const transactionResult = await client.query(
        `
          INSERT INTO transactions (id, user_id, source_account_id, destination_account_id, amount, currency, type, status, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, 'TRANSFER', 'COMPLETED', $7)
          RETURNING *
        `,
        [
          randomUUID(),
          requesterId,
          sourceAccount.id,
          destinationAccount.id,
          amount,
          sourceAccount.currency,
          JSON.stringify({ description: description?.trim() || 'Transfer', sourceAccountId, destinationAccountId }),
        ],
      );

      await client.query('COMMIT');

      await auditRepository.create({
        userId: requesterId,
        action: 'TRANSFER',
        entityType: 'transfer',
        entityId: transactionResult.rows[0]?.id ?? null,
        metadata: {
          sourceAccountId,
          destinationAccountId,
          amount,
          currency: sourceAccount.currency,
        },
      });

      try {
        await setJson(`account:${sourceAccount.id}`, { id: sourceAccount.id, user_id: sourceAccount.user_id, currency: sourceAccount.currency, balance: updatedSourceBalance }, 60);
        await setJson(`account:${destinationAccount.id}`, { id: destinationAccount.id, user_id: destinationAccount.user_id, currency: destinationAccount.currency, balance: updatedDestinationBalance }, 60);
      } catch {}

      return {
        sourceAccount: { ...sourceAccount, balance: updatedSourceBalance },
        destinationAccount: { ...destinationAccount, balance: updatedDestinationBalance },
        transaction: transactionResult.rows[0] ?? null,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getAllAccountsForAdmin() {
    return accountRepository.listAll();
  },

  async getAllTransactionsForAdmin(filter?: { type?: string; page?: number; pageSize?: number }) {
    return transactionRepository.listAll(filter);
  },

  async getUsersForAdmin() {
    return userRepository.list();
  },

  async getAuditLogsForAdmin(page = 1, pageSize = 20) {
    return auditRepository.listAll(page, pageSize);
  },
};
