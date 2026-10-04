import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, Minus, Plus, Send, Wallet } from 'lucide-react';

import { AccountCard } from '../components/AccountCard';
import { useActions } from '../components/AppLayout';
import { CashflowChart } from '../components/CashflowChart';
import { TransactionList } from '../components/TransactionList';
import { Alert, Card, CardHeader, EmptyState, Segmented, Skeleton } from '../components/ui';
import { errorMessage } from '../lib/api';
import { formatMoney, greeting, totalsByCurrency } from '../lib/format';
import { useAccounts, useCashflow, useTransactions } from '../lib/queries';
import type { Currency } from '../lib/types';
import { useAppSelector } from '../store';

const HIDE_KEY = 'ledgerly_hide_balance';

function BalanceAmount({ value, currency, hidden }: { value: number; currency: Currency; hidden: boolean }) {
  if (hidden) return <div className="balance-amount">••••••</div>;
  const formatted = formatMoney(value, currency);
  const dot = formatted.lastIndexOf('.');
  return (
    <div className="balance-amount">
      {dot > 0 ? formatted.slice(0, dot) : formatted}
      {dot > 0 && <span className="cents">{formatted.slice(dot)}</span>}
    </div>
  );
}

export default function DashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const actions = useActions();
  const accounts = useAccounts();
  const recent = useTransactions({ page: 1, pageSize: 8 });
  const [chartMode, setChartMode] = useState<'balance' | 'flow'>('balance');
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const totals = useMemo(() => totalsByCurrency(accounts.data ?? []), [accounts.data]);
  const currencies = useMemo(() => [...totals.keys()], [totals]);
  const [currency, setCurrency] = useState<Currency | undefined>();
  useEffect(() => {
    if (!currency || !currencies.includes(currency)) setCurrency(currencies.includes('USD') ? 'USD' : currencies[0]);
  }, [currencies, currency]);

  const cashflow = useCashflow(currency, 30);
  const activeAccounts = (accounts.data ?? []).filter((account) => account.status !== 'CLOSED');

  const toggleHidden = () => {
    setHidden((value) => {
      try {
        localStorage.setItem(HIDE_KEY, value ? '0' : '1');
      } catch {
        // Preference just won't persist.
      }
      return !value;
    });
  };

  const firstName = user?.fullName.split(' ')[0] ?? 'there';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting()}, {firstName}
          </h1>
          <p className="page-subtitle">Here’s what’s happening with your money.</p>
        </div>
      </div>

      {accounts.isError && <Alert>{errorMessage(accounts.error)}</Alert>}

      <div className="grid grid-main" style={{ marginBottom: 20 }}>
        <div className="balance-hero">
          <div className="row-between">
            <div className="balance-label">
              Total balance
              <button type="button" className="eye-toggle" onClick={toggleHidden} aria-label={hidden ? 'Show balances' : 'Hide balances'}>
                {hidden ? <Eye /> : <EyeOff />}
              </button>
            </div>
            {currencies.length > 1 && (
              <div className="currency-tabs" role="group" aria-label="Currency">
                {currencies.map((code) => (
                  <button key={code} type="button" aria-pressed={code === currency} onClick={() => setCurrency(code)}>
                    {code}
                  </button>
                ))}
              </div>
            )}
          </div>
          {accounts.isLoading || !currency ? (
            <div style={{ margin: '14px 0 24px' }}>
              <Skeleton width={220} height={40} />
            </div>
          ) : (
            <>
              <BalanceAmount value={totals.get(currency) ?? 0} currency={currency} hidden={hidden} />
              <p className="balance-meta">
                Across {activeAccounts.filter((account) => account.currency === currency).length} {currency} account
                {activeAccounts.filter((account) => account.currency === currency).length === 1 ? '' : 's'}
                {cashflow.data && !hidden && ` · ${Number(cashflow.data.totals.net) >= 0 ? '+' : ''}${formatMoney(cashflow.data.totals.net, cashflow.data.currency)} net over 30 days`}
              </p>
            </>
          )}
          <div className="balance-flows">
            <div className="balance-flow">
              <ArrowDownLeft />
              <div>
                <div className="flow-label">Money in · 30d</div>
                <div className="flow-value">{cashflow.data && !hidden ? formatMoney(cashflow.data.totals.income, cashflow.data.currency) : '—'}</div>
              </div>
            </div>
            <div className="balance-flow">
              <ArrowUpRight />
              <div>
                <div className="flow-label">Money out · 30d</div>
                <div className="flow-value">{cashflow.data && !hidden ? formatMoney(cashflow.data.totals.expense, cashflow.data.currency) : '—'}</div>
              </div>
            </div>
          </div>
        </div>

        <Card className="card-pad">
          <div className="stack" style={{ height: '100%' }}>
            <div>
              <h2 className="card-title">Quick actions</h2>
              <p className="card-subtitle">Move money in a couple of taps.</p>
            </div>
            <div className="quick-actions" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <Link to="/app/transfer" className="quick-action">
                <span className="quick-action-icon"><Send /></span>
                Send
              </Link>
              <button type="button" className="quick-action" onClick={() => actions.openDeposit()}>
                <span className="quick-action-icon green"><Plus /></span>
                Deposit
              </button>
              <button type="button" className="quick-action" onClick={() => actions.openWithdraw()}>
                <span className="quick-action-icon red"><Minus /></span>
                Withdraw
              </button>
              <button type="button" className="quick-action" onClick={actions.openNewAccount}>
                <span className="quick-action-icon amber"><Wallet /></span>
                New account
              </button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Cash flow"
          subtitle={currency ? `Last 30 days · ${currency}` : 'Last 30 days'}
          action={
            <Segmented
              label="Chart type"
              value={chartMode}
              onChange={setChartMode}
              options={[
                { value: 'balance', label: 'Balance' },
                { value: 'flow', label: 'In & out' },
              ]}
            />
          }
        />
        <div className="card-body">
          {chartMode === 'flow' && (
            <div className="legend" style={{ marginBottom: 8 }}>
              <span><i style={{ background: 'var(--chart-income)' }} /> Money in</span>
              <span><i style={{ background: 'var(--chart-expense)' }} /> Money out</span>
            </div>
          )}
          <CashflowChart data={cashflow.data} mode={chartMode} loading={cashflow.isLoading || !currency} />
        </div>
      </Card>

      <div className="grid grid-main" style={{ marginTop: 20 }}>
        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link to="/app/transactions" className="card-link">
                View all <ArrowRight />
              </Link>
            }
          />
          <div style={{ padding: '6px 0 10px' }}>
            {recent.data?.items.length === 0 ? (
              <EmptyState title="No activity yet">Deposits, withdrawals and transfers will show up here.</EmptyState>
            ) : (
              <TransactionList transactions={recent.data?.items} loading={recent.isLoading} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Your accounts"
            action={
              <Link to="/app/accounts" className="card-link">
                Manage <ArrowRight />
              </Link>
            }
          />
          <div className="card-body stack">
            {accounts.isLoading
              ? Array.from({ length: 2 }, (_, index) => <Skeleton key={index} height={190} radius={20} />)
              : activeAccounts.slice(0, 3).map((account) => <AccountCard key={account.id} account={account} hideBalance={hidden} />)}
            <button type="button" className="add-card" style={{ minHeight: 110 }} onClick={actions.openNewAccount}>
              <Plus />
              Open another account
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
