import { NavLink, Navigate, Outlet, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Info, LayoutDashboard, ListChecks, PieChart, Send, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp, useProject } from '@/store/AppStore';
import { Card, cx, EmptyState, Pill } from '@/components/ui/primitives';
import { HealthPill } from '@/components/ui/StatusPills';
import { ProjectSwitcher } from '@/components/layout/TopBar';
import { projectMetrics } from '@/lib/derive';
import { formatZAR } from '@/lib/money';
import { formatDate } from '@/lib/dates';

const TABS = [
  { to: '.', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: 'setup', end: false, label: 'Setup', icon: Settings2 },
  { to: 'plan', end: false, label: 'Delivery Plan', icon: ListChecks },
  { to: 'submissions', end: false, label: 'Submissions Register', icon: Send },
  { to: 'documents', end: false, label: 'Documents', icon: FileText },
  { to: 'reports', end: false, label: 'Reports', icon: PieChart },
];

export default function ProjectWorkspace() {
  const { projectId } = useParams();
  const { state } = useApp();
  const data = useProject(projectId);

  if (!data) {
    return (
      <Card>
        <EmptyState
          title="That project does not exist"
          body="It may have been deleted, or the address may be wrong. Go back to the projects list and pick one."
          action={<Link to="/projects" className="text-sm font-semibold text-cyan-link hover:underline">Back to projects</Link>}
        />
      </Card>
    );
  }

  const m = projectMetrics(state, data.project);
  const pm = state.people.find((p) => p.id === data.project.projectManagerId);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
        <Link to="/projects" className="rounded font-medium hover:text-indigo hover:underline">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5 text-ink-faint" strokeWidth={2} aria-hidden />
        <span className="truncate text-indigo">{data.project.name}</span>
      </nav>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-indigo sm:text-2xl">
              {data.project.name}
            </h1>
            <HealthPill health={m.health} />
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">
            {data.project.client}
            {data.project.contractRef ? <> · <span className="tabular-nums">{data.project.contractRef}</span></> : null}
            {pm ? <> · {pm.name}</> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="lg:hidden"><ProjectSwitcher /></div>
          <Pill tone="neutral">{m.phaseReached}</Pill>
          <Pill tone="neutral">{formatZAR(data.project.contractValue, { decimals: false })}</Pill>
          <Pill tone={m.time.daysRemaining !== null && m.time.daysRemaining < 60 ? 'warning' : 'neutral'}>
            {m.time.daysRemaining !== null && m.time.daysRemaining >= 0
              ? `${m.time.daysRemaining} days remaining`
              : `Ended ${formatDate(data.project.contractedCompletion)}`}
          </Pill>
        </div>
      </div>

      <div className="mb-5 border-b border-line">
        <nav aria-label="Project sections" className="rw-scroll -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <NavLink
              key={t.label}
              to={t.to}
              end={t.end}
              className={({ isActive }) => cx(
                'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors',
                isActive
                  ? 'border-cyan-600 text-indigo'
                  : 'border-transparent text-ink-muted hover:border-line hover:text-indigo',
              )}
            >
              <t.icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </>
  );
}

/**
 * The reminder that sits above Setup and the Delivery Plan. It is deliberately
 * persistent: this system is ours, and it does not replace the client's workbook.
 */
export function ProjectManagerReminder() {
  return (
    <div className="mb-5 flex gap-3 rounded-card border border-warning/25 bg-warning-bg p-4">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning" strokeWidth={2} aria-hidden />
      <div className="min-w-0 text-[13px] leading-relaxed text-warning">
        <p className="font-bold">Reminder for the project manager.</p>
        <p className="mt-1">
          This system is ours. It does not replace the client's project plan workbook. Every change made
          here must also be reflected in the client's workbook, and every submission recorded here must
          actually be sent and acknowledged. A phase is complete only when the submission has been made
          and acknowledged, not when the internal work is finished.
        </p>
      </div>
    </div>
  );
}

export function ProjectNotFound() {
  return <Navigate to="/projects" replace />;
}
