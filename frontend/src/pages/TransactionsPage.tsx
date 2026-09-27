import { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatCurrency, formatDateTime, formatTransactionType } from '../utils/format';

interface TransactionRecord {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  source_account_id: string | null;
  destination_account_id: string | null;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [type, setType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTransactions = async (nextPage = page, nextType = type) => {
    try {
      setLoading(true);
      const query = new URLSearchParams({ page: String(nextPage), pageSize: '10' });
      if (nextType !== 'ALL') {
        query.set('type', nextType);
      }

      const data = await api.request<TransactionRecord[]>(`/transactions?${query.toString()}`);
      setTransactions(data ?? []);
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTransactions(page, type);
  }, [type, page]);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Transactions</p>
          <h1>Transaction history</h1>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="card section-card">
          <div className="section-header">
            <h2>Filters</h2>
          </div>
          <div className="filter-row">
            <label>
              Type
              <select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
                <option value="ALL">All</option>
                <option value="DEPOSIT">Deposit</option>
                <option value="WITHDRAWAL">Withdrawal</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="card info-card">Loading transactions...</div>
        ) : (
          <div className="card section-card">
            {transactions.length === 0 ? (
              <p className="empty-text">No transactions match the selected filter.</p>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{formatDateTime(transaction.created_at)}</td>
                          <td>{formatTransactionType(transaction.type)}</td>
                          <td>
                            {typeof transaction.metadata?.description === 'string'
                              ? transaction.metadata.description
                              : transaction.type === 'TRANSFER'
                                ? 'Bank transfer'
                                : 'Account activity'}
                          </td>
                          <td className={Number.parseFloat(transaction.amount) >= 0 ? 'positive' : 'negative'}>
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </td>
                          <td>{transaction.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pagination-row">
                  <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                  <span>Page {page}</span>
                  <button type="button" disabled={transactions.length < 10} onClick={() => setPage((current) => current + 1)}>Next</button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
