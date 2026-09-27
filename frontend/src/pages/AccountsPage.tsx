import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatCurrency, formatDate, maskAccountId } from '../utils/format';

interface AccountRecord {
  id: string;
  user_id: string;
  currency: 'USD' | 'EUR' | 'AMD';
  balance: string;
  status: string;
  created_at: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'AMD'>('USD');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.request<AccountRecord[]>('/accounts');
      setAccounts(data ?? []);
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

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await api.request('/accounts', {
        method: 'POST',
        body: JSON.stringify({ currency }),
      });
      await loadAccounts();
    } catch (err) {
      setError((err as Error).message || 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Accounts</p>
          <h1>Your accounts</h1>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="card section-card">
          <div className="section-header">
            <h2>Open a new account</h2>
          </div>
          <form onSubmit={handleCreateAccount} className="inline-form">
            <label>
              Currency
              <select value={currency} onChange={(event) => setCurrency(event.target.value as 'USD' | 'EUR' | 'AMD')}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AMD">AMD</option>
              </select>
            </label>
            <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create account'}</button>
          </form>
        </div>

        {loading ? (
          <div className="card info-card">Loading accounts...</div>
        ) : (
          <div className="account-grid">
            {accounts.length === 0 ? (
              <div className="card section-card empty-card">
                <p>You do not have any accounts yet.</p>
              </div>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="card account-card">
                  <div className="account-card-header">
                    <div>
                      <span className="eyebrow">{account.currency}</span>
                      <h3>{account.currency === 'USD' ? 'Primary account' : `${account.currency} account`}</h3>
                    </div>
                    <span className={`status-badge ${account.status.toLowerCase()}`}>{account.status}</span>
                  </div>

                  <div className="account-number">{maskAccountId(account.id)}</div>
                  <div className="account-money">{formatCurrency(account.balance, account.currency)}</div>

                  <div className="meta-row">
                    <span>Opened</span>
                    <strong>{formatDate(account.created_at)}</strong>
                  </div>

                  <div className="button-row compact-row">
                    <Link to={`/accounts/${account.id}`} className="primary-button">View details</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
