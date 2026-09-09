import React from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from '@/components/charts/theme';
import { formatZAR, formatZARCompact } from '@/lib/money';
import { formatMonthKey } from '@/lib/dates';
import { cx } from '@/components/ui/primitives';

/* ------------------------------------------------------------------ *
 * Donut with a hero number in the middle and a labelled legend beside it.
 * Identity never rests on colour: every slice is named in the legend.
 * ------------------------------------------------------------------ */

export interface DonutDatum { name: string; value: number; color: string }

export function Donut({
  data, centreValue, centreLabel, height = 200, ariaLabel,
}: { data: DonutDatum[]; centreValue: React.ReactNode; centreLabel: string; height?: number; ariaLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = data.filter((d) => d.value > 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
      <div className="relative shrink-0" style={{ width: height, height }} role="img" aria-label={ariaLabel}>
        <div className="absolute inset-0" aria-hidden="true">
        {total === 0 ? (
          <div className="flex h-full w-full items-center justify-center rounded-full border-[14px] border-[#EEF2F6]">
            <span className="text-[13px] text-ink-faint">No data</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart tabIndex={-1} role="presentation">
              <Pie
                data={shown}
                dataKey="value"
                nameKey="name"
                innerRadius="64%"
                outerRadius="98%"
                paddingAngle={2}
                stroke={CHART.surface}
                strokeWidth={2}
                isAnimationActive={false}
                rootTabIndex={-1}
              >
                {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v: number, n: string) => [`${v} (${Math.round((v / total) * 100)}%)`, n]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-bold leading-none tracking-tight text-indigo tabular-nums">{centreValue}</span>
          <span className="mt-1 max-w-[70%] text-center text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {centreLabel}
          </span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-muted">{d.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-indigo">{d.value}</span>
            <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-ink-faint">
              {total ? `${Math.round((d.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Stacked bar — steps complete against total, phase by phase.
 * ------------------------------------------------------------------ */

export function PhaseStackedBar({
  data, height = 260,
}: { data: Array<{ phase: string; complete: number; remaining: number }>; height?: number }) {
  const shortened = data.map((d) => ({ ...d, label: d.phase.split(' ')[0] }));
  return (
    <div style={{ height }} role="img" aria-label="Steps complete against total, for each of the ten phases">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={shortened} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="26%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={38} />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(l) => data.find((d) => d.phase.startsWith(`${l} `))?.phase ?? `Phase ${l}`}
          />
          <Bar dataKey="complete" name="Complete" stackId="a" fill={CHART.cyan} radius={[0, 0, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="remaining" name="Remaining" stackId="a" fill={CHART.track} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Invoiced against contracted — a bullet bar per project, so the two
 * measures share one scale instead of fighting on two axes.
 * ------------------------------------------------------------------ */

export function InvoicedBullets({
  rows, onSelect,
}: {
  rows: Array<{ id: string; name: string; contracted: number; invoiced: number; paid: number }>;
  onSelect?: (id: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.contracted));
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const invPct = (r.invoiced / max) * 100;
        const paidPct = (r.paid / max) * 100;
        const conPct = (r.contracted / max) * 100;
        const Wrapper = onSelect ? 'button' : 'div';
        return (
          <li key={r.id}>
            <Wrapper
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(r.id) } : {})}
              className={cx('block w-full text-left', onSelect && 'rounded-lg hover:opacity-90')}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-indigo">{r.name}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-muted">
                  <span className="font-semibold text-indigo">{formatZARCompact(r.invoiced)}</span>
                  {' of '}{formatZARCompact(r.contracted)}
                </span>
              </div>
              <div className="relative mt-2 h-4 w-full">
                {/* Contracted value: the track. */}
                <div className="absolute inset-y-0 left-0 rounded-full bg-[#EEF2F6]" style={{ width: `${conPct}%` }} />
                {/* Invoiced. */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${invPct}%`, background: CHART.violet }}
                />
                {/* Paid, nested inside invoiced with a surface ring so the two marks stay separable. */}
                <div
                  className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full ring-2 ring-white"
                  style={{ width: `${paidPct}%`, background: CHART.cyan }}
                />
              </div>
            </Wrapper>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * Cash position — invoiced and paid by month.
 * ------------------------------------------------------------------ */

export function CashLine({
  data, height = 240,
}: { data: Array<{ month: string; invoiced: number; paid: number; invoicedInMonth?: number; paidInMonth?: number }>; height?: number }) {
  const byMonth = new Map(data.map((d) => [d.month, d]));
  return (
    <div style={{ height }} role="img" aria-label="Cumulative invoiced and paid, by month">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -6 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis
            dataKey="month"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(m: string) => formatMonthKey(m).split(' ')[0]}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => formatZARCompact(v)} />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(m: string) => formatMonthKey(m)}
            formatter={(v: number, n: string, item: { payload?: { month?: string } }) => {
              const row = item?.payload?.month ? byMonth.get(item.payload.month) : undefined;
              const inMonth = n === 'Invoiced' ? row?.invoicedInMonth : row?.paidInMonth;
              const suffix = inMonth ? ` (${formatZAR(inMonth, { decimals: false })} this month)` : '';
              return [`${formatZAR(v, { decimals: false })}${suffix}`, n];
            }}
          />
          <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke={CHART.violet} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: CHART.violet }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="paid" name="Paid" stroke={CHART.cyan} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: CHART.cyan }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legends are always present for two or more series — identity is never colour alone. */
export function ChartLegend({ items, className }: { items: Array<{ label: string; color: string; shape?: 'line' | 'square' }>; className?: string }) {
  return (
    <ul className={cx('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          {i.shape === 'line'
            ? <span className="h-0.5 w-4 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
            : <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: i.color }} aria-hidden />}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
