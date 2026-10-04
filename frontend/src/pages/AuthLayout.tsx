import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { AccountCard } from '../components/AccountCard';
import { Logo } from '../components/Logo';
import type { Account } from '../lib/types';

const sampleCard = (overrides: Partial<Account>): Account => ({
  id: 'sample',
  accountNumber: '4000123412344821',
  name: 'Everyday Checking',
  type: 'CHECKING',
  currency: 'USD',
  balance: '12480.32',
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
  closedAt: null,
  ...overrides,
});

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Logo />
        <div className="auth-aside-content">
          <h2>Your money, moving at the speed of now.</h2>
          <p>Open accounts in seconds, send money instantly and see exactly where it goes.</p>
          <ul className="auth-points">
            <li><CheckCircle2 /> Instant transfers between any Ledgerly accounts</li>
            <li><CheckCircle2 /> Multi-currency accounts in USD, EUR and AMD</li>
            <li><CheckCircle2 /> Live cash flow insights and a full activity history</li>
          </ul>
          <div className="auth-cards" aria-hidden>
            <AccountCard link={false} account={sampleCard({ type: 'SAVINGS', name: 'High-Yield Savings', balance: '8400.00', accountNumber: '4000555566667777' })} />
            <AccountCard link={false} account={sampleCard({})} />
          </div>
        </div>
        <p className="small" style={{ color: 'rgba(255,255,255,0.45)' }}>
          A portfolio project — no real money is involved.
        </p>
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  );
}
