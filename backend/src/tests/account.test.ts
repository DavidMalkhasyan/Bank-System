import { describe, expect, it } from 'vitest';

import { api, balanceOf, bearer, openAccount, registerUser } from './helpers.js';

describe('accounts', () => {
  it('opens an account with a 16-digit number and zero balance', async () => {
    const user = await registerUser('open');
    const response = await api().post('/api/accounts').set(bearer(user)).send({ currency: 'EUR', type: 'SAVINGS', name: 'Holiday fund' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ currency: 'EUR', type: 'SAVINGS', name: 'Holiday fund', balance: '0.00', status: 'ACTIVE' });
  });

  it('rejects unsupported currencies', async () => {
    const user = await registerUser('currency');
    const response = await api().post('/api/accounts').set(bearer(user)).send({ currency: 'GBP' });
    expect(response.status).toBe(400);
  });

  it('deposits and withdraws with exact decimal math', async () => {
    const user = await registerUser('money');
    await api().post(`/api/accounts/${user.checkingId}/deposit`).set(bearer(user)).send({ amount: '0.10' });
    await api().post(`/api/accounts/${user.checkingId}/deposit`).set(bearer(user)).send({ amount: '0.20' });
    const withdrawal = await api().post(`/api/accounts/${user.checkingId}/withdraw`).set(bearer(user)).send({ amount: '0.30', description: 'Snack' });

    expect(withdrawal.status).toBe(200);
    expect(withdrawal.body.data.account.balance).toBe('1000.00');
    expect(withdrawal.body.data.transaction).toMatchObject({ type: 'WITHDRAWAL', amount: '0.30', description: 'Snack', direction: 'DEBIT' });
  });

  it.each([['-10'], ['0'], ['abc'], ['10.123'], ['2000000']])('rejects the invalid amount %s', async (amount) => {
    const user = await registerUser('invalid');
    const response = await api().post(`/api/accounts/${user.checkingId}/deposit`).set(bearer(user)).send({ amount });
    expect(response.status).toBe(400);
    expect(await balanceOf(user.checkingId)).toBe('1000.00');
  });

  it('refuses to overdraw an account', async () => {
    const user = await registerUser('overdraw');
    const response = await api().post(`/api/accounts/${user.checkingId}/withdraw`).set(bearer(user)).send({ amount: '1000.01' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Insufficient funds');
    expect(await balanceOf(user.checkingId)).toBe('1000.00');
  });

  it("hides other customers' accounts", async () => {
    const owner = await registerUser('owner');
    const stranger = await registerUser('stranger');

    expect((await api().get(`/api/accounts/${owner.checkingId}`).set(bearer(stranger))).status).toBe(404);
    expect((await api().post(`/api/accounts/${owner.checkingId}/withdraw`).set(bearer(stranger)).send({ amount: '1' })).status).toBe(404);
    expect((await api().get(`/api/transactions?accountId=${owner.checkingId}`).set(bearer(stranger))).status).toBe(404);
  });

  it('only closes accounts with a zero balance', async () => {
    const user = await registerUser('close');
    expect((await api().post(`/api/accounts/${user.checkingId}/close`).set(bearer(user))).status).toBe(400);

    const empty = await openAccount(user);
    const closed = await api().post(`/api/accounts/${empty.id}/close`).set(bearer(user));
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('CLOSED');
    expect((await api().post(`/api/accounts/${empty.id}/deposit`).set(bearer(user)).send({ amount: '5' })).status).toBe(400);
  });

  it('looks up a recipient by account number without exposing the full name', async () => {
    const sender = await registerUser('lookup');
    const recipient = await registerUser('recipient', 'Maria Gonzalez');
    const response = await api().get(`/api/accounts/lookup?number=${recipient.checkingNumber}`).set(bearer(sender));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ ownerName: 'Maria G.', currency: 'USD', isOwn: false, canReceive: true });
  });

  it('returns a cash flow series for the dashboard', async () => {
    const user = await registerUser('cashflow');
    await api().post(`/api/accounts/${user.checkingId}/withdraw`).set(bearer(user)).send({ amount: '200' });
    const response = await api().get('/api/transactions/cashflow?currency=USD&days=7').set(bearer(user));

    expect(response.status).toBe(200);
    expect(response.body.data.days).toHaveLength(7);
    expect(response.body.data.totals).toMatchObject({ income: '1000.00', expense: '200.00', net: '800.00' });
    expect(response.body.data.days.at(-1).balance).toBe('800.00');
  });
});
