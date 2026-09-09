import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, ListChecks } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { Card, CardBody, cx, Pill, toneDot } from '@/components/ui/primitives';
import { countTasks, tasksFor } from '@/lib/tasks';

/**
 * The first thing anyone should read. It answers one question — what needs me
 * today — and links straight to it, so nothing is missed because it was three
 * screens away.
 */
export function TodayPanel({ compact }: { compact?: boolean }) {
  const { state, alerts, currentUser } = useApp();
  const tasks = tasksFor(state, currentUser);
  const counts = countTasks(tasks);
  const read = new Set(state.readAlertIds);
  const critical = alerts.filter((a) => a.severity === 'critical');
  const top = alerts.slice(0, compact ? 3 : 5);

  const clear = alerts.length === 0 && counts.overdue === 0;

  return (
    <Card className={cx('overflow-hidden', clear ? '' : critical.length ? 'border-danger/25' : 'border-warning/25')}>
      <div className={cx('h-1 w-full', clear ? 'bg-success' : critical.length ? 'bg-danger' : 'bg-warning')} aria-hidden />
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-indigo">
              {clear ? 'Nothing needs you today' : `${alerts.length} thing${alerts.length === 1 ? '' : 's'} need you today`}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              {clear
                ? 'No overdue work, no returned submissions, nothing waiting on a file. Worked out from your projects just now.'
                : 'Worked out from your projects just now. Deal with the thing and the alert goes on its own.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {counts.overdue > 0 ? <Pill tone="danger" icon={AlertTriangle}>{counts.overdue} overdue</Pill> : null}
            {counts.dueThisWeek > 0 ? <Pill tone="warning">{counts.dueThisWeek} due this week</Pill> : null}
            {counts.open > 0 ? <Pill tone="neutral" icon={ListChecks}>{counts.open} open</Pill> : null}
            {clear ? <Pill tone="success" icon={CheckCircle2}>All clear</Pill> : null}
          </div>
        </div>

        {top.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {top.map((a) => (
              <li key={a.id}>
                <Link
                  to={a.href}
                  className={cx(
                    'flex items-start gap-2.5 rounded-lg border p-3 transition-colors hover:bg-canvas',
                    read.has(a.id) ? 'border-line' : 'border-line bg-cyan-50/30',
                  )}
                >
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDot(a.tone))} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-indigo">{a.title}</span>
                    <span className="mt-0.5 block line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">{a.body}</span>
                    <span className="mt-1 block truncate text-[11.5px] text-ink-faint">{a.projectName} · {a.kind}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link to="/tasks" className="inline-flex items-center gap-1.5 rounded text-[13px] font-semibold text-cyan-link hover:underline">
            Open my tasks <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </Link>
          {alerts.length > top.length ? (
            <span className="text-[12.5px] text-ink-muted">
              {alerts.length - top.length} more in the bell, top right.
            </span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
