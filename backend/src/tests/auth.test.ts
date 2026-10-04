import { describe, expect, it } from 'vitest';

import { api, bearer, registerUser, uniqueEmail } from './helpers.js';

describe('auth', () => {
  it('registers a user with a funded checking account', async () => {
    const email = uniqueEmail('register');
    const response = await api().post('/api/auth/register').send({ email, password: 'password123', fullName: 'Jane Doe' });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({ email, fullName: 'Jane Doe', role: 'CUSTOMER' });
    expect(response.body.data.user.password_hash).toBeUndefined();
    expect(response.body.data.accessToken).toBeTruthy();

    const accounts = await api().get('/api/accounts').set('Authorization', `Bearer ${response.body.data.accessToken}`);
    expect(accounts.body.data).toHaveLength(1);
    expect(accounts.body.data[0]).toMatchObject({ currency: 'USD', balance: '1000.00', type: 'CHECKING' });
    expect(accounts.body.data[0].accountNumber).toMatch(/^\d{16}$/);
  });

  it('rejects duplicate emails with 409', async () => {
    const user = await registerUser('dup');
    const response = await api().post('/api/auth/register').send({ email: user.email, password: 'password123', fullName: 'Dup' });
    expect(response.status).toBe(409);
  });

  it('returns 400 with a readable message for invalid input', async () => {
    const response = await api().post('/api/auth/register').send({ email: 'not-an-email', password: 'short', fullName: 'X' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Enter a valid email address');
    expect(response.body.details.fieldErrors).toHaveProperty('password');
  });

  it('logs in and rejects a wrong password', async () => {
    const user = await registerUser('login');
    const ok = await api().post('/api/auth/login').send({ email: user.email.toUpperCase(), password: 'password123' });
    expect(ok.status).toBe(200);

    const bad = await api().post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.message).toBe('Invalid email or password');
  });

  it('requires a valid access token', async () => {
    expect((await api().get('/api/accounts')).status).toBe(401);
    expect((await api().get('/api/accounts').set('Authorization', 'Bearer nope')).status).toBe(401);
  });

  it('rotates refresh tokens and rejects the old one', async () => {
    const user = await registerUser('refresh');
    const first = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).not.toBe(user.refreshToken);

    const reused = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(reused.status).toBe(401);
  });

  it('revokes the refresh token on logout', async () => {
    const user = await registerUser('logout');
    await api().post('/api/auth/logout').send({ refreshToken: user.refreshToken });
    const response = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(response.status).toBe(401);
  });

  it('updates the profile and changes the password', async () => {
    const user = await registerUser('profile');
    const profile = await api().patch('/api/auth/me').set(bearer(user)).send({ fullName: 'Renamed Person' });
    expect(profile.body.data.fullName).toBe('Renamed Person');

    const wrong = await api().post('/api/auth/change-password').set(bearer(user)).send({ currentPassword: 'nope', newPassword: 'newpassword1' });
    expect(wrong.status).toBe(400);

    const changed = await api().post('/api/auth/change-password').set(bearer(user)).send({ currentPassword: 'password123', newPassword: 'newpassword1' });
    expect(changed.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: user.email, password: 'newpassword1' })).status).toBe(200);
    // Old sessions are signed out.
    expect((await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken })).status).toBe(401);
  });
});
