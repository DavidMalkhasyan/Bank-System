import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Coins,
  DatabaseZap,
  Github,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

import { AccountCard } from '../components/AccountCard';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/Theme';
import { useToast } from '../components/Toast';
import { Button, Card } from '../components/ui';
import { errorMessage } from '../lib/api';
import { login } from '../lib/queries';
import { useAppSelector } from '../store';
import { DEMO_ACCOUNTS } from './LoginPage';

const REPO_URL = 'https://github.com/DavidMalkhasyan/Bank-System';

const features = [
  { icon: Zap, title: 'Instant, atomic transfers', text: 'Every transfer runs in one PostgreSQL transaction with row-level locks, so balances can never go negative — even under concurrent requests.' },
  { icon: LockKeyhole, title: 'Secure sessions', text: 'Short-lived JWT access tokens, rotating refresh tokens with reuse detection, bcrypt hashing and rate-limited sign-in.' },
  { icon: BarChart3, title: 'Cash flow insights', text: 'Daily money in and out, a reconstructed balance history and grouped activity — all computed in SQL.' },
  { icon: Coins, title: 'Multi-currency accounts', text: 'Open checking and savings accounts in USD, EUR or AMD, each with its own 16-digit account number.' },
  { icon: ShieldCheck, title: 'Back office & audit trail', text: 'Admins see platform metrics, freeze suspicious accounts and review an append-only audit log of every action.' },
  { icon: DatabaseZap, title: 'Built to be tested', text: 'Integration tests cover auth, rounding, overdraft protection, deadlock-free concurrent transfers and rollbacks.' },
];

const stack = ['React 18', 'TypeScript', 'Redux Toolkit', 'TanStack Query', 'Recharts', 'Node.js', 'Express', 'PostgreSQL', 'Redis', 'Zod', 'Vitest', 'Docker'];

const sparkline = [32, 38, 35, 44, 41, 52, 48, 58, 55, 66, 63, 74];

