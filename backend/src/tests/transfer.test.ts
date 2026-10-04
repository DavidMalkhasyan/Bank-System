import { describe, expect, it } from 'vitest';

import { query } from '../db/index.js';
import { api, balanceOf, bearer, openAccount, registerUser } from './helpers.js';

describe('transfers', () => {
  it('moves money between my own accounts', async () => {
    const user = await registerUser('own');
    const savings = await openAccount(user);
    const response = await api()
      .post('/api/transfers')
      .set(bearer(user))
      .send({ sourceAccountId: user.checkingId, destinationAccountId: savings.id, amount: '250.25', description: 'Save' });

    expect(response.status).toBe(201);
    expect(response.body.data.transaction).toMatchObject({ type: 'TRANSFER', amount: '250.25', direction: 'INTERNAL' });
    expect(await balanceOf(user.checkingId)).toBe('749.75');
    expect(await balanceOf(savings.id)).toBe('250.25');
  });

  it('sends money to another customer by account number, visible to both', async () => {
    const sender = await registerUser('sender', 'Sender Person');
    const recipient = await registerUser('receiver', 'Receiver Person');

    const response = await api()
      .post('/api/transfers')
      .set(bearer(sender))
      .send({ sourceAccountId: sender.checkingId, destinationAccountNumber: recipient.checkingNumber.replace(/(\d{4})/g, '$1 '), amount: '100' });
    expect(response.status).toBe(201);
    expect(await balanceOf(recipient.checkingId)).toBe('1100.00');

    const senderView = await api().get('/api/transactions?type=TRANSFER').set(bearer(sender));
    expect(senderView.body.data[0]).toMatchObject({ direction: 'DEBIT', destination: { ownerName: 'Receiver Person', isOwn: false, accountId: null } });
    expect(senderView.body.data[0].destination.accountNumber).toMatch(/^•••• \d{4}$/);

    const recipientView = await api().get('/api/transactions?type=TRANSFER').set(bearer(recipient));
    expect(recipientView.body.data[0]).toMatchObject({ direction: 'CREDIT', source: { ownerName: 'Sender Person', isOwn: false } });
  });

  it('rejects insufficient funds, same-account and currency mismatch', async () => {
    const user = await registerUser('rules');
    const usdSavings = await openAccount(user, 'USD');
    const euro = await openAccount(user, 'EUR');

    const insufficient = await api().post('/api/transfers').set(bearer(user))
      .send({ sourceAccountId: user.checkingId, destinationAccountId: usdSavings.id, amount: '5000' });
    expect(insufficient.status).toBe(400);
    expect(insufficient.body.message).toBe('Insufficient funds');

    const same = await api().post('/api/transfers').set(bearer(user))
      .send({ sourceAccountId: user.checkingId, destinationAccountId: user.checkingId, amount: '1' });
    expect(same.status).toBe(400);

    const mismatch = await api().post('/api/transfers').set(bearer(user))
      .send({ sourceAccountId: user.checkingId, destinationAccountId: euro.id, amount: '1' });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.message).toMatch(/Currency mismatch/);

    expect(await balanceOf(user.checkingId)).toBe('1000.00');
  });

  it("cannot send from someone else's account", async () => {
    const victim = await registerUser('victim');
    const thief = await registerUser('thief');
    const response = await api().post('/api/transfers').set(bearer(thief))
      .send({ sourceAccountId: victim.checkingId, destinationAccountId: thief.checkingId, amount: '10' });

    expect(response.status).toBe(404);
    expect(await balanceOf(victim.checkingId)).toBe('1000.00');
  });

  it('never overdraws under concurrent transfers', async () => {
    const user = await registerUser('race');
    const target = await openAccount(user);

    // 1000.00 available, 12 parallel transfers of 100.00: exactly 10 may succeed.
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        api().post('/api/transfers').set(bearer(user)).send({ sourceAccountId: user.checkingId, destinationAccountId: target.id, amount: '100' }),
      ),
    );

    expect(results.filter((response) => response.status === 201)).toHaveLength(10);
    expect(results.filter((response) => response.status === 400)).toHaveLength(2);
    expect(await balanceOf(user.checkingId)).toBe('0.00');
    expect(await balanceOf(target.id)).toBe('1000.00');
  });

  it('does not deadlock when two accounts send to each other at once', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        index % 2 === 0
          ? api().post('/api/transfers').set(bearer(alice)).send({ sourceAccountId: alice.checkingId, destinationAccountNumber: bob.checkingNumber, amount: '10' })
          : api().post('/api/transfers').set(bearer(bob)).send({ sourceAccountId: bob.checkingId, destinationAccountNumber: alice.checkingNumber, amount: '10' }),
      ),
    );

    expect(results.every((response) => response.status === 201)).toBe(true);
    expect(await balanceOf(alice.checkingId)).toBe('1000.00');
    expect(await balanceOf(bob.checkingId)).toBe('1000.00');
  });

  it('rolls back everything when the transfer fails midway', async () => {
    const user = await registerUser('rollback');
    const target = await openAccount(user);
    const [before] = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM transactions WHERE source_account_id = $1`, [user.checkingId]);

    // Frozen destination: validation fails after both rows are locked.
    await query(`UPDATE accounts SET status = 'FROZEN' WHERE id = $1`, [target.id]);
    const response = await api().post('/api/transfers').set(bearer(user))
      .send({ sourceAccountId: user.checkingId, destinationAccountId: target.id, amount: '10' });

    expect(response.status).toBe(400);
    const [after] = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM transactions WHERE source_account_id = $1`, [user.checkingId]);
    expect(after!.count).toBe(before!.count);
    expect(await balanceOf(user.checkingId)).toBe('1000.00');
  });
});
