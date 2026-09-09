import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { cx } from '@/components/ui/primitives';

/**
 * Inline editing that never commits silently. Click or press Enter to open the
 * cell; Enter or the tick commits; Escape or the cross discards. Clicking away
 * leaves the editor open with its buttons visible, so an edit is never lost
 * and never applied without being asked for.
 */
function useCellEditor<T>(value: T, onCommit: (v: T) => void) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState<T>(value);
  useEffect(() => { if (!editing) setBuffer(value); }, [value, editing]);
  const open = () => { setBuffer(value); setEditing(true); };
  const cancel = () => { setBuffer(value); setEditing(false); };
  const commit = (v: T = buffer) => { onCommit(v); setEditing(false); };
  return { editing, buffer, setBuffer, open, cancel, commit };
}

function CellShell({
  onOpen, children, placeholder, empty, className, ariaLabel,
}: {
  onOpen: () => void; children: React.ReactNode; placeholder: string;
  empty: boolean; className?: string; ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ariaLabel}
      className={cx(
        'group/cell -mx-1 flex w-full items-start gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-cyan-50',
        className,
      )}
    >
      <span className={cx('min-w-0 flex-1', empty && 'text-ink-faint')}>{empty ? placeholder : children}</span>
      <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover/cell:opacity-100" strokeWidth={2} aria-hidden />
    </button>
  );
}

function CommitButtons({ onCommit, onCancel, disabled, error }: { onCommit: () => void; onCancel: () => void; disabled?: boolean; error?: string }) {
  return (
    <div className="mt-1 flex items-center gap-1">
      <button
        type="button"
        onClick={onCommit}
        disabled={disabled}
        className="inline-flex h-6 w-6 items-center justify-center rounded bg-cyan-600 text-white transition-colors hover:brightness-110 disabled:opacity-40"
        aria-label="Save this cell"
        title="Save (Enter)"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-line bg-surface text-ink-muted transition-colors hover:bg-canvas"
        aria-label="Discard this edit"
        title="Discard (Escape)"
      >
        <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      </button>
      {error ? <span className="ml-1 text-[11px] font-medium text-danger">{error}</span> : null}
    </div>
  );
}

const INPUT =
  'w-full rounded border border-cyan-600 bg-surface px-1.5 py-1 text-[13px] text-ink outline-none ring-2 ring-cyan-600/20';

export function TextCell({
  value, onCommit, label, placeholder = '—', multiline, rows = 3, className, mono,
}: {
  value: string; onCommit: (v: string) => void; label: string;
  placeholder?: string; multiline?: boolean; rows?: number; className?: string; mono?: boolean;
}) {
  const e = useCellEditor(value, onCommit);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { if (e.editing) ref.current?.focus(); }, [e.editing]);

  if (!e.editing) {
    return (
      <CellShell onOpen={e.open} placeholder={placeholder} empty={!value} ariaLabel={`${label}: ${value || 'empty'}. Click to edit.`} className={className}>
        <span className={cx('block whitespace-pre-wrap break-words text-[13px] leading-snug', mono && 'tabular-nums')}>{value}</span>
      </CellShell>
    );
  }

  return (
    <div>
      {multiline ? (
        <textarea
          ref={ref}
          value={e.buffer}
          rows={rows}
          aria-label={label}
          onChange={(ev) => e.setBuffer(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') { ev.preventDefault(); e.cancel(); }
            if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); e.commit(); }
          }}
          className={cx(INPUT, 'resize-y leading-snug')}
        />
      ) : (
        <input
          ref={ref}
          value={e.buffer}
          aria-label={label}
          onChange={(ev) => e.setBuffer(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') { ev.preventDefault(); e.cancel(); }
            if (ev.key === 'Enter') { ev.preventDefault(); e.commit(); }
          }}
          className={INPUT}
        />
      )}
      <CommitButtons onCommit={() => e.commit()} onCancel={e.cancel} />
      {multiline ? <p className="mt-1 text-[10.5px] text-ink-faint">⌘↵ to save</p> : null}
    </div>
  );
}

