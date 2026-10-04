import { describe, expect, it } from 'vitest';

import { api, bearer, registerAdmin, registerUser } from './helpers.js';

describe('admin', () => {
  it('is forbidden for customers', async () => {
    const customer = await registerUser('customer');
    expect((await api().get('/api/admin/users').set(bearer(customer))).status).toBe(403);
    expect((await api().get('/api/admin/stats').set(bearer(customer))).status).toBe(403);
  });

  it('lists users without password hashes, with pagination meta', async () => {
    const admin = await registerAdmin();
    const response = await api().get('/api/admin/users?page=1&pageSize=5').set(bearer(admin));

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 5 });
    expect(response.body.meta.total).toBeGreaterThan(0);
    for (const user of response.body.data) {
      expect(user.password_hash).toBeUndefined();
      expect(user.passwordHash).toBeUndefined();
    }
  });

  it('freezes an account, which blocks money movement, then unfreezes it', async () => {
    const admin = await registerAdmin();
    const customer = await registerUser('frozen');

    const frozen = await api().patch(`/api/admin/accounts/${customer.checkingId}/status`).set(bearer(admin)).send({ status: 'FROZEN', reason: 'Review' });
    expect(frozen.status).toBe(200);
    expect(frozen.body.data.status).toBe('FROZEN');

    const blocked = await api().post(`/api/accounts/${customer.checkingId}/withdraw`).set(bearer(customer)).send({ amount: '1' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/frozen/);

    await api().patch(`/api/admin/accounts/${customer.checkingId}/status`).set(bearer(admin)).send({ status: 'ACTIVE' });
    expect((await api().post(`/api/accounts/${customer.checkingId}/withdraw`).set(bearer(customer)).send({ amount: '1' })).status).toBe(200);

    const audit = await api().get('/api/admin/audit-logs?action=ACCOUNT_FROZEN').set(bearer(admin));
    expect(audit.body.data.some((log: { entityId: string }) => log.entityId === customer.checkingId)).toBe(true);
  });

  it('returns dashboard stats', async () => {
    const admin = await registerAdmin();
    const response = await api().get('/api/admin/stats').set(bearer(admin));

    expect(response.status).toBe(200);
    expect(response.body.data.activity).toHaveLength(14);
    expect(response.body.data.users).toBeGreaterThan(0);
  });

  it('cannot change its own role', async () => {
    const admin = await registerAdmin();
    const response = await api().patch(`/api/admin/users/${admin.id}/role`).set(bearer(admin)).send({ role: 'CUSTOMER' });
    expect(response.status).toBe(400);
  });
});
