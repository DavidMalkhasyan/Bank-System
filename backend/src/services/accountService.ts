import { withTransaction } from '../db/index.js';
import { cacheDel, cacheGet, cacheSet } from '../db/redis.js';
import { accountRepository, toAccountDto, type AccountDto } from '../repositories/accountRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import type { AccountRow, AccountType, AuthUser, Currency } from '../types/domain.js';
import { badRequest, notFound } from '../utils/errors.js';
import { fromCents, parseAmount, toCents } from '../utils/money.js';

const MAX_OPEN_ACCOUNTS = 8;
const ACCOUNT_CACHE_TTL_SECONDS = 60;

const cacheKey = (accountId: string) => `account:${accountId}`;

/** Admins may read any account; customers only their own. Others get 404, not 403, to avoid leaking ids. */
function assertCanRead(account: AccountRow | null | undefined, user: AuthUser): asserts account is AccountRow {
  if (!account || (user.role !== 'ADMIN' && account.user_id !== user.id)) {
    throw notFound('Account not found');
  }
}

/** Moving money always requires owning the account, even for admins. */
function assertOwner(account: AccountRow | null | undefined, user: AuthUser): asserts account is AccountRow {
  if (!account || account.user_id !== user.id) {
    throw notFound('Account not found');
  }
}

function assertActive(account: AccountRow, label = 'This account') {
  if (account.status === 'FROZEN') {
    throw badRequest(`${label} is frozen. Contact support to unfreeze it.`);
  }
  if (account.status === 'CLOSED') {
    throw badRequest(`${label} is closed`);
  }
}

