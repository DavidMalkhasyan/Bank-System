import { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatCurrency, formatDate, maskAccountId } from '../utils/format';

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoading(true);
        const data = await api.request<any[]>('/admin/accounts');
        setAccounts(data ?? []);
        setError('');
      } catch (err) {
        setError((err as Error).message || 'Unable to load accounts.');
      } finally {
        setLoading(false);
      }
    };

    void loadAccounts();
  }, []);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Admin</p>
          <h1>Accounts</h1>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="card info-card">Loading accounts...</div>
        ) : (
          <div className="card section-card">
            {accounts.length === 0 ? (
              <p className="empty-text">No accounts found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Owner</th>
                      <th>Currency</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td>{maskAccountId(account.id)}</td>
                        <td>{account.user_id}</td>
                        <td>{account.currency}</td>
                        <td>{formatCurrency(account.balance, account.currency)}</td>
                        <td><span className={`status-badge ${String(account.status).toLowerCase()}`}>{account.status}</span></td>
                        <td>{formatDate(account.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
