import { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { useAppSelector } from '../store/hooks';
import { formatCurrency, formatDate } from '../utils/format';

interface AccountRecord {
  id: string;
  currency: string;
  balance: string;
  status: string;
  created_at: string;
}

export default function ProfilePage() {
  const user = useAppSelector((state) => state.auth.user);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await api.request<AccountRecord[]>('/accounts');
        setAccounts(data ?? []);
        setError('');
      } catch (err) {
        setError((err as Error).message || 'Unable to load profile details.');
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const totalBalance = accounts.reduce((sum, account) => sum + Number.parseFloat(account.balance || '0'), 0);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Profile</p>
          <h1>{user?.email ?? 'Customer profile'}</h1>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="card info-card">Loading profile...</div>
        ) : (
          <>
            <div className="card section-card">
              <div className="profile-grid">
                <div>
                  <span className="eyebrow">Email</span>
                  <h3>{user?.email}</h3>
                </div>
                <div>
                  <span className="eyebrow">Role</span>
                  <h3>{user?.role}</h3>
                </div>
                <div>
                  <span className="eyebrow">Member since</span>
                  <h3>{formatDate(user?.created_at ?? undefined)}</h3>
                </div>
                <div>
                  <span className="eyebrow">Total balance</span>
                  <h3>{formatCurrency(totalBalance, 'USD')}</h3>
                </div>
              </div>
            </div>

            <div className="card section-card">
              <div className="section-header"><h2>Accounts</h2></div>
              {accounts.length === 0 ? (
                <p className="empty-text">No accounts associated with this profile.</p>
              ) : (
                <div className="stack-list">
                  {accounts.map((account) => (
                    <div key={account.id} className="list-row">
                      <div>
                        <strong>{account.currency} account</strong>
                        <div className="tiny-text">Opened {formatDate(account.created_at)}</div>
                      </div>
                      <div>
                        <strong>{formatCurrency(account.balance, account.currency)}</strong>
                        <div className="tiny-text">{account.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
