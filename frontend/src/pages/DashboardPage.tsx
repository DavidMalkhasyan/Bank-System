import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { useAppSelector } from '../store/hooks';
import { formatCurrency, formatDateTime, formatTransactionType, maskAccountId } from '../utils/format';

interface AccountRecord {
  id: string;
  user_id: string;
  currency: string;
  balance: string;
  status: string;
  created_at: string;
}

interface TransactionRecord {
  id: string;
  user_id: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: string;
  currency: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function DashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [accountsResponse, transactionsResponse] = await Promise.all([
          api.request<AccountRecord[]>('/accounts'),
          api.request<TransactionRecord[]>('/transactions?page=1&pageSize=8'),
        ]);

        setAccounts(accountsResponse ?? []);
        setTransactions(transactionsResponse ?? []);
        setError('');
      } catch (err) {
        setError((err as Error).message || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + Number.parseFloat(account.balance || '0'), 0),
    [accounts],
  );

  const summaryByCurrency = useMemo(() => {
    return Object.entries(
      accounts.reduce<Record<string, number>>((acc, account) => {
        acc[account.currency] = (acc[account.currency] ?? 0) + Number.parseFloat(account.balance || '0');
        return acc;
      }, {}),
    ).map(([currency, value]) => ({ currency, value }));
  }, [accounts]);

  const recentTransactions = transactions.slice(0, 6);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Overview</p>
          <h1>Welcome, {user?.email?.split('@')[0] ?? 'Customer'}</h1>
          <p>Track your balances, payments, and account activity across your connected banking profile.</p>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="card info-card">Loading dashboard data...</div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="card stat-card">
                <span>Total balance</span>
                <strong>{formatCurrency(totalBalance, 'USD')}</strong>
              </div>
              <div className="card stat-card">
                <span>Accounts</span>
                <strong>{accounts.length}</strong>
              </div>
              <div className="card stat-card">
                <span>Recent activity</span>
                <strong>{transactions.length}</strong>
              </div>
            </div>

            <div className="card section-card">
              <div className="section-header">
                <h2>Accounts</h2>
                <Link to="/accounts">View all</Link>
              </div>
              <div className="account-list compact">
                {accounts.length === 0 ? (
                  <p className="empty-text">You do not have any accounts yet.</p>
                ) : (
                  accounts.map((account) => (
                    <Link key={account.id} to={`/accounts/${account.id}`} className="account-summary">
                      <div>
                        <strong>{account.currency} account</strong>
                        <span>{maskAccountId(account.id)}</span>
                      </div>
                      <div className="account-summary-meta">
                        <span>{account.status}</span>
                        <strong>{formatCurrency(account.balance, account.currency)}</strong>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="two-col">
              <div className="card section-card">
                <div className="section-header">
                  <h2>Quick actions</h2>
                </div>
                <div className="button-row">
                  <Link to="/transfer" className="primary-button">Transfer</Link>
                  <Link to="/accounts" className="secondary-button">Deposit</Link>
                  <Link to="/accounts" className="secondary-button">Withdraw</Link>
                </div>
              </div>

              <div className="card section-card">
                <div className="section-header">
                  <h2>Balance by currency</h2>
                </div>
                <div className="stack-list">
                  {summaryByCurrency.length === 0 ? (
                    <p className="empty-text">No balances yet.</p>
                  ) : (
                    summaryByCurrency.map(({ currency, value }) => (
                      <div key={currency} className="list-row">
                        <span>{currency}</span>
                        <strong>{formatCurrency(value, currency)}</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="card section-card">
              <div className="section-header">
                <h2>Recent transactions</h2>
                <Link to="/transactions">View all</Link>
              </div>
              {recentTransactions.length === 0 ? (
                <p className="empty-text">No transactions yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Date</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{formatTransactionType(transaction.type)}</td>
                          <td>{transaction.metadata && typeof transaction.metadata.description === 'string' ? transaction.metadata.description : 'Transaction'}</td>
                          <td>{formatDateTime(transaction.created_at)}</td>
                          <td className={Number.parseFloat(transaction.amount) >= 0 ? 'positive' : 'negative'}>
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
