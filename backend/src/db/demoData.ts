import bcrypt from 'bcryptjs';
import type pg from 'pg';

import { accountRepository } from '../repositories/accountRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import type { AccountType, Currency, TransactionType, UserRole } from '../types/domain.js';
import { fromCents } from '../utils/money.js';
import { query, withTransaction } from './index.js';

export const DEMO_PASSWORD = 'password123';

export const DEMO_USERS = {
  admin: { email: 'admin@example.com', fullName: 'Morgan Reyes', role: 'ADMIN' as UserRole },
  alex: { email: 'alex@example.com', fullName: 'Alex Carter', role: 'CUSTOMER' as UserRole },
  sam: { email: 'sam@example.com', fullName: 'Sam Lee', role: 'CUSTOMER' as UserRole },
};

/** Fixed numbers so the UI can suggest demo recipients; every other account gets a random number. */
export const DEMO_ACCOUNT_NUMBERS = {
  alexChecking: '4000123456789012',
  samChecking: '4000987654321098',
};

const EXTRA_CUSTOMERS = [
  { key: 'priya', email: 'priya.shah@example.com', fullName: 'Priya Shah' },
  { key: 'diego', email: 'diego.morales@example.com', fullName: 'Diego Morales' },
  { key: 'hannah', email: 'hannah.kim@example.com', fullName: 'Hannah Kim' },
  { key: 'liam', email: 'liam.obrien@example.com', fullName: "Liam O'Brien" },
  { key: 'ana', email: 'ana.petrosyan@example.com', fullName: 'Ana Petrosyan' },
  { key: 'noah', email: 'noah.fischer@example.com', fullName: 'Noah Fischer' },
];

const HISTORY_DAYS = 120;

/** Small deterministic PRNG so every seed produces the same story. */
function createRandom(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    cents: (min: number, max: number) => Math.round((next() * (max - min) + min) * 100),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
    chance: (probability: number) => next() < probability,
  };
}

interface SeedAccount {
  id: string;
  userId: string;
  currency: Currency;
  cents: number;
}

interface SeedEvent {
  at: Date;
  type: TransactionType;
  from?: string;
  to?: string;
  cents: number;
  description: string;
}

/**
 * Creates demo users, accounts and ~4 months of realistic activity.
 * Balances are the result of replaying every transaction, so the ledger
 * always adds up. Returns false when users already exist and reset is off.
 */
