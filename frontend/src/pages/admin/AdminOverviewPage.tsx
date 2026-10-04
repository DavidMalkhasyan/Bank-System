import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, CreditCard, Snowflake, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Alert, Card, CardHeader, PageHeader, Skeleton } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatRelative, formatShortDate, titleCase } from '../../lib/format';
import { useAdminStats, useAuditLogs } from '../../lib/queries';

function StatCard({ label, value, foot, icon, tone }: { label: string; value?: number; foot: string; icon: ReactNode; tone?: string }) {
  return (
    <Card className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon ${tone ?? ''}`}>{icon}</span>
      </div>
      {value === undefined ? <Skeleton width={80} height={30} /> : <span className="stat-value">{value.toLocaleString()}</span>}
      <span className="stat-foot">{foot}</span>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const stats = useAdminStats();
  const audit = useAuditLogs({ page: 1 });
  const data = stats.data;
  const maxDeposit = Math.max(1, ...(data?.depositsByCurrency.map((row) => row.accounts) ?? [1]));

  return (
    <>
      <PageHeader title="Back office" subtitle="Platform health, customer activity and security events." />
      {stats.isError && <Alert>{errorMessage(stats.error)}</Alert>}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Customers" value={data?.users} foot={`+${data?.newUsers30d ?? 0} in the last 30 days`} icon={<Users />} />
        <StatCard label="Accounts" value={data?.accounts} foot={`${data?.activeAccounts ?? 0} active`} icon={<CreditCard />} tone="green" />
        <StatCard label="Transactions" value={data?.transactions} foot={`${data?.transactions24h ?? 0} in the last 24 hours`} icon={<Activity />} tone="amber" />
        <StatCard label="Frozen accounts" value={data?.frozenAccounts} foot="Under security review" icon={<Snowflake />} tone="red" />
      </div>

      <div className="grid grid-main">
        <Card>
          <CardHeader title="Transaction volume" subtitle="Number of transactions per day, last 14 days" />
          <div className="card-body">
            <div className="legend" style={{ marginBottom: 8 }}>
              <span><i style={{ background: 'var(--chart-line)' }} /> Transfers</span>
              <span><i style={{ background: 'var(--chart-income)' }} /> Deposits</span>
              <span><i style={{ background: 'var(--chart-expense)' }} /> Withdrawals</span>
            </div>
            {data ? (
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={data.activity} margin={{ top: 10, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
                    <XAxis dataKey="date" tickFormatter={formatShortDate} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-faint)', fontSize: 12 }} minTickGap={20} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-faint)', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }}
                      labelFormatter={(value) => formatShortDate(String(value))}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13 }}
                    />
                    <Bar dataKey="transfers" name="Transfers" stackId="a" fill="var(--chart-line)" />
                    <Bar dataKey="deposits" name="Deposits" stackId="a" fill="var(--chart-income)" />
                    <Bar dataKey="withdrawals" name="Withdrawals" stackId="a" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Skeleton height={280} radius={14} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Deposits held" subtitle="Total customer balances by currency" />
          <div className="card-body stack">
            {data
              ? data.depositsByCurrency.map((row) => (
                  <div key={row.currency} className="stack-sm">
                    <div className="row-between">
                      <span className="strong">{row.currency}</span>
                      <span className="strong num">{formatMoney(row.total, row.currency)}</span>
                    </div>
                    <div className="progress">
                      <div style={{ width: `${(row.accounts / maxDeposit) * 100}%` }} />
                    </div>
                    <span className="tiny faint">{row.accounts} {row.accounts === 1 ? 'account' : 'accounts'}</span>
                  </div>
                ))
              : Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={44} />)}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 20 }} />
      <Card>
        <CardHeader
          title="Latest security events"
          action={
            <Link to="/app/admin/audit" className="card-link">
              Full audit log <ArrowRight />
            </Link>
          }
        />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>User</th>
                <th className="align-right">When</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data?.items ?? []).slice(0, 8).map((log) => (
                <tr key={log.id}>
                  <td className="strong">{titleCase(log.action)}</td>
                  <td className="muted">{log.user?.fullName ?? log.user?.email ?? 'System'}</td>
                  <td className="align-right muted nowrap">{formatRelative(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
