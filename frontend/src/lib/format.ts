import type { Account, Currency, Transaction } from './types';

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: string | number, currency: Currency | string = 'USD', options: { sign?: boolean; compact?: boolean } = {}) {
  const amount = typeof value === 'number' ? value : Number.parseFloat(value || '0');
  const key = `${currency}-${options.compact ? 'c' : 'f'}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: options.compact ? 'compact' : 'standard',
      minimumFractionDigits: options.compact ? 0 : 2,
      maximumFractionDigits: options.compact ? 1 : 2,
    });
    currencyFormatters.set(key, formatter);
  }
  const formatted = formatter.format(Math.abs(Number.isFinite(amount) ? amount : 0));
  if (options.sign) return `${amount < 0 ? '−' : '+'}${formatted}`;
  return amount < 0 ? `−${formatted}` : formatted;
}

export const currencySymbol = (currency: Currency | string) =>
  ({ USD: '$', EUR: '€', AMD: '֏' })[currency] ?? currency;

/** "4000123456789012" -> "4000 1234 5678 9012" */
export const formatAccountNumber = (value: string) => value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');

export const maskAccountNumber = (value: string) => (value.startsWith('•') ? value : `•••• ${value.slice(-4)}`);

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

export const formatDate = (value?: string | null) => (value ? dateFormatter.format(toDate(value)) : '—');
export const formatShortDate = (value: string) => shortDateFormatter.format(toDate(value));
export const formatTime = (value: string) => timeFormatter.format(toDate(value));
export const formatDateTime = (value?: string | null) => (value ? dateTimeFormatter.format(toDate(value)) : '—');

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Yesterday", or "Sep 28, 2026" — used to group activity lists. */
export function formatDayLabel(value: string) {
  const days = Math.round((startOfDay(new Date()) - startOfDay(toDate(value))) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(toDate(value));
  return formatDate(value);
}

export function formatRelative(value?: string | null) {
  if (!value) return 'Never';
  const seconds = Math.round((Date.now() - toDate(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

export const titleCase = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The headline and secondary line shown for a transaction from the viewer's point of view. */
export function describeTransaction(transaction: Transaction) {
  const { type, direction, source, destination, description } = transaction;
  if (type === 'DEPOSIT') return { title: description || 'Deposit', subtitle: `To ${destination?.accountName ?? 'account'}` };
  if (type === 'WITHDRAWAL') return { title: description || 'Withdrawal', subtitle: `From ${source?.accountName ?? 'account'}` };

  if (direction === 'INTERNAL') {
    return { title: description || 'Internal transfer', subtitle: `${source?.accountName ?? 'Account'} → ${destination?.accountName ?? 'Account'}` };
  }
  if (direction === 'DEBIT') {
    const to = destination?.isOwn ? destination.accountName : destination?.ownerName;
    return { title: description || `Transfer to ${to ?? 'recipient'}`, subtitle: `To ${to ?? 'recipient'} · ${maskAccountNumber(destination?.accountNumber ?? '')}` };
  }
  const from = source?.isOwn ? source.accountName : source?.ownerName;
  return { title: description || `Transfer from ${from ?? 'sender'}`, subtitle: `From ${from ?? 'sender'}` };
}

export const signedAmount = (transaction: Transaction) => {
  const amount = Number.parseFloat(transaction.amount);
  return transaction.direction === 'DEBIT' ? -amount : amount;
};

export const accountLabel = (account: Account) => `${account.name} · ${maskAccountNumber(account.accountNumber)}`;

export function totalsByCurrency(accounts: Account[]) {
  const totals = new Map<Currency, number>();
  for (const account of accounts) {
    if (account.status === 'CLOSED') continue;
    totals.set(account.currency, (totals.get(account.currency) ?? 0) + Number.parseFloat(account.balance));
  }
  return totals;
}
