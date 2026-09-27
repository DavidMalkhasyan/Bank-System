import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatCurrency, formatDateTime, formatTransactionType, maskAccountId } from '../utils/format';

interface AccountRecord {
  id: string;
  user_id: string;
  currency: 'USD' | 'EUR' | 'AMD';
  balance: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TransactionRecord {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export default function AccountDetailsPage() {
  const { id } = useParams();
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState<'deposit' | 'withdraw' | null>(null);

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [accountData, txData] = await Promise.all([
        api.request<AccountRecord>(`/accounts/${id}`),
        api.request<TransactionRecord[]>(`/transactions?accountId=${id}&page=1&pageSize=10`),
      ]);

      setAccount(accountData);
      setTransactions(txData ?? []);
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Unable to load account data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const handleDeposit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !depositAmount) return;

    setSubmitting('deposit');
    setSuccess('');
    setError('');

    try {
      await api.request(`/accounts/${id}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ amount: depositAmount }),
      });
      setDepositAmount('');
      setSuccess('Deposit processed successfully.');
      await loadData();
    } catch (err) {
      setError((err as Error).message || 'Deposit failed.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleWithdraw = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !withdrawAmount) return;

    setSubmitting('withdraw');
    setSuccess('');
    setError('');

    try {
      await api.request(`/accounts/${id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ amount: withdrawAmount }),
      });
      setWithdrawAmount('');
      setSuccess('Withdrawal processed successfully.');
      await loadData();
    } catch (err) {
      setError((err as Error).message || 'Withdrawal failed.');
    } finally {
      setSubmitting(null);
    }
  };

  const totalTransactions = useMemo(() => transactions.length, [transactions]);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Account details</p>
          <h1>{account ? `${account.currency} account` : 'Account'}</h1>
        </div>

        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">{success}</div>}

        {loading ? (
          <div className="card info-card">Loading account details...</div>
        ) : !account ? (
          <div className="card info-card">Account not found.</div>
        ) : (
          <>
            <div className="card section-card">
              <div className="account-overview">
                <div>
                  <span className="eyebrow">Account ID</span>
                  <h2>{maskAccountId(account.id)}</h2>
                </div>
                <span className={`status-badge ${account.status.toLowerCase()}`}>{account.status}</span>
              </div>

              <div className="stats-grid compact-grid">
                <div className="card stat-card">
                  <span>Balance</span>
                  <strong>{formatCurrency(account.balance, account.currency)}</strong>
                </div>
                <div className="card stat-card">
                  <span>Currency</span>
                  <strong>{account.currency}</strong>
                </div>
                <div className="card stat-card">
                  <span>Transactions</span>
                  <strong>{totalTransactions}</strong>
                </div>
              </div>
            </div>

            <div className="two-col">
              <div className="card section-card">
                <div className="section-header"><h2>Deposit</h2></div>
                <form onSubmit={handleDeposit} className="stack-form">
                  <label>
                    Amount
                    <input type="number" step="0.01" min="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="100.00" required />
                  </label>
                  <button type="submit" disabled={submitting === 'deposit'}>{submitting === 'deposit' ? 'Processing...' : 'Deposit'}</button>
                </form>
              </div>

              <div className="card section-card">
                <div className="section-header"><h2>Withdraw</h2></div>
                <form onSubmit={handleWithdraw} className="stack-form">
                  <label>
                    Amount
                    <input type="number" step="0.01" min="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="100.00" required />
                  </label>
                  <button type="submit" disabled={submitting === 'withdraw'}>{submitting === 'withdraw' ? 'Processing...' : 'Withdraw'}</button>
                </form>
              </div>
            </div>

            <div className="card section-card">
              <div className="section-header">
                <h2>Recent transactions</h2>
                <Link to="/transfer">Transfer funds</Link>
              </div>

              {transactions.length === 0 ? (
                <p className="empty-text">No activity on this account yet.</p>
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
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{formatTransactionType(transaction.type)}</td>
                          <td>{typeof transaction.metadata?.description === 'string' ? transaction.metadata.description : 'Account activity'}</td>
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
