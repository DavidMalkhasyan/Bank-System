import { describe, expect, it } from 'vitest';

import app from '../app.js';
import request from 'supertest';

const makeUniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

describe('auth endpoints', () => {
  it('registers a user successfully', async () => {
    const email = makeUniqueEmail('demo');
    const response = await request(app)
      .post('/auth/register')
      .send({ email, password: 'password123' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);
  });

  it('logs in a user', async () => {
    const email = makeUniqueEmail('demo');
    await request(app)
      .post('/auth/register')
      .send({ email, password: 'password123' });

    const response = await request(app)
      .post('/auth/login')
      .send({ email, password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
  });
});
