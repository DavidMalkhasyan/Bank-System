import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailsPage from './pages/AccountDetailsPage';
import TransactionsPage from './pages/TransactionsPage';
import TransferPage from './pages/TransferPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminAccountsPage from './pages/AdminAccountsPage';
import AdminTransactionsPage from './pages/AdminTransactionsPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import { useAppSelector } from './store/hooks';

function App() {
  const { token, user } = useAppSelector((state) => state.auth);

  const isAuthenticated = Boolean(token);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

      <Route
        path="/dashboard"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
      <Route path="/accounts" element={isAuthenticated ? <AccountsPage /> : <Navigate to="/login" replace />} />
      <Route path="/accounts/:id" element={isAuthenticated ? <AccountDetailsPage /> : <Navigate to="/login" replace />} />
      <Route path="/transactions" element={isAuthenticated ? <TransactionsPage /> : <Navigate to="/login" replace />} />
      <Route path="/transfer" element={isAuthenticated ? <TransferPage /> : <Navigate to="/login" replace />} />
      <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" replace />} />

      <Route
        path="/admin"
        element={isAuthenticated && isAdmin ? <AdminPage /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/admin/users"
        element={isAuthenticated && isAdmin ? <AdminUsersPage /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/admin/accounts"
        element={isAuthenticated && isAdmin ? <AdminAccountsPage /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/admin/transactions"
        element={isAuthenticated && isAdmin ? <AdminTransactionsPage /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/admin/audit-logs"
        element={isAuthenticated && isAdmin ? <AdminAuditLogsPage /> : <Navigate to="/dashboard" replace />}
      />

      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
