import { useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Wallet } from 'lucide-react';

import { describeTransaction, formatAccountNumber, formatDateTime, formatDayLabel, formatMoney, formatTime, signedAmount } from '../lib/format';
import type { Transaction } from '../lib/types';
import { Modal } from './Modal';
import { Badge, Skeleton } from './ui';

export function TransactionIcon({ transaction }: { transaction: Transaction }) {
  const tone = transaction.direction === 'CREDIT' ? 'credit' : transaction.direction === 'DEBIT' ? 'debit' : 'internal';
  const Icon =
    transaction.type === 'DEPOSIT'
      ? Banknote
      : transaction.type === 'WITHDRAWAL'
        ? Wallet
        : transaction.direction === 'INTERNAL'
          ? ArrowLeftRight
          : transaction.direction === 'CREDIT'
            ? ArrowDownLeft
            : ArrowUpRight;
  return (
    <span className={`tx-icon ${tone}`} aria-hidden>
      <Icon />
    </span>
  );
}

export function TransactionAmount({ transaction }: { transaction: Transaction }) {
  const value = signedAmount(transaction);
  const isInternal = transaction.direction === 'INTERNAL';
  return (
    <span className={`tx-amount-value ${transaction.direction === 'CREDIT' ? 'credit' : ''}`}>
      {isInternal ? formatMoney(value, transaction.currency) : formatMoney(value, transaction.currency, { sign: true })}
    </span>
  );
}

function TransactionRow({ transaction, onSelect, showDate }: { transaction: Transaction; onSelect: (transaction: Transaction) => void; showDate?: boolean }) {
  const { title, subtitle } = describeTransaction(transaction);
  return (
    <button type="button" className="tx-row" onClick={() => onSelect(transaction)}>
      <TransactionIcon transaction={transaction} />
      <div className="tx-main">
        <div className="tx-title">{title}</div>
        <div className="tx-subtitle">{subtitle}</div>
      </div>
      <div className="tx-amount">
        <TransactionAmount transaction={transaction} />
        <div className="tx-time">{showDate ? formatDayLabel(transaction.createdAt) : formatTime(transaction.createdAt)}</div>
      </div>
    </button>
  );
}

interface TransactionListProps {
  transactions: Transaction[] | undefined;
  loading?: boolean;
  /** Group rows under "Today", "Yesterday", ... headings. */
  grouped?: boolean;
  skeletonRows?: number;
}

export function TransactionList({ transactions, loading, grouped = true, skeletonRows = 6 }: TransactionListProps) {
  const [selected, setSelected] = useState<Transaction | null>(null);

  if (loading && !transactions) {
    return (
      <div>
        {Array.from({ length: skeletonRows }, (_, index) => (
          <div key={index} className="tx-row" style={{ cursor: 'default' }}>
            <Skeleton width={40} height={40} radius={12} />
            <div className="tx-main stack-sm">
              <Skeleton width="45%" height={14} />
              <Skeleton width="30%" height={12} />
            </div>
            <Skeleton width={70} height={14} />
          </div>
        ))}
      </div>
    );
  }

  const items = transactions ?? [];
  const groups: { label: string; items: Transaction[] }[] = [];
  if (grouped) {
    for (const transaction of items) {
      const label = formatDayLabel(transaction.createdAt);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(transaction);
      else groups.push({ label, items: [transaction] });
    }
  }

  return (
    <>
      {grouped
        ? groups.map((group) => (
            <div key={group.label}>
              <div className="tx-group-label">{group.label}</div>
              {group.items.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} onSelect={setSelected} />
              ))}
            </div>
          ))
        : items.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onSelect={setSelected} showDate />)}
      <TransactionDetails transaction={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function partyLabel(party: Transaction['source']) {
  if (!party) return '—';
  const number = party.accountNumber.startsWith('•') ? party.accountNumber : formatAccountNumber(party.accountNumber);
  const name = party.isOwn ? party.accountName : party.ownerName;
  return `${name ?? 'Account'} · ${number}`;
}

export function TransactionDetails({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  if (!transaction) return null;
  const { title } = describeTransaction(transaction);
  return (
    <Modal open onClose={onClose} title="Transaction details">
      <div className="receipt">
        <TransactionIcon transaction={transaction} />
        <div className="receipt-amount">
          <TransactionAmount transaction={transaction} />
        </div>
        <div className="strong">{title}</div>
        <Badge tone="success">{transaction.status.charAt(0) + transaction.status.slice(1).toLowerCase()}</Badge>
      </div>
      <div className="receipt-rows">
        <div className="receipt-row">
          <span>Type</span>
          <span>{transaction.type.charAt(0) + transaction.type.slice(1).toLowerCase()}</span>
        </div>
        {transaction.source && (
          <div className="receipt-row">
            <span>From</span>
            <span>{partyLabel(transaction.source)}</span>
          </div>
        )}
        {transaction.destination && (
          <div className="receipt-row">
            <span>To</span>
            <span>{partyLabel(transaction.destination)}</span>
          </div>
        )}
        <div className="receipt-row">
          <span>Date</span>
          <span>{formatDateTime(transaction.createdAt)}</span>
        </div>
        <div className="receipt-row">
          <span>Reference</span>
          <span className="mono">{transaction.reference}</span>
        </div>
      </div>
    </Modal>
  );
}
