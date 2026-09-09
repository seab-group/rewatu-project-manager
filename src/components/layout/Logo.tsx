import { cx } from '@/components/ui/primitives';

/** The mark. The cyan-to-violet gradient belongs here, on the primary button, and on the active nav tile — nowhere else. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx('shrink-0', className)} role="img" aria-label="Rewatu Solutions">
      <defs>
        <linearGradient id="rw-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00D2F5" />
          <stop offset="100%" stopColor="#7B5CFA" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rw-mark)" />
      <path
        d="M11 22.5V9.5h6.2c2.6 0 4.3 1.6 4.3 3.9 0 1.8-1 3.1-2.7 3.6l3.2 5.5h-3.2l-2.8-5.1h-2.1v5.1H11Zm2.9-7.4h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6h-3v3.2Z"
        fill="#fff"
      />
    </svg>
  );
}

export function LogoLockup({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="h-8 w-8" />
      {!collapsed ? (
        <div className="min-w-0 leading-none">
          <div className="text-[15px] font-bold tracking-tight text-white">REWATU</div>
          <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
            Project Management
          </div>
        </div>
      ) : null}
    </div>
  );
}
