import type { ISODate } from '@/types';

/** The system's "today". Isolated here so the whole app agrees on one date. */
export function today(): ISODate {
  const d = new Date();
  return toISO(d);
}

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse an ISO date as local midnight, so day arithmetic never drifts by a timezone. */
export function parseISO(s: ISODate): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isValidISO(s: string): boolean {
  return parseISO(s) !== null;
}

/** Whole days from `a` to `b`. Negative when `b` is before `a`. */
export function daysBetween(a: ISODate, b: ISODate): number | null {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** Inclusive duration: a single-day task is 1 day, not 0. */
export function inclusiveDays(start: ISODate, end: ISODate): number | null {
  const n = daysBetween(start, end);
  return n === null ? null : n + 1;
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  if (!d) return '';
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `12 Mar 2026`. Empty dates render as an em dash so blanks are visible, not invisible. */
export function formatDate(s: ISODate): string {
  const d = parseISO(s);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(s: ISODate): string {
  const d = parseISO(s);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** `Mar 2026` from a `YYYY-MM` key. */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthKey(s: ISODate): string {
  return s ? s.slice(0, 7) : '';
}

/** Every `YYYY-MM` from `from` to `to`, inclusive. */
export function monthRange(from: ISODate, to: ISODate): string[] {
  const a = parseISO(from);
  const b = parseISO(to);
  if (!a || !b) return [];
  const out: string[] = [];
  const cur = new Date(a.getFullYear(), a.getMonth(), 1);
  const end = new Date(b.getFullYear(), b.getMonth(), 1);
  while (cur <= end && out.length < 240) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** "3 days ago" / "in 5 days" — for ages and countdowns, never for stored values. */
export function relativeDays(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${Math.abs(n)} days ago`;
}
