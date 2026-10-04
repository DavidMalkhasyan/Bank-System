import request from 'supertest';

import app from '../app.js';
import { query } from '../db/index.js';

export const api = () => request(app);

let counter = 0;
export const uniqueEmail = (prefix = 'user') => `${prefix}-${Date.now()}-${(counter += 1)}@example.com`;

export interface TestUser {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
  /** The USD checking account every new customer gets, funded with the welcome bonus. */
  checkingId: string;
  checkingNumber: string;
}

export async function registerUser(prefix = 'user', fullName = 'Test User'): Promise<TestUser> {
  const email = uniqueEmail(prefix);
  const response = await api().post('/api/auth/register').send({ email, password: 'password123', fullName });
  if (response.status !== 201) {
    throw new Error(`Register failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  const { user, accessToken, refreshToken } = response.body.data;
  const accounts = await api().get('/api/accounts').set('Authorization', `Bearer ${accessToken}`);
  const checking = accounts.body.data[0];
  return { id: user.id, email, token: accessToken, refreshToken, checkingId: checking.id, checkingNumber: checking.accountNumber };
}

export async function registerAdmin() {
  const admin = await registerUser('admin', 'Admin User');
  await query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [admin.id]);
  // Log in again so the access token carries the ADMIN role.
  const login = await api().post('/api/auth/login').send({ email: admin.email, password: 'password123' });
  return { ...admin, token: login.body.data.accessToken as string };
}

export const bearer = (user: { token: string }) => ({ Authorization: `Bearer ${user.token}` });

export async function openAccount(user: TestUser, currency = 'USD', type = 'SAVINGS') {
  const response = await api().post('/api/accounts').set(bearer(user)).send({ currency, type });
  return response.body.data as { id: string; accountNumber: string; balance: string; currency: string };
}

export async function balanceOf(accountId: string) {
  const [row] = await query<{ balance: string }>(`SELECT balance::text FROM accounts WHERE id = $1`, [accountId]);
  return row?.balance;
}
