import { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';

import { TransactionList } from '../components/TransactionList';
import { useToast } from '../components/Toast';
import { Alert, Button, Card, EmptyState, Input, PageHeader, Pagination, Segmented, Select } from '../components/ui';
import { errorMessage } from '../lib/api';
import { describeTransaction } from '../lib/format';
import { fetchTransactions, useAccounts, useTransactions, type TransactionFilter } from '../lib/queries';
import type { TransactionType } from '../lib/types';

type TypeFilter = 'ALL' | TransactionType;

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export default function TransactionsPage() {
  const toast = useToast();
  const accounts = useAccounts();
  const [type, setType] = useState<TypeFilter>('ALL');
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebounced(search.trim());

  const filter: TransactionFilter = {
    page,
    pageSize: 20,
    type: type === 'ALL' ? undefined : type,
    accountId: accountId || undefined,
    search: debouncedSearch || undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const transactions = useTransactions(filter);

  useEffect(() => setPage(1), [type, accountId, debouncedSearch, from, to]);

  const hasFilters = type !== 'ALL' || accountId || search || from || to;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { items } = await fetchTransactions({ ...filter, page: 1, pageSize: 100 });
      const header = ['Date', 'Type', 'Description', 'Direction', 'Amount', 'Currency', 'Reference'];
      const rows = items.map((transaction) => [
        new Date(transaction.createdAt).toISOString(),
        transaction.type,
        describeTransaction(transaction).title,
        transaction.direction,
        transaction.direction === 'DEBIT' ? `-${transaction.amount}` : transaction.amount,
        transaction.currency,
        transaction.reference,
      ]);
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledgerly-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export ready', `${items.length} transactions downloaded.`);
    } catch (error) {
      toast.error('Export failed', errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Search and filter every transaction across your accounts."
        actions={
          <Button variant="secondary" icon={<Download />} loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      {transactions.isError && <Alert>{errorMessage(transactions.error)}</Alert>}

      <Card>
        <div className="filters">
          <Input icon={<Search />} placeholder="Search description or person" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search transactions" />
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label="Account">
            <option value="">All accounts</option>
            {(accounts.data ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
          <Input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
          <Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
        </div>
        <div className="filters" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <Segmented
            label="Transaction type"
            value={type}
            onChange={setType}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'TRANSFER', label: 'Transfers' },
              { value: 'DEPOSIT', label: 'Deposits' },
              { value: 'WITHDRAWAL', label: 'Withdrawals' },
            ]}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setType('ALL');
                setAccountId('');
                setSearch('');
                setFrom('');
                setTo('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div style={{ opacity: transactions.isPlaceholderData ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          {transactions.data?.items.length === 0 ? (
            <EmptyState icon={<Search />} title="No transactions found">
              {hasFilters ? 'Try a different search or clear the filters.' : 'Your activity will appear here.'}
            </EmptyState>
          ) : (
            <TransactionList transactions={transactions.data?.items} loading={transactions.isLoading} skeletonRows={10} />
          )}
        </div>
        {transactions.data && transactions.data.meta.total > 0 && (
          <Pagination page={page} totalPages={transactions.data.meta.totalPages} total={transactions.data.meta.total} onPage={setPage} noun="transactions" />
        )}
      </Card>
    </>
  );
}