export async function seedDemoData({ reset = false } = {}) {
  if (!reset) {
    const [row] = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM users`);
    if ((row?.count ?? 0) > 0) return false;
  }

  const random = createRandom(20_240_917);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = new Date();
  const dayAt = (daysAgo: number, hour = random.int(8, 21)) => {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, random.int(0, 59), random.int(0, 59), 0);
    // Early in the morning "today" events would land in the future; pull them back.
    if (date > now) return new Date(now.getTime() - random.int(5, 90) * 60_000);
    return date;
  };

  await withTransaction(async (client) => {
    if (reset) {
      await client.query('TRUNCATE audit_logs, transactions, refresh_tokens, accounts, users CASCADE');
    }

    const users = new Map<string, string>();
    const accounts = new Map<string, SeedAccount>();

    const addUser = async (key: string, email: string, fullName: string, role: UserRole, joinedDaysAgo: number) => {
      const user = await userRepository.create({ email, fullName, passwordHash, role }, client);
      const joinedAt = dayAt(joinedDaysAgo, 9);
      await client.query(`UPDATE users SET created_at = $2, updated_at = $2 WHERE id = $1`, [user.id, joinedAt]);
      await auditRepository.create({ userId: user.id, action: 'USER_REGISTERED', entityType: 'user', entityId: user.id }, client);
      await client.query(`UPDATE audit_logs SET created_at = $2 WHERE entity_id = $1 AND action = 'USER_REGISTERED'`, [user.id, joinedAt]);
      users.set(key, user.id);
      return user.id;
    };

    const addAccount = async (
      key: string,
      userKey: string,
      name: string,
      type: AccountType,
      currency: Currency,
      openedDaysAgo: number,
      accountNumber?: string,
    ) => {
      const userId = users.get(userKey)!;
      const account = await accountRepository.create({ userId, name, type, currency }, client);
      const openedAt = dayAt(openedDaysAgo, 10);
      await client.query(
        `UPDATE accounts SET created_at = $2, updated_at = $2, account_number = COALESCE($3, account_number) WHERE id = $1`,
        [account.id, openedAt, accountNumber ?? null],
      );
      await insertAudit(client, userId, 'ACCOUNT_OPENED', 'account', account.id, { currency, type }, openedAt);
      accounts.set(key, { id: account.id, userId, currency, cents: 0 });
    };

    await addUser('admin', DEMO_USERS.admin.email, DEMO_USERS.admin.fullName, 'ADMIN', HISTORY_DAYS + 30);
    await addUser('alex', DEMO_USERS.alex.email, DEMO_USERS.alex.fullName, 'CUSTOMER', HISTORY_DAYS + 5);
    await addUser('sam', DEMO_USERS.sam.email, DEMO_USERS.sam.fullName, 'CUSTOMER', HISTORY_DAYS + 2);
    for (const [index, customer] of EXTRA_CUSTOMERS.entries()) {
      await addUser(customer.key, customer.email, customer.fullName, 'CUSTOMER', HISTORY_DAYS - index * 20);
    }

    await addAccount('admin.ops', 'admin', 'Operations Checking', 'CHECKING', 'USD', HISTORY_DAYS + 30);
    await addAccount('alex.checking', 'alex', 'Everyday Checking', 'CHECKING', 'USD', HISTORY_DAYS, DEMO_ACCOUNT_NUMBERS.alexChecking);
    await addAccount('alex.savings', 'alex', 'High-Yield Savings', 'SAVINGS', 'USD', HISTORY_DAYS);
    await addAccount('alex.eur', 'alex', 'Travel Wallet', 'CHECKING', 'EUR', HISTORY_DAYS - 20);
    await addAccount('sam.checking', 'sam', 'Main Checking', 'CHECKING', 'USD', HISTORY_DAYS, DEMO_ACCOUNT_NUMBERS.samChecking);
    await addAccount('sam.amd', 'sam', 'Dram Savings', 'SAVINGS', 'AMD', HISTORY_DAYS - 10);
    for (const [index, customer] of EXTRA_CUSTOMERS.entries()) {
      await addAccount(`${customer.key}.checking`, customer.key, 'Checking', 'CHECKING', 'USD', HISTORY_DAYS - index * 20);
    }

    const events: SeedEvent[] = [];
    const deposit = (to: string, daysAgo: number, cents: number, description: string, hour?: number) =>
      events.push({ at: dayAt(daysAgo, hour), type: 'DEPOSIT', to, cents, description });
    const withdraw = (from: string, daysAgo: number, cents: number, description: string, hour?: number) =>
      events.push({ at: dayAt(daysAgo, hour), type: 'WITHDRAWAL', from, cents, description });
    const transfer = (from: string, to: string, daysAgo: number, cents: number, description: string, hour?: number) =>
      events.push({ at: dayAt(daysAgo, hour), type: 'TRANSFER', from, to, cents, description });

    // Opening balances.
    deposit('admin.ops', HISTORY_DAYS + 29, 25_000_00, 'Initial funding', 9);
    deposit('alex.checking', HISTORY_DAYS, 2_500_00, 'Opening deposit', 10);
    deposit('alex.savings', HISTORY_DAYS, 6_000_00, 'Opening deposit', 10);
    deposit('alex.eur', HISTORY_DAYS - 20, 900_00, 'Opening deposit', 11);
    deposit('sam.checking', HISTORY_DAYS, 1_800_00, 'Opening deposit', 10);
    deposit('sam.amd', HISTORY_DAYS - 10, 250_000_00, 'Opening deposit', 12);

    const groceries = ['Green Basket Grocery', 'Harvest Market', 'Corner Pantry'];
    const dining = ['Corner Café', 'Luna Pizzeria', 'Sushi House', 'Bean & Leaf Coffee', 'Taco Stand'];
    const shopping = ['City Books', 'Northline Outfitters', 'Pixel Electronics', 'Home & Hearth'];
    const travel = ['Café de Flore', 'Metro Paris', 'Musée Pass', 'Boulangerie Paul', 'Hotel Lumière'];

    for (let day = HISTORY_DAYS - 1; day >= 0; day -= 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - day);
      const dayOfMonth = date.getDate();
      const hourLimit = day === 0 ? Math.max(8, now.getHours() - 1) : 21;
      const hour = () => random.int(8, hourLimit);

      // Alex: payroll every other Friday, rent on the 1st, savings sweep on the 2nd.
      if (date.getDay() === 5 && Math.floor(day / 7) % 2 === 0) deposit('alex.checking', day, 2_950_00, 'Payroll · Northwind Labs', 9);
      if (dayOfMonth === 1) withdraw('alex.checking', day, 1_650_00, 'Rent · Maple Court Apartments', 10);
      if (dayOfMonth === 2) transfer('alex.checking', 'alex.savings', day, 900_00, 'Monthly savings', 11);
      if (dayOfMonth === 5) withdraw('alex.checking', day, random.cents(62, 118), 'Electricity · City Power', hour());
      if (dayOfMonth === 8) withdraw('alex.checking', day, 59_99, 'Internet · FiberNet', hour());
      if (dayOfMonth === 12) withdraw('alex.checking', day, 15_49, 'Streaming subscription', hour());
      if (dayOfMonth === 15) withdraw('alex.checking', day, 45_00, 'Gym membership', hour());
      if (random.chance(0.35)) withdraw('alex.checking', day, random.cents(28, 140), random.pick(groceries), hour());
      if (random.chance(0.45)) withdraw('alex.checking', day, random.cents(4, 38), random.pick(dining), hour());
      if (random.chance(0.06)) withdraw('alex.checking', day, random.cents(30, 260), random.pick(shopping), hour());
      if (day < 60 && day > 50 && random.chance(0.8)) withdraw('alex.eur', day, random.cents(8, 140), random.pick(travel), hour());

      // Sam: payroll on the 1st and 15th, rent on the 3rd, shared expenses with Alex.
      if (dayOfMonth === 1 || dayOfMonth === 15) deposit('sam.checking', day, 1_850_00, 'Payroll · Bluebird Studio', 9);
      if (dayOfMonth === 3) withdraw('sam.checking', day, 1_200_00, 'Rent · Oak Street Lofts', 10);
      if (dayOfMonth === 20) deposit('sam.amd', day, 120_000_00, 'Savings top-up', hour());
      if (random.chance(0.3)) withdraw('sam.checking', day, random.cents(18, 95), random.pick(groceries), hour());
      if (random.chance(0.35)) withdraw('sam.checking', day, random.cents(5, 45), random.pick(dining), hour());
      if (random.chance(0.06)) transfer('sam.checking', 'alex.checking', day, random.cents(20, 80), random.pick(['Dinner split', 'Movie tickets', 'Groceries split', 'Taxi share']), hour());
      if (random.chance(0.04)) transfer('alex.checking', 'sam.checking', day, random.cents(25, 150), random.pick(['Concert tickets', 'Birthday gift', 'Weekend trip share']), hour());

      // Everyone else: monthly pay, rent and a bit of spending, plus the occasional payment to Alex or Sam.
      for (const [index, customer] of EXTRA_CUSTOMERS.entries()) {
        const key = `${customer.key}.checking`;
        const joinedDaysAgo = HISTORY_DAYS - index * 20;
        if (day > joinedDaysAgo) continue;
        if (day === joinedDaysAgo) deposit(key, day, random.cents(800, 3_000), 'Opening deposit', 11);
        if (dayOfMonth === 1 + index) deposit(key, day, random.cents(2_200, 4_800), 'Payroll', 9);
        if (dayOfMonth === 4 + index) withdraw(key, day, random.cents(700, 1_500), 'Rent', 10);
        if (random.chance(0.25)) withdraw(key, day, random.cents(6, 120), random.pick([...groceries, ...dining]), hour());
        if (random.chance(0.015)) transfer(key, random.pick(['alex.checking', 'sam.checking']), day, random.cents(15, 120), random.pick(['Thanks for lunch', 'Event tickets', 'Shared ride']), hour());
      }
    }

    events.sort((a, b) => a.at.getTime() - b.at.getTime());

    // Replay in time order; anything that would overdraw an account is skipped.
    for (const event of events) {
      const source = event.from ? accounts.get(event.from)! : null;
      const destination = event.to ? accounts.get(event.to)! : null;
      if (source && source.cents < event.cents) continue;
      if (source && destination && source.currency !== destination.currency) continue;

      if (source) source.cents -= event.cents;
      if (destination) destination.cents += event.cents;

      const transaction = await transactionRepository.create(
        {
          initiatorId: (source ?? destination)!.userId,
          sourceAccountId: source?.id ?? null,
          destinationAccountId: destination?.id ?? null,
          amount: fromCents(event.cents),
          currency: (source ?? destination)!.currency,
          type: event.type,
          description: event.description,
          createdAt: event.at,
        },
        client,
      );

      if (event.type === 'TRANSFER') {
        await insertAudit(
          client,
          source!.userId,
          'TRANSFER',
          'transaction',
          transaction.id,
          { amount: fromCents(event.cents), currency: source!.currency },
          event.at,
        );
      }
    }

    for (const account of accounts.values()) {
      await client.query(`UPDATE accounts SET balance = $2 WHERE id = $1`, [account.id, fromCents(account.cents)]);
    }

    // A frozen account gives the admin console something to act on.
    await client.query(`UPDATE accounts SET status = 'FROZEN' WHERE id = $1`, [accounts.get('liam.checking')!.id]);
    await insertAudit(client, users.get('admin')!, 'ACCOUNT_FROZEN', 'account', accounts.get('liam.checking')!.id, { reason: 'Unusual activity review' }, dayAt(3, 14));

    for (const key of ['alex', 'sam', 'admin', 'priya', 'diego']) {
      for (let index = 0; index < 3; index += 1) {
        const at = dayAt(random.int(0, 20));
        await insertAudit(client, users.get(key)!, 'LOGIN', 'user', users.get(key)!, { ip: '203.0.113.' + random.int(2, 250) }, at);
      }
    }

    await client.query(
      `
        INSERT INTO app_state (key, value, updated_at) VALUES ('demo_seeded_at', NOW()::text, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `,
    );
  });

  return true;
}

/** When the demo data was last seeded or reset, or null if that was never recorded. */
export async function lastDemoSeedAt() {
  const [row] = await query<{ updated_at: Date }>(`SELECT updated_at FROM app_state WHERE key = 'demo_seeded_at'`);
  return row?.updated_at ?? null;
}

async function insertAudit(
  client: pg.PoolClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
  createdAt: Date,
) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, action, entityType, entityId, JSON.stringify(metadata), createdAt],
  );
}
