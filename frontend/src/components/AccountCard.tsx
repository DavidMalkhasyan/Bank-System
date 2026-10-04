import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { formatAccountNumber, formatMoney, maskAccountNumber } from '../lib/format';
import type { Account } from '../lib/types';

const GRADIENTS = {
  savings: ['linear-gradient(135deg, #0f766e 0%, #10b981 100%)', 'rgba(16, 185, 129, 0.8)'],
  USD: ['linear-gradient(135deg, #4338ca 0%, #7c3aed 100%)', 'rgba(99, 102, 241, 0.85)'],
  EUR: ['linear-gradient(135deg, #1d4ed8 0%, #06b6d4 100%)', 'rgba(37, 99, 235, 0.8)'],
  AMD: ['linear-gradient(135deg, #ea580c 0%, #e11d48 100%)', 'rgba(234, 88, 12, 0.8)'],
} as const;

/** Each account gets a consistent card color from its type and currency. */
export function accountStyle(account: Pick<Account, 'type' | 'currency'>): CSSProperties {
  const [gradient, shadow] = account.type === 'SAVINGS' ? GRADIENTS.savings : GRADIENTS[account.currency];
  return { '--card-gradient': gradient, '--card-shadow': shadow } as CSSProperties;
}

interface AccountCardProps {
  account: Account;
  link?: boolean;
  showFullNumber?: boolean;
  hideBalance?: boolean;
}

export function AccountCard({ account, link = true, showFullNumber, hideBalance }: AccountCardProps) {
  const statusClass = account.status === 'FROZEN' ? 'frozen' : account.status === 'CLOSED' ? 'closed' : '';
  const content = (
    <>
      <div className="bank-card-top">
        <div>
          <div className="bank-card-name">{account.name}</div>
          <div className="bank-card-type">{account.type === 'SAVINGS' ? 'Savings' : 'Checking'}</div>
        </div>
        {account.status === 'ACTIVE' ? <span className="bank-card-chip" aria-hidden /> : <span className="bank-card-status">{account.status}</span>}
      </div>
      <div>
        <div className="bank-card-balance">{hideBalance ? '••••••' : formatMoney(account.balance, account.currency)}</div>
      </div>
      <div className="bank-card-bottom">
        <span className="bank-card-number">{showFullNumber ? formatAccountNumber(account.accountNumber) : maskAccountNumber(account.accountNumber)}</span>
        <span className="bank-card-currency">{account.currency}</span>
      </div>
    </>
  );

  if (!link) {
    return (
      <div className={`bank-card ${statusClass}`} style={accountStyle(account)}>
        {content}
      </div>
    );
  }
  return (
    <Link to={`/app/accounts/${account.id}`} className={`bank-card ${statusClass}`} style={accountStyle(account)} aria-label={`${account.name}, ${formatMoney(account.balance, account.currency)}`}>
      {content}
    </Link>
  );
}

export function AccountDot({ account }: { account: Pick<Account, 'type' | 'currency'> }) {
  return (
    <span className="account-dot" style={accountStyle(account)} aria-hidden>
      {account.currency === 'USD' ? '$' : account.currency === 'EUR' ? '€' : '֏'}
    </span>
  );
}
