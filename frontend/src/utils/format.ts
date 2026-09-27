export const formatCurrency = (value: number | string, currency: string = 'USD') => {
  const amount = typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(Number.isFinite(amount) ? amount : 0);
};

export const formatDate = (value?: string | null) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const maskAccountId = (value?: string | null) => {
  if (!value) return '—';
  const tail = value.slice(-4);
  return `**** ${tail}`;
};

export const formatStatus = (value?: string | null) => value ? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : 'Unknown';

export const formatTransactionType = (value?: string | null) => {
  if (!value) return 'Transaction';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};
