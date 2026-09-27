import { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatDate } from '../utils/format';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const data = await api.request<any[]>('/admin/users');
        setUsers(data ?? []);
        setError('');
      } catch (err) {
        setError((err as Error).message || 'Unable to load users.');
      } finally {
        setLoading(false);
      }
    };

    void loadUsers();
  }, []);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Admin</p>
          <h1>Users</h1>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="card info-card">Loading users...</div>
        ) : (
          <div className="card section-card">
            {users.length === 0 ? (
              <p className="empty-text">No users found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.email.split('@')[0]}</td>
                        <td>{user.email}</td>
                        <td>{user.role}</td>
                        <td><span className="status-badge active">Active</span></td>
                        <td>{formatDate(user.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
