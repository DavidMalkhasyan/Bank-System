import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppLayout } from './components/AppLayout';
import { useAppSelector } from './store';
import AccountDetailsPage from './pages/AccountDetailsPage';
import AccountsPage from './pages/AccountsPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';
import TransactionsPage from './pages/TransactionsPage';
import TransferPage from './pages/TransferPage';

// The back office is only loaded for admins.
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminAccountsPage = lazy(() => import('./pages/admin/AdminAccountsPage'));
const AdminTransactionsPage = lazy(() => import('./pages/admin/AdminTransactionsPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAppSelector((state) => Boolean(state.auth.accessToken));
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const role = useAppSelector((state) => state.auth.user?.role);
  if (role !== 'ADMIN') return <Navigate to="/app" replace />;
  return <Suspense fallback={null}>{children}</Suspense>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const isAuthenticated = useAppSelector((state) => Boolean(state.auth.accessToken));
  return isAuthenticated ? <Navigate to="/app" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:id" element={<AccountDetailsPage />} />
        <Route path="transfer" element={<TransferPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<RequireAdmin><AdminOverviewPage /></RequireAdmin>} />
        <Route path="admin/users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
        <Route path="admin/accounts" element={<RequireAdmin><AdminAccountsPage /></RequireAdmin>} />
        <Route path="admin/transactions" element={<RequireAdmin><AdminTransactionsPage /></RequireAdmin>} />
        <Route path="admin/audit" element={<RequireAdmin><AdminAuditPage /></RequireAdmin>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
