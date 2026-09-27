import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const [userData, accountData, transactionData, logData] = await Promise.all([
          api.request<any[]>('/admin/users'),
          api.request<any[]>('/admin/accounts'),
          api.request<any[]>('/admin/transactions?page=1&pageSize=10'),
          api.request<any[]>('/admin/audit-logs?page=1&pageSize=10'),
        ]);

        setUsers(userData ?? []);
        setAccounts(accountData ?? []);
        setTransactions(transactionData ?? []);
        setLogs(logData ?? []);
        setError('');
      } catch (err) {
        setError((err as Error).message || 'Unable to load admin data.');
      } finally {
        setLoading(false);
      }
    };

    void loadSummary();
  }, []);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter((user) => user.role).length,
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter((account) => account.status === 'ACTIVE').length,
    totalTransactions: transactions.length,
  }), [users, accounts, transactions]);

  const recentLogs = logs.slice(0, 6);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Admin</p>
          <h1>Operations overview</h1>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="card info-card">Loading admin dashboard...</div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="card stat-card"><span>Total users</span><strong>{stats.totalUsers}</strong></div>
              <div className="card stat-card"><span>Active users</span><strong>{stats.activeUsers}</strong></div>
              <div className="card stat-card"><span>Total accounts</span><strong>{stats.totalAccounts}</strong></div>
              <div className="card stat-card"><span>Active accounts</span><strong>{stats.activeAccounts}</strong></div>
              <div className="card stat-card"><span>Total transactions</span><strong>{stats.totalTransactions}</strong></div>
            </div>

            <div className="two-col">
              <div className="card section-card">
                <div className="section-header"><h2>Quick links</h2></div>
                <div className="button-row">
                  <Link to="/admin/users" className="primary-button">Users</Link>
                  <Link to="/admin/accounts" className="secondary-button">Accounts</Link>
                  <Link to="/admin/transactions" className="secondary-button">Transactions</Link>
                  <Link to="/admin/audit-logs" className="secondary-button">Audit logs</Link>
                </div>
              </div>

              <div className="card section-card">
                <div className="section-header"><h2>Recent audit events</h2></div>
                {recentLogs.length === 0 ? (
                  <p className="empty-text">No audit events available.</p>
                ) : (
                  <div className="stack-list">
                    {recentLogs.map((log) => (
                      <div key={log.id} className="list-row">
                        <div>
                          <strong>{log.action}</strong>
                          <div className="tiny-text">{log.entity_type}</div>
                        </div>
                        <span className="tiny-text">{formatDateTime(log.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
