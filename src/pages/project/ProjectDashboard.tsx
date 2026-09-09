import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Send, Wallet,
} from 'lucide-react';
import { useApp, useProject } from '@/store/AppStore';
import { Card, CardBody, CardHeader, cx, Pill, ProgressBar } from '@/components/ui/primitives';
import { Metric } from '@/components/ui/StatTile';
import { HealthPill } from '@/components/ui/StatusPills';
import { AttentionTable } from '@/pages/PortfolioDashboard';
import { Donut } from '@/components/charts/Charts';
import { CHART } from '@/components/charts/theme';
import { attentionList, phaseProgress, projectMetrics, stepFlag } from '@/lib/derive';
import { formatZAR } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { PHASES } from '@/data/reference';

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const { state } = useApp();
  const navigate = useNavigate();
  const data = useProject(projectId);

  const m = useMemo(() => (data ? projectMetrics(state, data.project) : null), [state, data]);
  const attention = useMemo(() => (data ? attentionList(state, data.project.id) : []), [state, data]);
  const phases = useMemo(() => (data ? phaseProgress(data.steps) : []), [data]);

  if (!data || !m) return null;

  const statusData = [
    { name: 'Completed', value: m.delivery.completed, color: CHART.success },
    { name: 'In progress', value: m.delivery.inProgress, color: CHART.cyan },
    { name: 'Not started', value: m.delivery.notStarted, color: CHART.neutral },
    { name: 'On hold', value: m.delivery.onHold, color: CHART.warning },
    { name: 'Blocked', value: m.delivery.blocked, color: CHART.danger },
  ];

  const varianceTone = m.time.scheduleVariance >= 0 ? 'success' : m.time.scheduleVariance >= -5 ? 'warning' : 'danger';

  return (
    <>
      {/* Health verdict */}
      <Card className="mb-5 overflow-hidden">
        <div className={cx(
          'h-1 w-full',
          m.health === 'At risk' ? 'bg-danger' : m.health === 'Behind schedule' ? 'bg-warning' : 'bg-success',
        )} aria-hidden />
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <HealthPill health={m.health} />
              <span className="text-[13px] text-ink-muted">{m.healthReason}</span>
            </div>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
              {m.health === 'At risk'
                ? 'A step is overdue or blocked. Until that clears, this project is at risk regardless of how much is complete.'
                : m.health === 'Behind schedule'
                  ? 'Completion is not keeping pace with elapsed contract time. Nothing is overdue yet.'
                  : 'Completion is keeping pace with elapsed contract time and nothing is overdue.'}
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <div className="text-right">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Complete</p>
              <p className="mt-1 text-3xl font-bold leading-none tracking-tight text-indigo tabular-nums">{m.delivery.completedPct}%</p>
            </div>
            <div className="w-px bg-line" aria-hidden />
            <div className="text-right">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Time elapsed</p>
              <p className="mt-1 text-3xl font-bold leading-none tracking-tight text-ink-muted tabular-nums">{m.time.elapsedPct}%</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Four metric blocks */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Delivery" subtitle="Steps in the plan, and where each one stands." action={<ClipboardList className="h-4 w-4 text-ink-faint" strokeWidth={2} aria-hidden />} />
          <CardBody className="pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <Metric label="Steps in plan" value={m.delivery.total} />
              <Metric label="Completed" value={m.delivery.completed} tone="success" />
              <Metric label="Completed %" value={`${m.delivery.completedPct}%`} />
              <Metric label="In progress" value={m.delivery.inProgress} />
              <Metric label="Not started" value={m.delivery.notStarted} />
              <Metric label="Overdue" value={m.delivery.overdue} tone={m.delivery.overdue ? 'danger' : undefined} />
              <Metric label="Blocked" value={m.delivery.blocked} tone={m.delivery.blocked ? 'danger' : undefined} />
              <Metric label="Due within 7 days" value={m.delivery.dueWithin7} tone={m.delivery.dueWithin7 ? 'warning' : undefined} />
            </dl>
            <ProgressBar value={m.delivery.completedPct} className="mt-5" label={`${m.delivery.completedPct}% of steps complete`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Time" subtitle="The contract term against what has actually been delivered." action={<CalendarClock className="h-4 w-4 text-ink-faint" strokeWidth={2} aria-hidden />} />
          <CardBody className="pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <Metric label="Project start" value={<span className="text-[15px]">{formatDate(m.time.start)}</span>} />
              <Metric label="Contracted completion" value={<span className="text-[15px]">{formatDate(m.time.end)}</span>} />
              <Metric label="Today" value={<span className="text-[15px]">{formatDate(m.time.today)}</span>} />
              <Metric label="Days remaining" value={m.time.daysRemaining ?? '—'} tone={(m.time.daysRemaining ?? 99) < 30 ? 'warning' : undefined} />
              <Metric label="Time elapsed" value={`${m.time.elapsedPct}%`} />
              <Metric
                label="Schedule variance"
                value={`${m.time.scheduleVariance > 0 ? '+' : ''}${m.time.scheduleVariance}%`}
                tone={varianceTone}
                hint="Complete less elapsed"
              />
              <Metric label="Total days late" value={m.time.totalDaysLate} tone={m.time.totalDaysLate ? 'warning' : undefined} hint="Summed across steps" />
              <Metric label="Total days" value={m.time.totalDays ?? '—'} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Money" subtitle="VAT inclusive." action={<Wallet className="h-4 w-4 text-ink-faint" strokeWidth={2} aria-hidden />} />
          <CardBody className="pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Metric label="Contract value" value={formatZAR(m.money.contractValue, { decimals: false })} />
              <Metric label="Invoiced" value={formatZAR(m.money.invoiced, { decimals: false })} />
              <Metric label="Paid" value={formatZAR(m.money.paid, { decimals: false })} tone="success" />
              <Metric label="Outstanding" value={formatZAR(m.money.outstanding, { decimals: false })} tone={m.money.outstanding ? 'warning' : undefined} />
              <Metric label="Still to invoice" value={formatZAR(m.money.stillToInvoice, { decimals: false })} />
              <Metric label="Invoiced %" value={`${m.money.invoicedPct}%`} />
            </dl>
            <ProgressBar value={m.money.invoicedPct} className="mt-5" label={`${m.money.invoicedPct}% of the contract value invoiced`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Submissions" subtitle="A phase is complete only once the client acknowledges." action={<Send className="h-4 w-4 text-ink-faint" strokeWidth={2} aria-hidden />} />
          <CardBody className="pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Metric label="Required" value={m.submissions.required} />
              <Metric label="Acknowledged" value={m.submissions.acknowledged} tone="success" />
              <Metric label="Awaiting" value={m.submissions.awaiting} tone={m.submissions.awaiting ? 'warning' : undefined} hint="Submitted, not acknowledged" />
              <Metric label="Returned for correction" value={m.submissions.returned} tone={m.submissions.returned ? 'danger' : undefined} />
              <Metric label="Not yet due" value={m.submissions.notYetDue} />
              <Metric label="Acknowledged %" value={`${m.submissions.acknowledgedPct}%`} />
            </dl>
            <ProgressBar
              value={m.submissions.acknowledgedPct}
              tone="success"
              className="mt-5"
              label={`${m.submissions.acknowledgedPct}% of submissions acknowledged`}
            />
          </CardBody>
        </Card>
      </div>

      {/* Attention */}
      <Card className="mt-5">
        <CardHeader
          title="Attention"
          subtitle="What is not yet true, even where the status column says otherwise."
        />
        <CardBody className="pt-4">
          <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-4 border-b border-line pb-5 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Done, not acknowledged" value={m.attention.doneNotAcknowledged} tone={m.attention.doneNotAcknowledged ? 'warning' : undefined} />
            <Metric label="No planned end date" value={m.attention.noPlannedEnd} tone={m.attention.noPlannedEnd ? 'warning' : undefined} />
            <Metric label="No responsible party" value={m.attention.noResponsible} tone={m.attention.noResponsible ? 'warning' : undefined} />
            <Metric label="Complete, no evidence" value={m.attention.completedNoEvidence} tone={m.attention.completedNoEvidence ? 'danger' : undefined} />
            <Metric
              label="Departmental workbook age"
              value={m.attention.workbookAgeDays === null ? '—' : `${m.attention.workbookAgeDays} days`}
              tone={m.attention.workbookAgeDays === null ? undefined : m.attention.workbookAgeDays > 14 ? 'danger' : m.attention.workbookAgeDays > 7 ? 'warning' : 'success'}
            />
          </dl>
          <AttentionTable items={attention} />
        </CardBody>
      </Card>

      {/* Phase progress and status mix */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Progress by phase" subtitle="Complete means delivered and, where required, acknowledged." />
          <CardBody className="pt-4">
            <ul className="space-y-3.5">
              {phases.map((p) => {
                const pctDone = p.total ? Math.round((p.complete / p.total) * 100) : 0;
                return (
                  <li key={p.phase}>
                    <button
                      type="button"
                      onClick={() => navigate(`../plan?phase=${encodeURIComponent(p.phase)}`)}
                      className="block w-full rounded-lg text-left"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[13px] font-medium text-indigo">{p.phase}</span>
                        <span className="shrink-0 text-[12px] tabular-nums text-ink-muted">
                          <span className="font-semibold text-indigo">{p.complete}</span>/{p.total} · {pctDone}%
                        </span>
                      </div>
                      <ProgressBar value={pctDone} className="mt-1.5" height="h-1.5" label={`${p.phase}: ${pctDone}% complete`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Steps by status" subtitle="What the status column says, before the flag rules are applied." />
          <CardBody className="pt-4">
            <Donut
              data={statusData}
              centreValue={m.delivery.total}
              centreLabel="Steps"
              height={180}
              ariaLabel={`Steps by status: ${statusData.filter((d) => d.value).map((d) => `${d.value} ${d.name}`).join(', ')}`}
            />
          </CardBody>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="mt-5">
        <CardHeader title="Phase timeline" subtitle="Where this project sits across the ten phases." />
        <CardBody className="pt-4">
          <PhaseTimeline
            phases={phases}
            reached={m.phaseReached}
            steps={data.steps}
          />
        </CardBody>
      </Card>
    </>
  );
}

function PhaseTimeline({
  phases, reached, steps,
}: {
  phases: Array<{ phase: string; complete: number; total: number }>;
  reached: string;
  steps: ReturnType<typeof useProject> extends null ? never : NonNullable<ReturnType<typeof useProject>>['steps'];
}) {
  const reachedIndex = PHASES.indexOf(reached as (typeof PHASES)[number]);

  return (
    <ol className="rw-scroll flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5 sm:overflow-visible lg:grid-cols-5 2xl:grid-cols-10 2xl:gap-x-3">
      {phases.map((p, i) => {
        const inPhase = steps.filter((s) => s.phase === p.phase);
        const hasTrouble = inPhase.some((s) => {
          const f = stepFlag(s);
          return f === 'Overdue' || f === 'Blocked';
        });
        const done = p.total > 0 && p.complete === p.total;
        const current = i === reachedIndex;
        const state = hasTrouble ? 'trouble' : done ? 'done' : current ? 'current' : i < reachedIndex ? 'partial' : 'future';

        return (
          <li key={p.phase} className="min-w-[128px] flex-1 sm:min-w-0">
            <div
              className={cx(
                'h-1.5 w-full rounded-full',
                state === 'trouble' ? 'bg-danger'
                  : state === 'done' ? 'bg-success'
                  : state === 'current' ? 'bg-cyan-600'
                  : state === 'partial' ? 'bg-cyan-600/40'
                  : 'bg-[#EDF1F5]',
              )}
              aria-hidden
            />
            <p className={cx('mt-2 text-[12px] font-semibold leading-snug', current ? 'text-indigo' : 'text-ink-muted')}>
              {p.phase}
            </p>
            <p className="mt-1 text-[11.5px] tabular-nums text-ink-faint">{p.complete}/{p.total} steps</p>
            {current ? <Pill tone="neutral" size="sm" className="mt-1.5">Current</Pill> : null}
            {hasTrouble ? (
              <Pill tone="danger" size="sm" icon={AlertTriangle} className="mt-1.5">Attention</Pill>
            ) : done ? (
              <Pill tone="success" size="sm" icon={CheckCircle2} className="mt-1.5">Complete</Pill>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
