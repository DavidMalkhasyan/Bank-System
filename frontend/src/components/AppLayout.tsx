import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  CreditCard,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  ReceiptText,
  Send,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';

import { logout, useAccounts } from '../lib/queries';
import { useAppSelector } from '../store';
import { Logo } from './Logo';
import { MoneyModal } from './MoneyModal';
import { NewAccountModal } from './NewAccountModal';
import { ThemeToggle } from './Theme';
import { Avatar, Button } from './ui';

interface Actions {
  openDeposit: (accountId?: string) => void;
  openWithdraw: (accountId?: string) => void;
  openNewAccount: () => void;
}

const ActionsContext = createContext<Actions | null>(null);

/** Opens the shared deposit / withdraw / new-account dialogs from any page. */
export function useActions() {
  const context = useContext(ActionsContext);
  if (!context) throw new Error('useActions must be used inside AppLayout');
  return context;
}

const customerLinks = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/accounts', label: 'Accounts', icon: Wallet },
  { to: '/app/transfer', label: 'Send money', icon: Send },
  { to: '/app/transactions', label: 'Activity', icon: ReceiptText },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const adminLinks = [
  { to: '/app/admin', label: 'Admin overview', icon: ShieldCheck, end: true },
  { to: '/app/admin/users', label: 'Customers', icon: Users },
  { to: '/app/admin/accounts', label: 'All accounts', icon: CreditCard },
  { to: '/app/admin/transactions', label: 'All transactions', icon: ArrowLeftRight },
  { to: '/app/admin/audit', label: 'Audit log', icon: FileClock },
];

export function AppLayout() {
  const user = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [money, setMoney] = useState<{ kind: 'deposit' | 'withdraw' | null; accountId?: string }>({ kind: null });
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const accounts = useAccounts();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [navigate]);

  const actions = useMemo<Actions>(
    () => ({
      openDeposit: (accountId) => setMoney({ kind: 'deposit', accountId }),
      openWithdraw: (accountId) => setMoney({ kind: 'withdraw', accountId }),
      openNewAccount: () => setNewAccountOpen(true),
    }),
    [],
  );

  const renderLinks = (links: typeof customerLinks) =>
    links.map(({ to, label, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <Icon aria-hidden />
        {label}
      </NavLink>
    ));

  return (
    <ActionsContext.Provider value={actions}>
      <div className="app-shell">
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
          <div className="sidebar-header">
            <Logo to="/app" />
            <Button variant="ghost" size="sm" className="topbar-menu" icon={<X />} onClick={() => setMenuOpen(false)} aria-label="Close menu" style={{ color: 'var(--sidebar-text)' }} />
          </div>
          <nav className="sidebar-scroll">
            <div className="stack-sm" style={{ gap: 4 }}>
              {renderLinks(customerLinks)}
            </div>
            {user?.role === 'ADMIN' && (
              <div className="sidebar-section">
                <div className="sidebar-section-label">Back office</div>
                <div className="stack-sm" style={{ gap: 4 }}>
                  {renderLinks(adminLinks)}
                </div>
              </div>
            )}
          </nav>
          <div className="sidebar-promo">
            <strong>Send money instantly</strong>
            <p>Transfers between Ledgerly accounts settle in real time.</p>
            <Button size="sm" block icon={<Send />} onClick={() => navigate('/app/transfer')}>
              New transfer
            </Button>
          </div>
          <div className="sidebar-user">
            <Avatar name={user?.fullName} />
            <div className="grow">
              <div className="sidebar-user-name ellipsis">{user?.fullName}</div>
              <div className="sidebar-user-email ellipsis">{user?.email}</div>
            </div>
            <Button variant="ghost" size="sm" icon={<LogOut />} onClick={signOut} aria-label="Sign out" title="Sign out" />
          </div>
        </aside>
        <div className={`sidebar-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden />

        <div className="main">
          <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
            <Button variant="ghost" className="topbar-menu" icon={<MenuIcon />} onClick={() => setMenuOpen(true)} aria-label="Open menu" />
            <span className="topbar-logo">
              <Logo to="/app" />
            </span>
            <div className="topbar-actions">
              {user?.role === 'ADMIN' && (
                <span className="badge badge-primary hide-sm">
                  Admin
                </span>
              )}
              <ThemeToggle />
              <Button size="sm" icon={<Send />} onClick={() => navigate('/app/transfer')} className="hide-sm">
                Send money
              </Button>
            </div>
          </header>
          <main className="page" id="main">
            <Outlet />
          </main>
        </div>
      </div>

      <MoneyModal kind={money.kind} defaultAccountId={money.accountId} accounts={accounts.data ?? []} onClose={() => setMoney({ kind: null })} />
      <NewAccountModal open={newAccountOpen} onClose={() => setNewAccountOpen(false)} />
    </ActionsContext.Provider>
  );
}
