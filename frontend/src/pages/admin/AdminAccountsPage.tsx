import { useEffect, useState } from 'react';
import { Search, Snowflake, Sun } from 'lucide-react';

import { AccountDot } from '../../components/AccountCard';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Alert, Button, Card, CopyButton, EmptyState, Field, Input, PageHeader, Pagination, Select, Skeleton, StatusBadge } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatAccountNumber, formatDate, formatMoney } from '../../lib/format';
import { useAdminAccounts, useSetAccountStatus } from '../../lib/queries';
import type { AccountStatus, AdminAccount } from '../../lib/types';
import { useDebouncedValue } from './AdminUsersPage';

export default function AdminAccountsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const accounts = useAdminAccounts({ page, search: debouncedSearch || undefined, status: status || undefined });
  const setAccountStatus = useSetAccountStatus();
  const [target, setTarget] = useState<AdminAccount | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => setPage(1), [debouncedSearch, status]);

  const freezing = target?.status === 'ACTIVE';

  const confirm = async () => {
    if (!target) return;
    try {
      await setAccountStatus.mutateAsync({ id: target.id, status: freezing ? 'FROZEN' : 'ACTIVE', reason });
      toast.success(freezing ? 'Account frozen' : 'Account unfrozen', `${target.owner.fullName} · ${target.name}`);
      setTarget(null);
    } catch {
      // Shown in dialog.
    }
  };

  return (
    <>
      <PageHeader title="All accounts" subtitle="Search accounts and freeze them during a security review." />
      {accounts.isError && <Alert>{errorMessage(accounts.error)}</Alert>}
      <Card>
        <div className="filters">
          <Input icon={<Search />} placeholder="Account number, name or owner" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search accounts" />
          <Select value={status} onChange={(event) => setStatus(event.target.value as AccountStatus | '')} aria-label="Status">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="FROZEN">Frozen</option>
            <option value="CLOSED">Closed</option>
          </Select>
        </div>
        <div className="table-wrap" style={{ opacity: accounts.isPlaceholderData ? 0.6 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Owner</th>
                <th>Number</th>
                <th className="align-right">Balance</th>
                <th>Status</th>
                <th>Opened</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {accounts.isLoading
                ? Array.from({ length: 6 }, (_, index) => (
                    <tr key={index}>
                      <td colSpan={7}><Skeleton height={28} /></td>
                    </tr>
                  ))
                : accounts.data?.items.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="table-cell-main">
                          <AccountDot account={account} />
                          <div>
                            <div className="strong nowrap">{account.name}</div>
                            <div className="small muted">{account.type === 'SAVINGS' ? 'Savings' : 'Checking'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="strong nowrap">{account.owner.fullName}</div>
                        <div className="small muted">{account.owner.email}</div>
                      </td>
                      <td className="num nowrap">
                        {formatAccountNumber(account.accountNumber)} <CopyButton value={account.accountNumber} label="Copy account number" />
                      </td>
                      <td className="align-right strong num nowrap">{formatMoney(account.balance, account.currency)}</td>
                      <td><StatusBadge status={account.status} /></td>
                      <td className="muted nowrap">{formatDate(account.createdAt)}</td>
                      <td className="align-right">
                        {account.status !== 'CLOSED' && (
                          <Button
                            variant={account.status === 'ACTIVE' ? 'secondary' : 'soft'}
                            size="sm"
                            icon={account.status === 'ACTIVE' ? <Snowflake /> : <Sun />}
                            onClick={() => {
                              setReason('');
                              setAccountStatus.reset();
                              setTarget(account);
                            }}
                          >
                            {account.status === 'ACTIVE' ? 'Freeze' : 'Unfreeze'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {accounts.data?.items.length === 0 && <EmptyState icon={<Search />} title="No accounts match these filters" />}
        {accounts.data && accounts.data.meta.total > 0 && (
          <Pagination page={page} totalPages={accounts.data.meta.totalPages} total={accounts.data.meta.total} onPage={setPage} noun="accounts" />
        )}
      </Card>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={freezing ? 'Freeze this account?' : 'Unfreeze this account?'}
        description={
          target && `${target.owner.fullName} · ${target.name} · ${formatMoney(target.balance, target.currency)}`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button variant={freezing ? 'danger' : 'primary'} loading={setAccountStatus.isPending} onClick={confirm}>
              {freezing ? 'Freeze account' : 'Unfreeze account'}
            </Button>
          </>
        }
      >
        {setAccountStatus.isError && <Alert>{errorMessage(setAccountStatus.error)}</Alert>}
        <p className="muted">
          {freezing
            ? 'The customer will not be able to deposit, withdraw, send or receive money until the account is unfrozen.'
            : 'The customer will be able to use this account again immediately.'}
        </p>
        <Field label="Reason" hint="Saved to the audit log" htmlFor="freeze-reason">
          <Input id="freeze-reason" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} placeholder={freezing ? 'e.g. Unusual activity review' : 'e.g. Review completed'} />
        </Field>
      </Modal>
    </>
  );
}
