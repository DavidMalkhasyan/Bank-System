import { useEffect, useState, type FormEvent } from 'react';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';

interface AccountRecord {
  id: string;
  currency: 'USD' | 'EUR' | 'AMD';
  balance: string;
  status: string;
}

export default function TransferPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.request<AccountRecord[]>('/accounts');
      setAccounts(data ?? []);
      if (data?.[0] && !sourceAccountId) {
        setSourceAccountId(data[0].id);
      }
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Unable to load accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!sourceAccountId || !destinationAccountId) {
      setError('Choose both a source and destination account.');
      return;
    }

    if (sourceAccountId === destinationAccountId) {
      setError('Source and destination accounts must be different.');
      return;
    }

    const amountValue = Number.parseFloat(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    const sourceAccount = accounts.find((account) => account.id === sourceAccountId);
    const destinationAccount = accounts.find((account) => account.id === destinationAccountId);
    if (!sourceAccount || !destinationAccount) {
      setError('Selected account is no longer available.');
      return;
    }

    if (sourceAccount.currency !== destinationAccount.currency) {
      setError('Source and destination accounts must use the same currency.');
      return;
    }

    if (Number.parseFloat(sourceAccount.balance) < amountValue) {
      setError('Insufficient funds for this transfer.');
      return;
    }

    setSubmitting(true);

    try {
      await api.request('/transfers', {
        method: 'POST',
        body: JSON.stringify({
          sourceAccountId,
          destinationAccountId,
          amount: String(amountValue),
          description: description.trim() || undefined,
        }),
      });

      setSuccess('Transfer completed successfully.');
      setAmount('');
      setDescription('');
      await loadAccounts();
    } catch (err) {
      setError((err as Error).message || 'Transfer failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const source = accounts.find((account) => account.id === sourceAccountId);
  const destination = accounts.find((account) => account.id === destinationAccountId);
  const sourceBalance = source?.balance ?? '0';

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Transfer</p>
          <h1>Send money</h1>
        </div>

        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">{success}</div>}

        {loading ? (
          <div className="card info-card">Loading accounts...</div>
        ) : (
          <div className="card section-card">
            <form onSubmit={handleSubmit} className="stack-form">
              <label>
                From account
                <select value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)}>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.currency} — {formatCurrency(account.balance, account.currency)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                To account
                <select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)}>
                  <option value="">Select destination account</option>
                  {accounts
                    .filter((account) => account.id !== sourceAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.currency} — {formatCurrency(account.balance, account.currency)}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Amount
                <input type="number" step="0.01" min="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="250.00" required />
              </label>

              <label>
                Description
                <input type="text" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional payment note" />
              </label>

              <div className="hint-row">Available funds: {formatCurrency(sourceBalance, source?.currency ?? 'USD')}</div>

              <button type="submit" disabled={submitting}>
                {submitting ? 'Processing...' : 'Transfer funds'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
