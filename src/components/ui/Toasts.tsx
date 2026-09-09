import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { cx, IconButton } from '@/components/ui/primitives';

const ICONS = { success: CheckCircle2, danger: XCircle, warning: AlertTriangle, neutral: Info };
const STYLES = {
  success: 'border-success/25 bg-success-bg text-success',
  danger: 'border-danger/25 bg-danger-bg text-danger',
  warning: 'border-warning/25 bg-warning-bg text-warning',
  neutral: 'border-line bg-surface text-ink',
};

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            className={cx('pointer-events-auto flex items-start gap-3 rounded-card border p-3.5 shadow-pop animate-scale-in', STYLES[t.tone])}
          >
            <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[12.5px] leading-relaxed opacity-90">{t.body}</p> : null}
            </div>
            <IconButton label="Dismiss" icon={X} size="sm" onClick={() => dismissToast(t.id)} className="-mr-1 -mt-1 hover:bg-black/5" />
          </div>
        );
      })}
    </div>
  );
}
