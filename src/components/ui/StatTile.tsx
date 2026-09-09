import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Card, cx, Skeleton } from '@/components/ui/primitives';
import type { Tone } from '@/lib/derive';

const ACCENT: Record<Tone | 'brand', string> = {
  brand: 'bg-cyan-50 text-cyan-link',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-neutral-bg text-neutral',
};

/**
 * A headline figure. Not a chart — a single number's job is to be read, so it
 * gets size, a label, and at most one line of context.
 */
export function StatTile({
  label, value, sub, icon: Icon, tone = 'brand', to, children, className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ElementType;
  tone?: Tone | 'brand';
  to?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
        {Icon ? (
          <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ACCENT[tone])}>
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[30px] font-bold leading-none tracking-tight text-indigo tabular-nums">{value}</p>
      {sub ? <div className="mt-2 text-[12.5px] leading-snug text-ink-muted">{sub}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
      {to ? (
        <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-cyan-link">
          View <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Card as="div" className={cx('transition-shadow hover:shadow-raised', className)}>
        <Link to={to} className="block h-full rounded-card p-5">{inner}</Link>
      </Card>
    );
  }
  return <Card className={cx('p-5', className)}>{inner}</Card>;
}

export function StatTileSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-3.5 h-8 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </Card>
  );
}

/** A compact label/value pair, for the money block and the metric grids. */
export function Metric({
  label, value, tone, hint, className,
}: { label: string; value: React.ReactNode; tone?: Tone; hint?: string; className?: string }) {
  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-indigo';
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className={cx('mt-1 text-[17px] font-bold leading-tight tracking-tight tabular-nums', toneClass)}>
        {value}
        {hint ? <span className="mt-0.5 block text-[11.5px] font-normal leading-snug tracking-normal text-ink-muted">{hint}</span> : null}
      </dd>
    </div>
  );
}
