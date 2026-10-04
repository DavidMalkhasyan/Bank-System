import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

import { TransactionDetails, TransactionIcon } from '../../components/TransactionList';
import { Alert, Badge, Card, EmptyState, Input, PageHeader, Pagination, Segmented, Skeleton } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatDateTime, formatMoney, maskAccountNumber, titleCase } from '../../lib/format';
import { useAdminTransactions } from '../../lib/queries';
import type { Party, Transaction, TransactionType } from '../../lib/types';
import { useDebouncedValue } from './AdminUsersPage';

function PartyCell({ party }: { party: Party | null }) {
  if (!party) return <span className="faint">Cash</span>;
  return (
    <div>
      <div className="strong nowrap">{party.ownerName}</div>
      <div className="small muted nowrap">{party.accountName} · {maskAccountNumber(party.accountNumber)}</div>
    </div>
  );
}

export default function AdminTransactionsPage() {
  const [type, setType] = useState<'ALL' | TransactionType>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const transactions = useAdminTransactions({ page, search: debouncedSearch || undefined, type: type === 'ALL' ? undefined : type });

  useEffect(() => setPage(1), [debouncedSearch, type]);

  return (
    <>
      <PageHeader title="All transactions" subtitle="Every movement of money across the platform." />
      {transactions.isError && <Alert>{errorMessage(transactions.error)}</Alert>}
      <Card>
        <div className="filters">
          <Input icon={<Search />} placeholder="Search description or customer" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search transactions" />
          <Segmented
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'TRANSFER', label: 'Transfers' },
              { value: 'DEPOSIT', label: 'Deposits' },
              { value: 'WITHDRAWAL', label: 'Withdrawals' },
            ]}
          />
        </div>
        <div className="table-wrap" style={{ opacity: transactions.isPlaceholderData ? 0.6 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>From</th>
                <th>To</th>
                <th className="align-right">Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.isLoading
                ? Array.from({ length: 8 }, (_, index) => (
                    <tr key={index}>
                      <td colSpan={5}><Skeleton height={28} /></td>
                    </tr>
                  ))
                : transactions.data?.items.map((transaction) => (
                    <tr key={transaction.id} className="clickable" onClick={() => setSelected(transaction)}>
                      <td>
                        <div className="table-cell-main">
                          <TransactionIcon transaction={transaction} />
                          <div style={{ minWidth: 0 }}>
                            <div className="strong ellipsis" style={{ maxWidth: 240 }}>{transaction.description ?? titleCase(transaction.type)}</div>
                            <div className="row" style={{ gap: 6 }}>
                              <Badge dot={false}>{titleCase(transaction.type)}</Badge>
                              <span className="tiny faint mono">{transaction.reference}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><PartyCell party={transaction.source} /></td>
                      <td><PartyCell party={transaction.destination} /></td>
                      <td className="align-right strong num nowrap">{formatMoney(transaction.amount, transaction.currency)}</td>
                      <td className="muted nowrap">{formatDateTime(transaction.createdAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {transactions.data?.items.length === 0 && <EmptyState icon={<Search />} title="No transactions match these filters" />}
        {transactions.data && transactions.data.meta.total > 0 && (
          <Pagination page={page} totalPages={transactions.data.meta.totalPages} total={transactions.data.meta.total} onPage={setPage} noun="transactions" />
        )}
      </Card>
      <TransactionDetails transaction={selected} onClose={() => setSelected(null)} />
    </>
  );
}
