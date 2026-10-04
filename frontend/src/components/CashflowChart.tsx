import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMoney, formatShortDate } from '../lib/format';
import type { Cashflow, Currency } from '../lib/types';
import { Skeleton } from './ui';

interface TooltipPayload {
  name?: string;
  value?: number;
  color?: string;
  payload?: { date: string };
}

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: TooltipPayload[]; currency: Currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{formatShortDate(payload[0]!.payload!.date)}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="chart-tooltip-row">
          <span>
            <i style={{ background: entry.color }} />
            {entry.name}
          </span>
          <strong className="num">{formatMoney(entry.value ?? 0, currency)}</strong>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--text-faint)', fontSize: 12 },
};

export function CashflowChart({ data, mode, loading }: { data?: Cashflow; mode: 'balance' | 'flow'; loading?: boolean }) {
  if (loading || !data) {
    return <Skeleton height={260} radius={14} />;
  }

  const points = data.days.map((day) => ({
    date: day.date,
    balance: Number.parseFloat(day.balance),
    income: Number.parseFloat(day.income),
    expense: Number.parseFloat(day.expense),
  }));
  const yFormatter = (value: number) => formatMoney(value, data.currency, { compact: true });
  const xFormatter = (value: string) => formatShortDate(value);

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        {mode === 'balance' ? (
          <AreaChart data={points} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
            <XAxis dataKey="date" {...axisProps} tickFormatter={xFormatter} minTickGap={28} />
            <YAxis {...axisProps} tickFormatter={yFormatter} width={64} domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip currency={data.currency} />} cursor={{ stroke: 'var(--border-strong)' }} />
            <Area type="monotone" dataKey="balance" name="Balance" stroke="var(--chart-line)" strokeWidth={2.5} fill="url(#balanceFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} />
          </AreaChart>
        ) : (
          <BarChart data={points} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
            <XAxis dataKey="date" {...axisProps} tickFormatter={xFormatter} minTickGap={28} />
            <YAxis {...axisProps} tickFormatter={yFormatter} width={64} />
            <Tooltip content={<ChartTooltip currency={data.currency} />} cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }} />
            <Bar dataKey="income" name="Money in" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="expense" name="Money out" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
