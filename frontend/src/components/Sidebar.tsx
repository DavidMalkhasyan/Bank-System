import { NavLink, useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/slices/authSlice';

export default function Sidebar() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div>
        <p className="sidebar-label">Banking</p>
        <h3>{user?.email ?? 'Customer'}</h3>
      </div>
      <nav>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/accounts">Accounts</NavLink>
        <NavLink to="/transactions">Transactions</NavLink>
        <NavLink to="/transfer">Transfer</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        {user?.role === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
        <button type="button" className="logout-button" onClick={handleLogout}>Logout</button>
      </nav>
    </aside>
  );
}