function ProductPreview() {
  const max = Math.max(...sparkline);
  const points = sparkline.map((value, index) => `${(index / (sparkline.length - 1)) * 100},${100 - (value / max) * 90}`).join(' ');
  return (
    <div className="preview" aria-hidden>
      <div className="preview-grid">
        <AccountCard
          link={false}
          account={{ id: 'p', accountNumber: '4000123412344821', name: 'Everyday Checking', type: 'CHECKING', currency: 'USD', balance: '12480.32', status: 'ACTIVE', createdAt: '', updatedAt: '', closedAt: null }}
        />
        <div className="preview-mini">
          <div className="row-between">
            <span className="small muted strong">Balance · 30 days</span>
            <span className="badge badge-success no-dot">+18.4%</span>
          </div>
          <div className="preview-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
              <defs>
                <linearGradient id="previewFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,100 ${points} 100,100`} fill="url(#previewFill)" />
              <polyline points={points} fill="none" stroke="var(--chart-line)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        </div>
      </div>
      <div className="preview-mini" style={{ marginTop: 14 }}>
        {[
          { icon: ArrowDownLeft, tone: 'credit', title: 'Payroll · Northwind Labs', sub: 'Today, 9:02 AM', amount: '+$2,950.00' },
          { icon: ArrowUpRight, tone: 'debit', title: 'Transfer to Sam L.', sub: 'Yesterday', amount: '−$120.00' },
          { icon: ArrowUpRight, tone: 'debit', title: 'Green Basket Grocery', sub: 'Yesterday', amount: '−$64.18' },
        ].map((row) => (
          <div key={row.title} className="preview-tx">
            <span className={`tx-icon ${row.tone}`} style={{ width: 34, height: 34 }}>
              <row.icon size={16} />
            </span>
            <div className="grow">
              <div className="strong">{row.title}</div>
              <div className="faint tiny">{row.sub}</div>
            </div>
            <span className={`strong num ${row.tone === 'credit' ? 'positive' : ''}`}>{row.amount}</span>
          </div>
        ))}
      </div>
      <div className="preview-float one">
        <span className="tx-icon credit" style={{ width: 34, height: 34 }}>
          <CheckCircle2 size={17} />
        </span>
        <div>
          <div className="strong">Transfer sent</div>
          <div className="faint tiny">$250.00 to Priya S.</div>
        </div>
      </div>
      <div className="preview-float two">
        <span className="tx-icon internal" style={{ width: 34, height: 34 }}>
          <KeyRound size={17} />
        </span>
        <div>
          <div className="strong">Session secured</div>
          <div className="faint tiny">Token rotated</div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const isAuthenticated = useAppSelector((state) => Boolean(state.auth.accessToken));
  const [pending, setPending] = useState<'customer' | 'admin' | null>(null);

  const tryDemo = async (kind: 'customer' | 'admin') => {
    if (isAuthenticated) {
      navigate('/app');
      return;
    }
    setPending(kind);
    try {
      await login(DEMO_ACCOUNTS[kind].email, DEMO_ACCOUNTS[kind].password);
      navigate(kind === 'admin' ? '/app/admin' : '/app');
    } catch (error) {
      toast.error('Could not start the demo', errorMessage(error));
      setPending(null);
    }
  };

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Logo />
        <div className="landing-nav-links">
          <a className="btn btn-ghost hide-sm" href={REPO_URL} target="_blank" rel="noreferrer">
            <Github /> Source
          </a>
          <ThemeToggle />
          {isAuthenticated ? (
            <Link className="btn btn-primary" to="/app">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary hide-sm" to="/register">
                Open account
              </Link>
            </>
          )}
        </div>
      </nav>

      <header className="landing-hero">
        <div>
          <span className="eyebrow">
            <Sparkles /> Full-stack banking demo
          </span>
          <h1 className="landing-title">
            Banking that feels <span className="gradient-text">effortless.</span>
          </h1>
          <p className="landing-lead">
            Ledgerly is a complete digital bank: multi-currency accounts, instant transfers, live cash flow analytics and a back office —
            built with React, Node.js and PostgreSQL.
          </p>
          <div className="landing-ctas">
            <Button size="lg" icon={<ArrowRight />} loading={pending === 'customer'} disabled={pending !== null} onClick={() => tryDemo('customer')}>
              {isAuthenticated ? 'Open dashboard' : 'Try the live demo'}
            </Button>
            {!isAuthenticated && (
              <Button size="lg" variant="secondary" icon={<ShieldCheck />} loading={pending === 'admin'} disabled={pending !== null} onClick={() => tryDemo('admin')}>
                Explore as admin
              </Button>
            )}
          </div>
          <div className="landing-proof">
            <span><CheckCircle2 /> No sign-up needed</span>
            <span><CheckCircle2 /> 33 integration tests</span>
            <span><CheckCircle2 /> Light &amp; dark mode</span>
          </div>
        </div>
        <ProductPreview />
      </header>

      <section className="landing-section">
        <div className="section-head">
          <h2>Everything a modern bank needs</h2>
          <p>Designed like a product, engineered like a ledger: correctness first, then speed, then polish.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="feature">
              <div className="feature-icon">
                <Icon />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="section-head" style={{ marginBottom: 24 }}>
          <h2>Built with</h2>
        </div>
        <div className="stack-strip">
          {stack.map((item) => (
            <span key={item} className="stack-pill">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="cta-band">
          <div>
            <h2>See it in action</h2>
            <p>Sign in as a demo customer with four months of realistic history.</p>
          </div>
          <div className="row wrap">
            <Button size="lg" variant="secondary" icon={<ArrowRight />} loading={pending === 'customer'} disabled={pending !== null} onClick={() => tryDemo('customer')}>
              Launch demo
            </Button>
            <Link className="btn btn-lg btn-ghost" style={{ color: '#fff' }} to="/register">
              Create my own account
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Ledgerly — a portfolio project. No real money is involved.</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          View source on GitHub
        </a>
      </footer>
    </div>
  );
}
