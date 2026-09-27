import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

import { query } from './index.js';

const hashPassword = async (value: string) => bcrypt.hash(value, 10);

async function ensureUser(email: string, password: string, role: 'CUSTOMER' | 'ADMIN') {
  const existing = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing[0]) {
    return existing[0].id;
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await query(
    `
      INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
    `,
    [id, email, passwordHash, role],
  );

  return id;
}

async function ensureAccount(userId: string, currency: 'USD' | 'EUR' | 'AMD', balance: string, label: string) {
  const existing = await query<{ id: string }>(
    `SELECT id FROM accounts WHERE user_id = $1 AND currency = $2 AND balance = $3 LIMIT 1`,
    [userId, currency, balance],
  );

  if (existing[0]) {
    return existing[0].id;
  }

  const id = randomUUID();
  await query(
    `
      INSERT INTO accounts (id, user_id, currency, balance, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'ACTIVE', NOW() - INTERVAL '45 days', NOW())
    `,
    [id, userId, currency, balance],
  );

  await query(
    `
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '30 days')
    `,
    [randomUUID(), userId, 'ACCOUNT_CREATED', 'account', id, JSON.stringify({ label, currency, balance })],
  );

  return id;
}

async function seedTransactions(userId: string, accountId: string, records: Array<{ type: string; amount: string; currency: 'USD' | 'EUR' | 'AMD'; relativeDays: number; source?: string | null; destination?: string | null; description?: string }>) {
  for (const record of records) {
    const exists = await query<{ id: string }>(
      `SELECT id FROM transactions WHERE user_id = $1 AND type = $2 AND amount = $3 AND created_at > NOW() - INTERVAL '2 days' LIMIT 1`,
      [userId, record.type, record.amount],
    );

    if (exists[0]) {
      continue;
    }

    await query(
      `
        INSERT INTO transactions (id, user_id, source_account_id, destination_account_id, amount, currency, type, status, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8, NOW() - ($9 || ' days')::interval)
      `,
      [
        randomUUID(),
        userId,
        record.source ?? null,
        record.destination ?? null,
        record.amount,
        record.currency,
        record.type,
        JSON.stringify({ description: record.description ?? record.type }),
        record.relativeDays,
      ],
    );
  }
}

async function main() {
  const adminId = await ensureUser('admin@example.com', 'password123', 'ADMIN');
  const customerOneId = await ensureUser('customer1@example.com', 'password123', 'CUSTOMER');
  const customerTwoId = await ensureUser('customer2@example.com', 'password123', 'CUSTOMER');

  const checkingId = await ensureAccount(customerOneId, 'USD', '4250.00', 'Checking');
  const savingsId = await ensureAccount(customerOneId, 'USD', '8200.00', 'Savings');
  const euroId = await ensureAccount(customerTwoId, 'EUR', '1850.50', 'Euro');

  await query(
    `
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 day')
    `,
    [randomUUID(), customerOneId, 'LOGIN', 'user', customerOneId, JSON.stringify({ source: 'demo' })],
  );

  await query(
    `
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '2 days')
    `,
    [randomUUID(), adminId, 'USER_LOGIN', 'user', adminId, JSON.stringify({ source: 'dashboard' })],
  );

  await seedTransactions(customerOneId, checkingId, [
    { type: 'DEPOSIT', amount: '2000.00', currency: 'USD', relativeDays: 2, description: 'Salary deposit' },
    { type: 'WITHDRAWAL', amount: '250.00', currency: 'USD', relativeDays: 5, description: 'Mortgage payment' },
    { type: 'TRANSFER', amount: '300.00', currency: 'USD', relativeDays: 9, source: checkingId, destination: euroId, description: 'Transfer to Alex' },
    { type: 'DEPOSIT', amount: '500.00', currency: 'USD', relativeDays: 12, description: 'Client refund' },
  ]);

  await seedTransactions(customerTwoId, euroId, [
    { type: 'DEPOSIT', amount: '1500.00', currency: 'EUR', relativeDays: 3, description: 'Initial deposit' },
    { type: 'TRANSFER', amount: '300.00', currency: 'EUR', relativeDays: 9, source: euroId, destination: checkingId, description: 'Transfer from Alex' },
  ]);

  await seedTransactions(adminId, checkingId, [
    { type: 'DEPOSIT', amount: '1200.00', currency: 'USD', relativeDays: 20, description: 'Admin starter funding' },
  ]);

  console.log('Seed data loaded.');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
