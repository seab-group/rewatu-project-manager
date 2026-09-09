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

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

/* ------------------------------------------------------------------ *
 * Calendar grids and loose input
 * ------------------------------------------------------------------ */

/**
 * The 42 dates of a month's grid, Monday first, including the days that spill
 * in from either side. Always six weeks, so a grid never changes height as the
 * month changes.
 */
export function monthGridDates(month: string): ISODate[] {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return [];
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(y, m - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, i) =>
    toISO(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

export function monthOf(date: ISODate): string {
  return date.slice(0, 7);
}

export function shiftMonthKey(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isWeekendDate(date: ISODate): boolean {
  const d = parseISO(date);
  if (!d) return false;
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Inclusive range check, tolerating empty bounds. */
export function withinRange(date: ISODate, min?: string, max?: string): boolean {
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
}

const MONTH_LOOKUP = new Map<string, number>();
MONTH_NAMES.forEach((name, i) => {
  MONTH_LOOKUP.set(name.toLowerCase(), i + 1);
  MONTH_LOOKUP.set(MONTHS[i].toLowerCase(), i + 1);
});

function build(y: number, m: number, d: number): ISODate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  // Rejects the 31st of a 30-day month rather than rolling it into the next one.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toISO(date);
}

/**
 * Parse what someone actually types. Day first, because that is how dates are
 * written here: `12/03/2026`, `12-3-26`, `12 Mar 2026`, `12 March 2026`, and
 * the ISO form the system stores.
 */
export function parseLooseDate(text: string, pivotYear = new Date().getFullYear()): ISODate | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return null;

  const iso = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const named = t.match(/^(\d{1,2})[ -]([A-Za-z]+)[ -,]+(\d{2,4})$/);
  if (named) {
    const m = MONTH_LOOKUP.get(named[2].toLowerCase());
    if (!m) return null;
    return build(expandYear(Number(named[3]), pivotYear), m, Number(named[1]));
  }

  const dmy = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    return build(expandYear(Number(dmy[3]), pivotYear), Number(dmy[2]), Number(dmy[1]));
  }

  return null;
}

/** `26` becomes 2026, not 1926. */
function expandYear(y: number, pivotYear: number): number {
  if (y >= 1000) return y;
  const century = Math.floor(pivotYear / 100) * 100;
  return century + y;
}
