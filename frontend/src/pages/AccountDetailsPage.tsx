import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, MoreHorizontal, Pencil, Plus, Send, XCircle } from 'lucide-react';

import { AccountCard } from '../components/AccountCard';
import { useActions } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { TransactionList } from '../components/TransactionList';
import { Alert, Button, Card, CardHeader, CopyButton, EmptyState, Field, Input, Menu, PageHeader, Pagination, Skeleton, StatusBadge } from '../components/ui';
import { ApiError, errorMessage } from '../lib/api';
import { formatAccountNumber, formatDate } from '../lib/format';
import { useAccount, useCloseAccount, useRenameAccount, useTransactions } from '../lib/queries';

export default function AccountDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const actions = useActions();
  const account = useAccount(id);
  const [page, setPage] = useState(1);
  const transactions = useTransactions({ accountId: id, page, pageSize: 10 });
  const rename = useRenameAccount();
  const close = useCloseAccount();
  const [renameOpen, setRenameOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [name, setName] = useState('');

  const back = (
    <Link to="/app/accounts" className="back-link">
      <ArrowLeft /> Accounts
    </Link>
  );

  if (account.isError) {
    const notFound = account.error instanceof ApiError && account.error.status === 404;
    return (
      <>
        <PageHeader title="Account" back={back} />
        <Card>
          <EmptyState title={notFound ? 'Account not found' : 'Could not load this account'} action={<Link to="/app/accounts" className="btn btn-secondary">Back to accounts</Link>}>
            {notFound ? 'It may have been removed, or it belongs to someone else.' : errorMessage(account.error)}
          </EmptyState>
        </Card>
      </>
    );
  }

  const data = account.data;
  const isActive = data?.status === 'ACTIVE';

  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await rename.mutateAsync({ id, name });
      toast.success('Account renamed');
      setRenameOpen(false);
    } catch {
      // Shown in dialog.
    }
  };

  const confirmClose = async () => {
    try {
      await close.mutateAsync(id);
      toast.success('Account closed');
      setCloseOpen(false);
      navigate('/app/accounts');
    } catch {
      // Shown in dialog.
    }
  };

  return (
    <>
      <PageHeader
        back={back}
        title={data ? data.name : <Skeleton width={220} height={30} />}
        subtitle={data && `${data.type === 'SAVINGS' ? 'Savings' : 'Checking'} account · ${data.currency}`}
        actions={
          data && (
            <>
              <Button variant="secondary" icon={<Plus />} disabled={!isActive} onClick={() => actions.openDeposit(id)}>
                Deposit
              </Button>
              <Button variant="secondary" icon={<Minus />} disabled={!isActive} onClick={() => actions.openWithdraw(id)}>
                Withdraw
              </Button>
              <Button icon={<Send />} disabled={!isActive} onClick={() => navigate(`/app/transfer?from=${id}`)}>
                Transfer
              </Button>
              <Menu trigger={(props) => <Button variant="secondary" icon={<MoreHorizontal />} aria-label="More actions" {...props} />}>
                {(closeMenu) => (
                  <>
                    <button type="button" className="menu-item" onClick={() => { closeMenu(); setName(data.name); rename.reset(); setRenameOpen(true); }}>
                      <Pencil /> Rename
                    </button>
                    {data.status !== 'CLOSED' && (
                      <button type="button" className="menu-item danger" onClick={() => { closeMenu(); close.reset(); setCloseOpen(true); }}>
                        <XCircle /> Close account
                      </button>
                    )}
                  </>
                )}
              </Menu>
            </>
          )
        }
      />

      {data?.status === 'FROZEN' && (
        <div style={{ marginBottom: 20 }}>
          <Alert tone="info">This account is frozen by our security team. Deposits, withdrawals and transfers are paused.</Alert>
        </div>
      )}

      <div className="grid grid-main" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Activity" subtitle="Everything that moved in or out of this account." />
          <div style={{ padding: '6px 0 0' }}>
            {transactions.data?.items.length === 0 ? (
              <EmptyState title="No activity yet">Make a deposit to get started.</EmptyState>
            ) : (
              <TransactionList transactions={transactions.data?.items} loading={transactions.isLoading} />
            )}
          </div>
          {transactions.data && transactions.data.meta.totalPages > 1 && (
            <Pagination page={page} totalPages={transactions.data.meta.totalPages} total={transactions.data.meta.total} onPage={setPage} noun="transactions" />
          )}
        </Card>

        <div className="stack">
          {data ? <AccountCard account={data} link={false} showFullNumber /> : <Skeleton height={190} radius={20} />}
          <Card className="card-pad">
            {data ? (
              <div className="detail-list" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <div className="detail-label">Account number</div>
                  <div className="detail-value num">
                    {formatAccountNumber(data.accountNumber)}
                    <CopyButton value={data.accountNumber} label="Copy account number" />
                  </div>
                  <div className="field-hint">Share it to receive transfers from other Ledgerly customers.</div>
                </div>
                <div>
                  <div className="detail-label">Status</div>
                  <div className="detail-value"><StatusBadge status={data.status} /></div>
                </div>
                <div>
                  <div className="detail-label">Opened</div>
                  <div className="detail-value">{formatDate(data.createdAt)}</div>
                </div>
                {data.closedAt && (
                  <div>
                    <div className="detail-label">Closed</div>
                    <div className="detail-value">{formatDate(data.closedAt)}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="stack">
                <Skeleton height={40} />
                <Skeleton height={40} />
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename account"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button type="submit" form="rename-form" loading={rename.isPending} disabled={!name.trim()}>Save</Button>
          </>
        }
      >
        <form id="rename-form" onSubmit={submitRename} className="stack">
          {rename.isError && <Alert>{errorMessage(rename.error)}</Alert>}
          <Field label="Account name" htmlFor="account-name">
            <Input id="account-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Close this account?"
        description="Closed accounts can’t receive or send money. Your history stays available."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseOpen(false)}>Keep account</Button>
            <Button variant="danger" loading={close.isPending} onClick={confirmClose}>Close account</Button>
          </>
        }
      >
        {close.isError ? <Alert>{errorMessage(close.error)}</Alert> : <p className="muted">The balance must be zero before an account can be closed.</p>}
      </Modal>
    </>
  );
}
