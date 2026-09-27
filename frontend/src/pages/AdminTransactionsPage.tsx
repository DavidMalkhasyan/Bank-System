import { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/format';

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const data = await api.request<any[]>('/admin/transactions?page=1&pageSize=20');
        setTransactions(data ?? []);
        setError('');
      } catch (err) {
        setError((err as Error).message || 'Unable to load transactions.');
      } finally {
        setLoading(false);
      }
    };

    void loadTransactions();
  }, []);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Admin</p>
          <h1>Transactions</h1>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="card info-card">Loading transactions...</div>
        ) : (
          <div className="card section-card">
            {transactions.length === 0 ? (
              <p className="empty-text">No transactions found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Source</th>
                      <th>Destination</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{transaction.type}</td>
                        <td>{transaction.source_account_id ?? '—'}</td>
                        <td>{transaction.destination_account_id ?? '—'}</td>
                        <td>{formatCurrency(transaction.amount, transaction.currency)}</td>
                        <td>{transaction.status}</td>
                        <td>{formatDateTime(transaction.created_at)}</td>
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
