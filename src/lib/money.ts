/** All amounts in this system are VAT inclusive. */
export function formatZAR(n: number, opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? true;
  const safe = Number.isFinite(n) ? n : 0;
  return `R${safe.toLocaleString('en-ZA', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}

/** Compact form for chart axes and tiles: R498.7k, R1.2m. */
export function formatZARCompact(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  const fixed = (v: number, dp: number) =>
    v.toLocaleString('en-ZA', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  if (abs >= 1_000_000) return `${sign}R${fixed(abs / 1_000_000, abs >= 10_000_000 ? 0 : 1)}m`;
  if (abs >= 1_000) return `${sign}R${fixed(abs / 1_000, abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}R${fixed(abs, 0)}`;
}

export function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[R\s,]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Money to the cent. Subtracting two rands otherwise leaves binary dust. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
