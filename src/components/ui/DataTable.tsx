import React, { useCallback, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cx } from '@/components/ui/primitives';

export interface Column<T> {
  key: string;
  header: string;
  /** Desktop cell. */
  cell: (row: T) => React.ReactNode;
  /** How the column appears once the table becomes cards on a phone. */
  mobile?: 'title' | 'meta' | 'field' | 'hidden';
  align?: 'left' | 'right' | 'center';
  width?: string;
  sortValue?: (row: T) => string | number;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Announced to screen readers and used as the accessible name. */
  caption: string;
  empty?: React.ReactNode;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  dense?: boolean;
  /** Rendered on the left of every row, outside the click target. */
  leading?: (row: T) => React.ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}

/**
 * One table, two shapes. A real `<table>` from `md` up; a stack of cards below
 * it — never a horizontally scrolling table on a phone.
 */
export function DataTable<T>({
  columns, rows, rowKey, onRowClick, caption, empty, className, rowClassName,
  dense, leading, initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * factor;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev?.key === key
        ? (prev.dir === 'asc' ? { key, dir: 'desc' } : null)
        : { key, dir: 'asc' });
  };

  /** Up/down moves between rows; Home/End jump; Enter or Space opens. */
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const row = target.closest<HTMLElement>('[data-row]');
    if (!row) return;
    const all = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []);
    const i = all.indexOf(row);
    if (e.key === 'ArrowDown') { e.preventDefault(); all[Math.min(i + 1, all.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); all[Math.max(i - 1, 0)]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); all[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); all[all.length - 1]?.focus(); }
    else if ((e.key === 'Enter' || e.key === ' ') && onRowClick && target === row) {
      e.preventDefault();
      const key = row.dataset.row;
      const found = sorted.find((r) => rowKey(r) === key);
      if (found) onRowClick(found);
    }
  }, [onRowClick, sorted, rowKey]);

  if (rows.length === 0 && empty) return <>{empty}</>;

  const titleCol = columns.find((c) => c.mobile === 'title') ?? columns[0];
  const metaCols = columns.filter((c) => c.mobile === 'meta');
  const fieldCols = columns.filter((c) => c.mobile === 'field' || (!c.mobile && c !== titleCol));

  const pad = dense ? 'px-3 py-2' : 'px-4 py-3';
  const alignClass = (a?: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              {leading ? <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Select</span></th> : null}
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  style={c.width ? { width: c.width } : undefined}
                  className={cx(
                    'bg-canvas/60 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint',
                    alignClass(c.align), c.headerClassName,
                  )}
                  aria-sort={
                    sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined
                  }
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cx('inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-indigo', alignClass(c.align))}
                    >
                      {c.header}
                      {sort?.key === c.key
                        ? (sort.dir === 'asc'
                            ? <ArrowUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                            : <ArrowDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />)
                        : <ArrowUpDown className="h-3 w-3 opacity-40" strokeWidth={2.5} aria-hidden />}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={bodyRef} onKeyDown={onKeyDown}>
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                data-row={rowKey(row)}
                tabIndex={onRowClick ? 0 : -1}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  'border-b border-line/70 last:border-b-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-cyan-50/60 focus:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00D2F5]',
                  rowClassName?.(row),
                )}
              >
                {leading ? <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>{leading(row)}</td> : null}
                {columns.map((c) => (
                  <td key={c.key} className={cx(pad, 'align-top text-ink', alignClass(c.align), c.cellClassName)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone and small tablet: one card per row. */}
      <ul className="space-y-2.5 md:hidden" aria-label={caption}>
        {sorted.map((row) => (
          <li key={rowKey(row)}>
            <div
              data-row={rowKey(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
              } : undefined}
              className={cx(
                'rounded-xl border border-line bg-surface p-4 shadow-card',
                onRowClick && 'cursor-pointer active:bg-cyan-50/60',
                rowClassName?.(row),
              )}
            >
              <div className="flex items-start gap-3">
                {leading ? <div onClick={(e) => e.stopPropagation()} className="pt-0.5">{leading(row)}</div> : null}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-indigo">{titleCol.cell(row)}</div>
                  {metaCols.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {metaCols.map((c) => <div key={c.key}>{c.cell(row)}</div>)}
                    </div>
                  ) : null}
                </div>
              </div>
              {fieldCols.length > 0 ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-3">
                  {fieldCols.map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{c.header}</dt>
                      <dd className="mt-0.5 text-[13px] text-ink">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