/** "Alex Carter" -> "Alex C." so a lookup confirms the recipient without exposing the full name. */
const shortName = (fullName: string) => {
  const [first = '', ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
};

async function movement(
  kind: 'DEPOSIT' | 'WITHDRAWAL',
  accountId: string,
  user: AuthUser,
  amountRaw: string,
  description?: string,
) {
  const cents = parseAmount(amountRaw);
  const amount = fromCents(cents);

  const { account, transactionId } = await withTransaction(async (client) => {
    const locked = (await accountRepository.lockForUpdate(client, [accountId])).get(accountId);
    assertOwner(locked, user);
    assertActive(locked);

    if (kind === 'WITHDRAWAL' && toCents(locked.balance) < cents) {
      throw badRequest('Insufficient funds', { available: locked.balance });
    }

    const updated = await accountRepository.applyDelta(client, accountId, kind === 'DEPOSIT' ? amount : `-${amount}`);
    const transaction = await transactionRepository.create(
      {
        initiatorId: user.id,
        sourceAccountId: kind === 'WITHDRAWAL' ? accountId : null,
        destinationAccountId: kind === 'DEPOSIT' ? accountId : null,
        amount,
        currency: locked.currency,
        type: kind,
        description: description?.trim() || (kind === 'DEPOSIT' ? 'Cash deposit' : 'Cash withdrawal'),
      },
      client,
    );
    await auditRepository.create(
      { userId: user.id, action: kind, entityType: 'account', entityId: accountId, metadata: { amount, currency: locked.currency } },
      client,
    );

    return { account: updated, transactionId: transaction.id };
  });

  await cacheDel(cacheKey(accountId));
  return {
    account: toAccountDto(account),
    transaction: await transactionRepository.findForViewer(transactionId, user.id),
  };
}

export const accountService = {
  async listAccounts(userId: string) {
    const accounts = await accountRepository.listByUser(userId);
    return accounts.map(toAccountDto);
  },

  async createAccount(user: AuthUser, input: { currency: Currency; type: AccountType; name?: string }) {
    const existing = await accountRepository.listByUser(user.id);
    if (existing.filter((account) => account.status !== 'CLOSED').length >= MAX_OPEN_ACCOUNTS) {
      throw badRequest(`You can have at most ${MAX_OPEN_ACCOUNTS} open accounts`);
    }

    const name = input.name?.trim() || `${input.type === 'SAVINGS' ? 'Savings' : 'Checking'} · ${input.currency}`;
    const account = await withTransaction(async (client) => {
      const created = await accountRepository.create({ userId: user.id, name, type: input.type, currency: input.currency }, client);
      await auditRepository.create(
        {
          userId: user.id,
          action: 'ACCOUNT_OPENED',
          entityType: 'account',
          entityId: created.id,
          metadata: { currency: created.currency, type: created.type },
        },
        client,
      );
      return created;
    });

    return toAccountDto(account);
  },

  /** Cache-aside read: Redis first, PostgreSQL on a miss. */
  async getAccount(accountId: string, user: AuthUser): Promise<AccountDto> {
    const cached = await cacheGet<{ userId: string; account: AccountDto }>(cacheKey(accountId));
    if (cached) {
      if (user.role !== 'ADMIN' && cached.userId !== user.id) throw notFound('Account not found');
      return cached.account;
    }

    const account = await accountRepository.findById(accountId);
    assertCanRead(account, user);
    const dto = toAccountDto(account);
    await cacheSet(cacheKey(accountId), { userId: account.user_id, account: dto }, ACCOUNT_CACHE_TTL_SECONDS);
    return dto;
  },

  async renameAccount(accountId: string, user: AuthUser, name: string) {
    assertOwner(await accountRepository.findById(accountId), user);
    const updated = await accountRepository.rename(accountId, name.trim());
    await cacheDel(cacheKey(accountId));
    return toAccountDto(updated!);
  },

  async closeAccount(accountId: string, user: AuthUser) {
    const closed = await withTransaction(async (client) => {
      const locked = (await accountRepository.lockForUpdate(client, [accountId])).get(accountId);
      assertOwner(locked, user);
      assertActive(locked);
      if (toCents(locked.balance) !== 0) {
        throw badRequest('Move the remaining balance to another account before closing this one');
      }
      const updated = await accountRepository.setStatus(accountId, 'CLOSED', client);
      await auditRepository.create({ userId: user.id, action: 'ACCOUNT_CLOSED', entityType: 'account', entityId: accountId }, client);
      return updated!;
    });

    await cacheDel(cacheKey(accountId));
    return toAccountDto(closed);
  },

  deposit: (accountId: string, user: AuthUser, amount: string, description?: string) =>
    movement('DEPOSIT', accountId, user, amount, description),

  withdraw: (accountId: string, user: AuthUser, amount: string, description?: string) =>
    movement('WITHDRAWAL', accountId, user, amount, description),

  /** Resolves an account number to a recipient preview before a transfer. */
  async lookup(accountNumber: string, user: AuthUser) {
    const account = await accountRepository.findByNumber(accountNumber.replace(/\D/g, ''));
    if (!account || account.status === 'CLOSED') {
      throw notFound('No account found with this number');
    }
    const owner = await userRepository.findById(account.user_id);
    return {
      accountNumber: account.account_number,
      currency: account.currency,
      ownerName: owner ? shortName(owner.full_name) : 'Unknown',
      isOwn: account.user_id === user.id,
      canReceive: account.status === 'ACTIVE',
    };
  },

  /**
   * Moves money between two accounts in one database transaction. Both rows
   * are locked (in id order) before balances are read, so concurrent
   * transfers can never overdraw the source account.
   */
  async transfer(
    user: AuthUser,
    input: {
      sourceAccountId: string;
      destinationAccountId?: string;
      destinationAccountNumber?: string;
      amount: string;
      description?: string;
    },
  ) {
    const cents = parseAmount(input.amount);
    const amount = fromCents(cents);

    let destinationId = input.destinationAccountId;
    if (!destinationId && input.destinationAccountNumber) {
      const destination = await accountRepository.findByNumber(input.destinationAccountNumber.replace(/\D/g, ''));
      if (!destination) throw notFound('Recipient account not found');
      destinationId = destination.id;
    }
    if (!destinationId) {
      throw badRequest('Choose a destination account');
    }
    if (destinationId === input.sourceAccountId) {
      throw badRequest('Source and destination accounts must be different');
    }

    const result = await withTransaction(async (client) => {
      const locked = await accountRepository.lockForUpdate(client, [input.sourceAccountId, destinationId]);
      const source = locked.get(input.sourceAccountId);
      const destination = locked.get(destinationId);

      assertOwner(source, user);
      assertActive(source, 'The source account');
      if (!destination) throw notFound('Recipient account not found');
      if (destination.status !== 'ACTIVE') {
        throw badRequest('The recipient account cannot receive funds right now');
      }
      if (source.currency !== destination.currency) {
        throw badRequest(
          `Currency mismatch: ${source.currency} cannot be sent to a ${destination.currency} account. Currency exchange is not supported.`,
        );
      }
      if (toCents(source.balance) < cents) {
        throw badRequest('Insufficient funds', { available: source.balance });
      }

      const updatedSource = await accountRepository.applyDelta(client, source.id, `-${amount}`);
      await accountRepository.applyDelta(client, destination.id, amount);

      const transaction = await transactionRepository.create(
        {
          initiatorId: user.id,
          sourceAccountId: source.id,
          destinationAccountId: destination.id,
          amount,
          currency: source.currency,
          type: 'TRANSFER',
          description: input.description?.trim() || (destination.user_id === user.id ? 'Transfer between my accounts' : 'Transfer'),
        },
        client,
      );
      await auditRepository.create(
        {
          userId: user.id,
          action: 'TRANSFER',
          entityType: 'transaction',
          entityId: transaction.id,
          metadata: { sourceAccountId: source.id, destinationAccountId: destination.id, amount, currency: source.currency },
        },
        client,
      );

      return { sourceAccount: updatedSource, transactionId: transaction.id };
    });

    await cacheDel(cacheKey(input.sourceAccountId), cacheKey(destinationId));
    return {
      sourceAccount: toAccountDto(result.sourceAccount),
      transaction: await transactionRepository.findForViewer(result.transactionId, user.id),
    };
  },
};
