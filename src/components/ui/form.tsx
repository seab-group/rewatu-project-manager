import React, { useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cx } from '@/components/ui/primitives';

const CONTROL =
  'w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors ' +
  'placeholder:text-ink-faint disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint';

export function Field({
  label, hint, error, required, children, className, htmlFor,
}: {
  label: string; hint?: React.ReactNode; error?: string; required?: boolean;
  children: React.ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-indigo">
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] font-medium text-danger" role="alert">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cx(CONTROL, 'h-10', invalid ? 'border-danger' : 'border-line hover:border-[#CFD8E1]', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function TextArea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cx(CONTROL, 'py-2 leading-relaxed', invalid ? 'border-danger' : 'border-line hover:border-[#CFD8E1]', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[]; placeholder?: string; invalid?: boolean }
>(function Select({ options, placeholder, className, invalid, ...rest }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cx(
          CONTROL, 'h-10 cursor-pointer appearance-none pr-9',
          invalid ? 'border-danger' : 'border-line hover:border-[#CFD8E1]',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={2} aria-hidden />
    </div>
  );
});

/** Dates only. The browser's date control rejects anything that is not a date. */
export const DateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function DateInput({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="date"
        className={cx(
          CONTROL, 'h-10',
          invalid ? 'border-danger' : 'border-line hover:border-[#CFD8E1]',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

export function MoneyInput({
  value, onChange, invalid, id, ...rest
}: { value: string; onChange: (v: string) => void; invalid?: boolean; id?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-faint">R</span>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(CONTROL, 'h-10 pl-7 tabular-nums', invalid ? 'border-danger' : 'border-line hover:border-[#CFD8E1]')}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    </div>
  );
}

export function FieldGroup({
  title, description, children, className,
}: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx('border-t border-line pt-5 first:border-t-0 first:pt-0', className)}>
      <h3 id={id} className="text-[13px] font-bold uppercase tracking-wide text-ink-faint">{title}</h3>
      {description ? <p className="mt-1 text-[13px] text-ink-muted">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function Toggle({
  checked, onChange, label, description, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cx('flex items-start gap-3', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={cx(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#00D2F5]',
          checked ? 'bg-cyan-600' : 'bg-[#CBD3DB]',
        )}
        aria-hidden
      >
        <span className={cx('h-4 w-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-indigo">{label}</span>
        {description ? <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
}