export function SelectCell({
  value, options, onCommit, label, render, placeholder = 'Not set', confirmValues, onConfirmNeeded,
}: {
  value: string; options: readonly string[]; onCommit: (v: string) => void; label: string;
  render?: (v: string) => React.ReactNode; placeholder?: string;
  /** Values that must not be applied directly — they are handed to `onConfirmNeeded` instead. */
  confirmValues?: readonly string[];
  onConfirmNeeded?: (v: string) => void;
}) {
  const e = useCellEditor(value, onCommit);
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => { if (e.editing) ref.current?.focus(); }, [e.editing]);

  const apply = (v: string) => {
    if (confirmValues?.includes(v) && v !== value && onConfirmNeeded) {
      e.cancel();
      onConfirmNeeded(v);
      return;
    }
    e.commit(v);
  };

  if (!e.editing) {
    return (
      <CellShell onOpen={e.open} placeholder={placeholder} empty={!value} ariaLabel={`${label}: ${value || 'not set'}. Click to change.`}>
        {render ? render(value) : <span className="text-[13px]">{value}</span>}
      </CellShell>
    );
  }

  return (
    <div>
      <select
        ref={ref}
        value={e.buffer}
        aria-label={label}
        onChange={(ev) => e.setBuffer(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Escape') { ev.preventDefault(); e.cancel(); }
          if (ev.key === 'Enter') { ev.preventDefault(); apply(e.buffer); }
        }}
        className={cx(INPUT, 'cursor-pointer')}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <CommitButtons onCommit={() => apply(e.buffer)} onCancel={e.cancel} />
    </div>
  );
}

export function DateCell({
  value, onCommit, label, min, max, validate, render,
}: {
  value: string; onCommit: (v: string) => void; label: string;
  min?: string; max?: string;
  validate?: (v: string) => string | null;
  render?: (v: string) => React.ReactNode;
}) {
  const e = useCellEditor(value, onCommit);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (e.editing) ref.current?.focus(); }, [e.editing]);
  const error = e.editing ? validate?.(e.buffer) ?? null : null;

  if (!e.editing) {
    return (
      <CellShell onOpen={e.open} placeholder="—" empty={!value} ariaLabel={`${label}: ${value || 'not set'}. Click to edit.`}>
        {render ? render(value) : <span className="whitespace-nowrap text-[13px] tabular-nums">{value}</span>}
      </CellShell>
    );
  }

  return (
    <div>
      <input
        ref={ref}
        type="date"
        value={e.buffer}
        min={min}
        max={max}
        aria-label={label}
        aria-invalid={!!error}
        onChange={(ev) => e.setBuffer(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Escape') { ev.preventDefault(); e.cancel(); }
          if (ev.key === 'Enter' && !error) { ev.preventDefault(); e.commit(); }
        }}
        className={cx(INPUT, error && 'border-danger ring-danger/20')}
      />
      <CommitButtons onCommit={() => e.commit()} onCancel={e.cancel} disabled={!!error} error={error ?? undefined} />
    </div>
  );
}

export function PercentCell({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const e = useCellEditor(String(value), (v) => onCommit(Number(v)));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (e.editing) ref.current?.focus(); }, [e.editing]);

  const n = Number(e.buffer);
  const error = !Number.isFinite(n) || n < 0 || n > 100 ? 'Enter 0 to 100.' : null;

  if (!e.editing) {
    return (
      <CellShell onOpen={e.open} placeholder="0%" empty={false} ariaLabel={`${label}: ${value} percent. Click to edit.`}>
        <span className="text-[13px] tabular-nums">{value}%</span>
      </CellShell>
    );
  }

  return (
    <div>
      <input
        ref={ref}
        type="number"
        min={0}
        max={100}
        step={5}
        value={e.buffer}
        aria-label={label}
        aria-invalid={!!error}
        onChange={(ev) => e.setBuffer(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Escape') { ev.preventDefault(); e.cancel(); }
          if (ev.key === 'Enter' && !error) { ev.preventDefault(); e.commit(); }
        }}
        className={cx(INPUT, 'tabular-nums', error && 'border-danger ring-danger/20')}
      />
      <CommitButtons onCommit={() => e.commit()} onCancel={e.cancel} disabled={!!error} error={error ?? undefined} />
    </div>
  );
}

/** A read-only calculated cell. Marked so nobody tries to type in it. */
export function CalcCell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span className="block text-[13px] tabular-nums text-ink-muted" title={title}>{children}</span>
  );
}
