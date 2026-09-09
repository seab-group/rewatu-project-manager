import React from 'react';
import { Check, ChevronDown, Info, Minus, X } from 'lucide-react';
import type { Tone } from '@/lib/derive';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ *
 * Card — the defining trait of the look: white on canvas, 16px radius.
 * ------------------------------------------------------------------ */

export function Card({
  children, className, as: As = 'section', ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return (
    <As className={cx('rw-card', className)} {...rest}>{children}</As>
  );
}

export function CardHeader({
  title, subtitle, action, className, id,
}: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold leading-tight text-indigo">{title}</h2>
        {subtitle ? <p className="mt-1 text-[13px] leading-snug text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('p-5', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ *
 * Buttons — one primary per view.
 * ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: React.ElementType;
  iconRight?: React.ElementType;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, className, children, ...rest }, ref,
) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all ' +
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none whitespace-nowrap';
  const sizes = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm';
  const variants: Record<string, string> = {
    primary: 'rw-gradient text-white shadow-raised hover:brightness-[1.06] active:brightness-95 disabled:hover:brightness-100',
    secondary: 'bg-surface text-indigo border border-line shadow-card hover:bg-canvas hover:border-[#CFD8E1] active:bg-[#EDF1F5]',
    ghost: 'bg-transparent text-ink-muted hover:bg-[#EDF1F5] hover:text-indigo active:bg-[#E3E8ED]',
    danger: 'bg-danger text-white shadow-raised hover:brightness-110 active:brightness-95',
  };
  return (
    <button ref={ref} className={cx(base, sizes, variants[variant], className)} {...rest}>
      {Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2} aria-hidden /> : null}
      {children}
      {IconRight ? <IconRight className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2} aria-hidden /> : null}
    </button>
  );
});

export function IconButton({
  label, icon: Icon, className, size = 'md', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: React.ElementType; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-lg text-ink-muted transition-colors',
        'hover:bg-[#EDF1F5] hover:text-indigo disabled:opacity-40 disabled:hover:bg-transparent',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        className,
      )}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={2} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Status pill — never colour alone. Always a dot or icon plus the label.
 * ------------------------------------------------------------------ */

const TONE_STYLES: Record<Tone, { pill: string; dot: string; text: string }> = {
  success: { pill: 'bg-success-bg text-success', dot: 'bg-success', text: 'text-success' },
  warning: { pill: 'bg-warning-bg text-warning', dot: 'bg-warning', text: 'text-warning' },
  danger: { pill: 'bg-danger-bg text-danger', dot: 'bg-danger', text: 'text-danger' },
  neutral: { pill: 'bg-neutral-bg text-neutral', dot: 'bg-neutral', text: 'text-neutral' },
};

export function Pill({
  tone = 'neutral', children, icon: Icon, className, size = 'md',
}: { tone?: Tone; children: React.ReactNode; icon?: React.ElementType; className?: string; size?: 'sm' | 'md' }) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        s.pill, className,
      )}
    >
      {Icon
        ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        : <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function toneText(tone: Tone) { return TONE_STYLES[tone].text; }
export function toneDot(tone: Tone) { return TONE_STYLES[tone].dot; }

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

export function ProgressBar({
  value, tone = 'brand', label, className, height = 'h-2',
}: { value: number; tone?: 'brand' | Tone; label?: string; className?: string; height?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const fill =
    // Solid cyan, not the gradient: the gradient belongs to the logo mark, the
    // primary button and the active navigation tile, and nowhere else.
    tone === 'brand' ? 'bg-cyan-600'
      : tone === 'success' ? 'bg-success'
      : tone === 'warning' ? 'bg-warning'
      : tone === 'danger' ? 'bg-danger'
      : 'bg-neutral';
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full bg-[#EDF1F5]', height, className)}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${v}% complete`}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${v}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Skeletons — shaped like the content that replaces them.
 * ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('rw-skeleton', className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Empty state — say what belongs here and offer the action that fills it.
 * ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon = Info, title, body, action, className,
}: { icon?: React.ElementType; title: string; body: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-link">
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="text-[15px] font-semibold text-indigo">{title}</h3>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Inline messages — in place, plain language, what failed and what next.
 * ------------------------------------------------------------------ */

export function InlineMessage({
  tone = 'warning', title, children, className, icon: Icon,
}: { tone?: Tone; title?: string; children: React.ReactNode; className?: string; icon?: React.ElementType }) {
  const map: Record<Tone, string> = {
    success: 'bg-success-bg text-success border-success/20',
    warning: 'bg-warning-bg text-warning border-warning/20',
    danger: 'bg-danger-bg text-danger border-danger/20',
    neutral: 'bg-neutral-bg text-ink-muted border-line',
  };
  return (
    <div className={cx('flex gap-2.5 rounded-lg border p-3 text-[13px] leading-relaxed', map[tone], className)} role={tone === 'danger' ? 'alert' : undefined}>
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden /> : null}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Checkbox — used for row selection in the tables.
 * ------------------------------------------------------------------ */

export function Checkbox({
  checked, indeterminate, onChange, label, className, disabled, text,
}: {
  checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void;
  label: string; className?: string; disabled?: boolean;
  /** Visible text, rendered inside this control's own label. */
  text?: React.ReactNode;
}) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center', disabled && 'cursor-not-allowed opacity-50', className)}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={cx(
          'flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#00D2F5]',
          checked || indeterminate ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-[#CBD3DB] bg-surface',
        )}
        aria-hidden
      >
        {indeterminate ? <Minus className="h-3 w-3" strokeWidth={3} /> : checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      {text ? <span className="ml-2 text-[13px] font-medium text-ink">{text}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */

export function SegmentedControl<T extends string>({
  options, value, onChange, label,
}: { options: Array<{ value: T; label: string; icon?: React.ElementType }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[13px] font-semibold transition-colors',
              active ? 'bg-cyan-50 text-indigo' : 'text-ink-muted hover:text-indigo',
            )}
          >
            {o.icon ? <o.icon className="h-4 w-4" strokeWidth={2} aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Collapsible chevron
 * ------------------------------------------------------------------ */

export function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      className={cx('h-4 w-4 shrink-0 transition-transform duration-200', open ? '' : '-rotate-90', className)}
      strokeWidth={2}
      aria-hidden
    />
  );
}

export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return <IconButton label={label} icon={X} onClick={onClick} />;
}
