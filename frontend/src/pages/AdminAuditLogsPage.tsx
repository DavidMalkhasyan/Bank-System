import { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const data = await api.request<any[]>('/admin/audit-logs?page=1&pageSize=20');
        setLogs(data ?? []);
        setError('');
      } catch (err) {
        setError((err as Error).message || 'Unable to load audit logs.');
      } finally {
        setLoading(false);
      }
    };

    void loadLogs();
  }, []);

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="content-panel">
        <div className="card hero-card">
          <p className="eyebrow">Admin</p>
          <h1>Audit logs</h1>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="card info-card">Loading audit logs...</div>
        ) : (
          <div className="card section-card">
            {logs.length === 0 ? (
              <p className="empty-text">No audit events recorded.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDateTime(log.created_at)}</td>
                        <td>{log.user_id ?? 'System'}</td>
                        <td>{log.action}</td>
                        <td>{log.entity_type ?? '—'}</td>
                        <td>{log.metadata ? JSON.stringify(log.metadata) : '—'}</td>
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
