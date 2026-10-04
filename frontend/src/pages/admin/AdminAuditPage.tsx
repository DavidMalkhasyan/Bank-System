import { useEffect, useState } from 'react';
import { FileClock } from 'lucide-react';

import { Alert, Avatar, Badge, Card, EmptyState, PageHeader, Pagination, Select, Skeleton } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatDateTime, titleCase } from '../../lib/format';
import { useAuditActions, useAuditLogs } from '../../lib/queries';

const ACTION_TONES: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'info' | 'neutral'> = {
  LOGIN: 'success',
  LOGIN_FAILED: 'danger',
  REFRESH_TOKEN_REUSED: 'danger',
  ACCOUNT_FROZEN: 'info',
  ACCOUNT_UNFROZEN: 'info',
  USER_ROLE_CHANGED: 'warning',
  PASSWORD_CHANGED: 'warning',
  TRANSFER: 'primary',
};

function MetadataChips({ metadata }: { metadata: Record<string, unknown> | null }) {
  const entries = Object.entries(metadata ?? {}).filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object');
  if (entries.length === 0) return <span className="faint">—</span>;
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {entries.slice(0, 4).map(([key, value]) => (
        <span key={key} className="badge no-dot" title={`${key}: ${String(value)}`} style={{ maxWidth: 220 }}>
          <span className="faint">{key}:</span>&nbsp;<span className="ellipsis">{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

export default function AdminAuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const logs = useAuditLogs({ page, action: action || undefined });
  const actions = useAuditActions();

  useEffect(() => setPage(1), [action]);

  return (
    <>
      <PageHeader title="Audit log" subtitle="An append-only record of sign-ins, money movement and admin actions." />
      {logs.isError && <Alert>{errorMessage(logs.error)}</Alert>}
      <Card>
        <div className="filters">
          <Select value={action} onChange={(event) => setAction(event.target.value)} aria-label="Event type">
            <option value="">All events</option>
            {(actions.data ?? []).map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </Select>
        </div>
        <div className="table-wrap" style={{ opacity: logs.isPlaceholderData ? 0.6 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>User</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.isLoading
                ? Array.from({ length: 10 }, (_, index) => (
                    <tr key={index}>
                      <td colSpan={4}><Skeleton height={24} /></td>
                    </tr>
                  ))
                : logs.data?.items.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <Badge tone={ACTION_TONES[log.action] ?? 'neutral'}>{titleCase(log.action)}</Badge>
                      </td>
                      <td>
                        {log.user ? (
                          <div className="table-cell-main">
                            <Avatar name={log.user.fullName} size="sm" />
                            <div>
                              <div className="strong nowrap">{log.user.fullName}</div>
                              <div className="small muted">{log.user.email}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="faint">Anonymous</span>
                        )}
                      </td>
                      <td><MetadataChips metadata={log.metadata} /></td>
                      <td className="muted nowrap">{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {logs.data?.items.length === 0 && <EmptyState icon={<FileClock />} title="No events recorded" />}
        {logs.data && logs.data.meta.total > 0 && (
          <Pagination page={page} totalPages={logs.data.meta.totalPages} total={logs.data.meta.total} onPage={setPage} noun="events" />
        )}
      </Card>
    </>
  );
}
