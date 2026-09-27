import { describe, it, expect } from 'vitest';
import request from 'supertest';

import app from '../app.js';

const makeUniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

describe('accounts', () => {
  it('creates an account', async () => {
    const email = makeUniqueEmail('account');
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({ email, password: 'password123' });

    const token = registerResponse.body.data.accessToken;

    const response = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'USD' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.currency).toBe('USD');
  });

  it('rejects deposits with invalid amount', async () => {
    const email = makeUniqueEmail('invaliddeposit');
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({ email, password: 'password123' });

    const token = registerResponse.body.data.accessToken;
    const accountResponse = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'USD' });

    const response = await request(app)
      .post(`/accounts/${accountResponse.body.data.id}/deposit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '-10' });

    expect(response.status).toBe(400);
  });
});
