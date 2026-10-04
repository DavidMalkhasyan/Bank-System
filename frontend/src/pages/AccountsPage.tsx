import { Plus } from 'lucide-react';

import { AccountCard } from '../components/AccountCard';
import { useActions } from '../components/AppLayout';
import { Alert, Button, Card, PageHeader, Skeleton } from '../components/ui';
import { errorMessage } from '../lib/api';
import { formatMoney, totalsByCurrency } from '../lib/format';
import { useAccounts } from '../lib/queries';

export default function AccountsPage() {
  const actions = useActions();
  const accounts = useAccounts();
  const items = accounts.data ?? [];
  const open = items.filter((account) => account.status !== 'CLOSED');
  const closed = items.filter((account) => account.status === 'CLOSED');
  const totals = [...totalsByCurrency(items)];

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="All your checking and savings accounts in one place."
        actions={
          <Button icon={<Plus />} onClick={actions.openNewAccount}>
            Open account
          </Button>
        }
      />

      {accounts.isError && <Alert>{errorMessage(accounts.error)}</Alert>}

      {totals.length > 0 && (
        <div className="grid grid-3" style={{ marginBottom: 24 }}>
          {totals.map(([currency, total]) => (
            <Card key={currency} className="stat-card">
              <span className="stat-label">Total in {currency}</span>
              <span className="stat-value">{formatMoney(total, currency)}</span>
              <span className="stat-foot">
                {open.filter((account) => account.currency === currency).length} account(s)
              </span>
            </Card>
          ))}
        </div>
      )}

      <div className="accounts-grid">
        {accounts.isLoading
          ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={190} radius={20} />)
          : open.map((account) => <AccountCard key={account.id} account={account} />)}
        {!accounts.isLoading && (
          <button type="button" className="add-card" onClick={actions.openNewAccount}>
            <Plus />
            Open a new account
          </button>
        )}
      </div>

      {closed.length > 0 && (
        <>
          <h2 className="card-title" style={{ margin: '32px 0 14px' }}>
            Closed accounts
          </h2>
          <div className="accounts-grid">
            {closed.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
