import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cx } from '@/components/ui/primitives';
import {
  MONTH_NAMES, WEEKDAY_NAMES, addDays, formatDate, isValidISO, isWeekendDate, monthGridDates,
  monthOf, parseISO, parseLooseDate, shiftMonthKey, today, withinRange,
} from '@/lib/dates';
import type { ISODate } from '@/types';

/**
 * The date picker.
 *
 * The browser's own date control paints a calendar from the operating system,
 * which lands in the middle of this interface looking like it came from
 * somewhere else. This is the same control drawn in the system's own language:
 * the card surface, the cyan accent, the line borders and the focus ring used
 * everywhere else.
 *
 * It is still a text field. Dates get typed far more often than they get
 * clicked — `12/03/2026`, `12 Mar 2026` and the ISO form all parse — and the
 * calendar is there for the times you want to look at the month.
 */

interface DatePickerProps {
  id?: string;
  value: ISODate;
  onChange: (value: ISODate) => void;
  min?: string;
  max?: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  /** Called when the field loses focus, after any pending text is parsed. */
  onBlur?: () => void;
  autoFocus?: boolean;
  /** Compact height, for the inline grid cells. */
  size?: 'sm' | 'md';
}

const PANEL_WIDTH = 300;

export function DatePicker({
  id, value, onChange, min, max, invalid, disabled, placeholder = 'dd/mm/yyyy',
  className, onBlur, autoFocus, size = 'md', ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => monthOf(value || today()));
  const [focusedDate, setFocusedDate] = useState<ISODate>(value || today());

  const panelId = React.useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The field shows the friendly form until someone starts typing in it.
  const display = typing ? text : value ? formatDate(value) : '';
  const parsedWhileTyping = typing ? parseLooseDate(text) : null;
  const textIsBad = typing && text.trim() !== '' && parsedWhileTyping === null;

  useEffect(() => {
    if (!typing) setViewMonth(monthOf(value || today()));
  }, [value, typing]);

  const commitText = useCallback(() => {
    if (!typing) return;
    const raw = text.trim();
    setTyping(false);
    if (raw === '') { if (value !== '') onChange(''); return; }
    const parsed = parseLooseDate(raw);
    // An unparseable entry is discarded rather than half-applied; the field
    // snaps back to the date it held.
    if (parsed && withinRange(parsed, min, max)) onChange(parsed);
  }, [typing, text, value, onChange, min, max]);

  const choose = (date: ISODate) => {
    if (!withinRange(date, min, max)) return;
    setTyping(false);
    onChange(date);
    setOpen(false);
    inputRef.current?.focus();
  };

  /* ---- Close on outside click or Escape ---- */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openPanel = () => {
    if (disabled) return;
    const base = value && isValidISO(value) ? value : clampToRange(today(), min, max);
    setFocusedDate(base);
    setViewMonth(monthOf(base));
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); inputRef.current?.focus(); return; }
    if ((e.key === 'ArrowDown' || e.key === 'Enter') && !open && !typing) { e.preventDefault(); openPanel(); return; }
    if (e.key === 'Enter' && typing) { e.preventDefault(); commitText(); return; }
    if (!open) return;

    const move = (days: number) => {
      e.preventDefault();
      const next = addDays(focusedDate, days);
      setFocusedDate(next);
      setViewMonth(monthOf(next));
    };
    switch (e.key) {
      case 'ArrowLeft': move(-1); break;
      case 'ArrowRight': move(1); break;
      case 'ArrowUp': move(-7); break;
      case 'ArrowDown': move(7); break;
      case 'Home': move(-((parseISO(focusedDate)!.getDay() + 6) % 7)); break;
      case 'End': move(6 - ((parseISO(focusedDate)!.getDay() + 6) % 7)); break;
      case 'PageUp': {
        e.preventDefault();
        const next = shiftMonthKey(viewMonth, e.shiftKey ? -12 : -1);
        setViewMonth(next);
        setFocusedDate(clampToMonth(focusedDate, next));
        break;
      }
      case 'PageDown': {
        e.preventDefault();
        const next = shiftMonthKey(viewMonth, e.shiftKey ? 12 : 1);
        setViewMonth(next);
        setFocusedDate(clampToMonth(focusedDate, next));
        break;
      }
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(focusedDate);
        break;
      default:
        break;
    }
  };

  const small = size === 'sm';
  const height = small ? 'h-8 text-[12.5px]' : 'h-10 text-sm';

  return (
    <div className={cx('relative', className)} ref={wrapRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        // The combobox pattern: a text field that also owns a popup.
        role="combobox"
        aria-invalid={invalid || textIsBad || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        {...aria}
        onChange={(e) => { setTyping(true); setText(e.target.value); }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          // Clicking inside the panel is not leaving the field.
          if (panelRef.current?.contains(e.relatedTarget as Node)) return;
          commitText();
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
        className={cx(
          'w-full rounded-lg border bg-surface text-ink transition-colors',
          'placeholder:text-ink-faint disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint',
          small ? 'pl-1.5 pr-6' : 'pl-3 pr-9',
          height,
          invalid || textIsBad ? 'border-danger' : 'border-line hover:border-[#CFD8E1]',
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={open ? 'Close the calendar' : 'Open the calendar'}
        className={cx(
          'absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition-colors',
          'hover:bg-canvas hover:text-indigo disabled:opacity-40 disabled:hover:bg-transparent',
          small ? 'right-0 h-5 w-5' : 'right-1 h-8 w-8',
        )}
      >
        <CalendarDays className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2} aria-hidden />
      </button>

      {textIsBad ? (
        <p className="mt-1 text-[11.5px] font-medium text-danger" role="alert">
          That is not a date we recognise. Try 12/03/2026 or 12 Mar 2026.
        </p>
      ) : null}

      {open ? (
        <Panel
          ref={panelRef}
          id={panelId}
          anchor={wrapRef}
          value={value}
          min={min}
          max={max}
          viewMonth={viewMonth}
          setViewMonth={setViewMonth}
          focusedDate={focusedDate}
          setFocusedDate={setFocusedDate}
          onChoose={choose}
          onClear={() => { onChange(''); setTyping(false); setOpen(false); inputRef.current?.focus(); }}
          onDismiss={() => { setOpen(false); inputRef.current?.focus(); }}
          onKeyDown={onKeyDown}
        />
      ) : null}
    </div>
  );
}

function clampToRange(date: ISODate, min?: string, max?: string): ISODate {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

/** Keep the focused day inside the month being shown. */
function clampToMonth(date: ISODate, month: string): ISODate {
  const day = Number(date.slice(-2));
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ *
 * The panel
 * ------------------------------------------------------------------ */

interface PanelProps {
  id: string;
  anchor: React.RefObject<HTMLElement>;
  value: ISODate;
  min?: string;
  max?: string;
  viewMonth: string;
  setViewMonth: (m: string) => void;
  focusedDate: ISODate;
  setFocusedDate: (d: ISODate) => void;
  onChoose: (d: ISODate) => void;
  onClear: () => void;
  onDismiss: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { id, anchor, value, min, max, viewMonth, setViewMonth, focusedDate, setFocusedDate, onChoose, onClear, onDismiss, onKeyDown },
  ref,
) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const localRef = useRef<HTMLDivElement | null>(null);
  const focusedRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const isSheet = window.innerWidth < 640;
      setSheet(isSheet);
      if (isSheet) { setPos({ top: 0, left: 0 }); return; }

      const r = el.getBoundingClientRect();
      const height = localRef.current?.offsetHeight ?? 340;
      // Flip above when there is no room below, and stay inside the viewport.
      const below = window.innerHeight - r.bottom;
      const top = below < height + 12 && r.top > height + 12 ? r.top - height - 6 : r.bottom + 6;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, viewMonth]);

  // Keep the focused day scrolled into view for keyboard users without
  // stealing focus from the text field, which stays the typing surface.
  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [focusedDate]);

  const weeks = useMemo(() => {
    const dates = monthGridDates(viewMonth);
    return Array.from({ length: 6 }, (_, i) => dates.slice(i * 7, i * 7 + 7));
  }, [viewMonth]);
  const [yearStr, monthStr] = viewMonth.split('-');
  const label = `${MONTH_NAMES[Number(monthStr) - 1]} ${yearStr}`;
  const now = today();

  const canStep = (by: number) => {
    const next = shiftMonthKey(viewMonth, by);
    if (min && next < monthOf(min)) return false;
    if (max && next > monthOf(max)) return false;
    return true;
  };

  const step = (by: number) => {
    if (!canStep(by)) return;
    const next = shiftMonthKey(viewMonth, by);
    setViewMonth(next);
    setFocusedDate(clampToMonth(focusedDate, next));
  };

  const panel = (
    <div
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      id={id}
      role="dialog"
      aria-label="Choose a date"
      onKeyDown={onKeyDown}
      style={sheet ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: PANEL_WIDTH }}
      className={cx(
        'z-[70] rounded-card border border-line bg-surface shadow-pop animate-scale-in',
        sheet
          ? 'fixed inset-x-3 bottom-3 mx-auto max-w-sm'
          : 'fixed',
      )}
    >
      {sheet ? (
        <div className="border-b border-line px-3.5 pb-2 pt-3">
          <p className="text-[13px] font-semibold text-indigo">Choose a date</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {value ? formatDate(value) : 'Nothing selected yet'}
          </p>
        </div>
      ) : null}

      {/* Month navigation */}
      <div className="flex items-center gap-1 border-b border-line px-2.5 py-2">
        <NavButton label="Previous year" icon={ChevronsLeft} onClick={() => step(-12)} disabled={!canStep(-12)} />
        <NavButton label="Previous month" icon={ChevronLeft} onClick={() => step(-1)} disabled={!canStep(-1)} />
        <div className="flex-1 text-center text-[13px] font-semibold text-indigo" aria-live="polite">
          {label}
        </div>
        <NavButton label="Next month" icon={ChevronRight} onClick={() => step(1)} disabled={!canStep(1)} />
        <NavButton label="Next year" icon={ChevronsRight} onClick={() => step(12)} disabled={!canStep(12)} />
      </div>

      {/* Grid. A real table, so rows, column headers and cells carry their own
          semantics instead of ARIA roles bolted onto a flat CSS grid. */}
      <div className="p-2.5">
        <table role="grid" aria-label={label} className="w-full table-fixed border-separate border-spacing-0.5">
          <thead>
            <tr>
              {WEEKDAY_NAMES.map((d) => (
                <th key={d} scope="col" className="pb-1 text-center text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((date) => {
                  const inMonth = date.startsWith(viewMonth);
                  const isSelected = !!value && date === value;
                  const isToday = date === now;
                  const isFocused = date === focusedDate;
                  const allowed = withinRange(date, min, max);
                  return (
                    <td key={date} className="p-0">
                      <button
                        ref={isFocused ? focusedRef : undefined}
                        type="button"
                        aria-pressed={isSelected}
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={formatDate(date)}
                        disabled={!allowed}
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onChoose(date)}
                        onMouseEnter={() => setFocusedDate(date)}
                        className={cx(
                          'flex h-8 w-full items-center justify-center rounded-md text-[12.5px] tabular-nums transition-colors',
                          !allowed && 'cursor-not-allowed text-ink-faint/70 line-through',
                          allowed && isSelected && 'bg-cyan-600 font-bold text-white',
                          allowed && !isSelected && isFocused && 'bg-cyan-50 text-indigo',
                          allowed && !isSelected && !isFocused && inMonth && 'text-ink hover:bg-canvas',
                          allowed && !isSelected && !isFocused && !inMonth && 'text-ink-faint hover:bg-canvas',
                          allowed && !isSelected && isWeekendDate(date) && inMonth && !isFocused && 'text-ink-muted',
                          isToday && !isSelected && 'ring-1 ring-inset ring-cyan-600',
                          allowed && 'font-medium',
                        )}
                      >
                        {Number(date.slice(-2))}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-2">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChoose(clampToRange(now, min, max))}
          disabled={!withinRange(now, min, max)}
          className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-cyan-link transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:text-ink-faint"
        >
          Today
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
          disabled={!value}
          className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-canvas hover:text-indigo disabled:cursor-not-allowed disabled:text-ink-faint"
        >
          Clear
        </button>
      </div>
    </div>
  );

  return createPortal(
    sheet ? (
      <>
        <div
          className="fixed inset-0 z-[69] bg-[#1B2430]/30 animate-fade-in"
          onClick={onDismiss}
          aria-hidden
        />
        {panel}
      </>
    ) : panel,
    document.body,
  );
});

function NavButton({
  label, icon: Icon, onClick, disabled,
}: { label: string; icon: React.ElementType; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-canvas hover:text-indigo disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
