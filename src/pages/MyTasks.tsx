import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertOctagon, AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardCheck,
  FileUp, ListChecks, Play, Search, UserRound, Users, X,
} from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Button, Card, CardBody, CardHeader, cx, EmptyState, InlineMessage, Pill, ProgressBar, Skeleton,
} from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Field, TextArea } from '@/components/ui/form';
import { FlagPill } from '@/components/ui/StatusPills';
import { StatTile } from '@/components/ui/StatTile';
import { UploadDialog, type UploadTarget } from '@/components/documents/Upload';
import {
  countTasks, groupByBucket, nextAction, tasksFor, teamTasks, type Task,
} from '@/lib/tasks';
import { describeStatusChange } from '@/pages/project/planHelpers';
import { formatDate, today } from '@/lib/dates';
import { leadsProject } from '@/lib/permissions';
import { useInitialLoad } from '@/lib/useLoading';
import type { DeliveryStep } from '@/types';

type Scope = 'mine' | 'team';

export default function MyTasks() {
  const { state, dispatch, currentUser, toast } = useApp();
  const loading = useInitialLoad();
  const [scope, setScope] = useState<Scope>('mine');
  const [projectFilter, setProjectFilter] = useState('');
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [upload, setUpload] = useState<UploadTarget | null>(null);
  const [confirming, setConfirming] = useState<{ task: Task; status: DeliveryStep['status'] } | null>(null);
  const [blocking, setBlocking] = useState<Task | null>(null);
  const [blockerNote, setBlockerNote] = useState('');

  const mine = useMemo(() => tasksFor(state, currentUser), [state, currentUser]);
  const team = useMemo(() => teamTasks(state, currentUser), [state, currentUser]);
  const runsSomething = state.projects.some((p) => !p.archived && leadsProject(currentUser, p))
    || currentUser.accessRole === 'Director';

  const source = scope === 'team' && runsSomething ? team : mine;

  const tasks = useMemo(() => {
    const term = q.trim().toLowerCase();
    return source.filter((t) => {
      if (!showDone && t.bucket === 'Done') return false;
      if (projectFilter && t.projectId !== projectFilter) return false;
      if (term && !`${t.step.step} ${t.step.action} ${t.step.deliverable}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [source, q, projectFilter, showDone]);

  const counts = countTasks(source);
  const groups = groupByBucket(tasks);
  const projects = useMemo(
    () => [...new Map(source.map((t) => [t.projectId, t.projectName])).entries()],
    [source],
  );

  if (loading) {
    return (
      <>
        <div className="mb-5"><Skeleton className="h-7 w-40" /><Skeleton className="mt-2 h-4 w-72" /></div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-8 w-16" /></Card>
          ))}
        </div>
        <Card className="mt-5 p-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </Card>
      </>
    );
  }

  const setStatus = (task: Task, status: DeliveryStep['status']) => {
    const docs = state.documents.filter((d) => d.projectId === task.projectId);
    const change = describeStatusChange(task.step, status, docs);
    if (change.blockedReason) {
      toast({ tone: 'danger', title: 'Not yet', body: change.blockedReason });
      setUpload({
        projectId: task.projectId, stepId: task.step.id,
        defaultName: task.step.deliverable || task.step.action, defaultType: 'Evidence',
      });
      return;
    }
    setConfirming({ task, status });
  };

  const applyStatus = () => {
    if (!confirming) return;
    const { task, status } = confirming;
    const patch: Partial<DeliveryStep> = { status };
    if (status === 'Completed') {
      patch.percentComplete = 100;
      if (!task.step.actualCompletion) patch.actualCompletion = today();
    }
    if (status === 'In progress' && task.step.percentComplete === 0) patch.percentComplete = 10;
    dispatch({ type: 'step/update', id: task.step.id, patch });
    toast({
      tone: 'success',
      title: status === 'Completed' ? `Step ${task.step.step} completed` : `Step ${task.step.step} is ${status.toLowerCase()}`,
      body: status === 'Completed' && task.step.submission !== 'Not required'
        ? 'The plan is updated. It stays Awaiting acknowledgement until the client acknowledges the submission.'
        : 'The delivery plan has been updated.',
    });
    setConfirming(null);
  };

  const applyBlocker = () => {
    if (!blocking) return;
    dispatch({
      type: 'step/update',
      id: blocking.step.id,
      patch: { status: 'Blocked', notes: blockerNote.trim() },
    });
    toast({
      tone: 'warning',
      title: `Step ${blocking.step.step} marked blocked`,
      body: 'It now shows on the project dashboard and the manager has been alerted.',
    });
    setBlocking(null);
    setBlockerNote('');
  };

  return (
    <>
      <PageHeader
        title={scope === 'team' ? 'Team tasks' : 'My tasks'}
        subtitle={scope === 'team'
          ? 'Everything on the projects you run, whoever it belongs to.'
          : 'Work assigned to you across every project. Doing it here updates the delivery plan.'}
        action={runsSomething ? (
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="Whose tasks">
            {([['mine', 'Mine', UserRound], ['team', 'Team', Users]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={scope === v}
                onClick={() => setScope(v)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                  scope === v ? 'bg-cyan-50 text-indigo' : 'text-ink-muted hover:text-indigo',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        ) : undefined}
      />

      <section aria-label="Task summary" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Open"
          value={counts.open}
          icon={ListChecks}
          tone="brand"
          sub={counts.open === 0 ? 'Nothing outstanding' : `${counts.done} already complete`}
        />
        {/* A green warning triangle would contradict itself, so a clear count
            gets the tick instead. */}
        <StatTile
          label="Overdue"
          value={counts.overdue}
          icon={counts.overdue ? AlertTriangle : CheckCircle2}
          tone={counts.overdue ? 'danger' : 'success'}
          sub={counts.overdue ? 'Past the planned end date' : 'Nothing has slipped'}
        />
        <StatTile
          label="Due this week"
          value={counts.dueThisWeek}
          icon={counts.dueThisWeek ? CalendarClock : CheckCircle2}
          tone={counts.dueThisWeek ? 'warning' : 'success'}
          sub="Planned to end within seven days"
        />
        <StatTile
          label="Waiting or blocked"
          value={counts.waiting + counts.blocked}
          icon={counts.waiting + counts.blocked ? AlertOctagon : CheckCircle2}
          tone={counts.waiting + counts.blocked ? 'warning' : 'success'}
          sub={`${counts.waiting} with the client, ${counts.blocked} blocked`}
        />
      </section>

      <Card className="mt-5">
        <CardBody className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="task-q" className="sr-only">Search tasks</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={2} aria-hidden />
            <input
              id="task-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your tasks"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm placeholder:text-ink-faint hover:border-[#CFD8E1]"
            />
            {q ? (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-indigo">
                <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="task-project">Filter by project</label>
            <select
              id="task-project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={cx('h-10 max-w-[16rem] cursor-pointer rounded-lg border bg-surface px-2.5 text-[13px] font-medium hover:border-[#CFD8E1]',
                projectFilter ? 'border-cyan-600 text-indigo' : 'border-line text-ink-muted')}
            >
              <option value="">All projects</option>
              {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <Button size="sm" variant={showDone ? 'secondary' : 'ghost'} onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Hide completed' : 'Show completed'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {groups.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={CheckCircle2}
            title={source.length === 0
              ? (scope === 'team' ? 'No work on your projects yet' : 'Nothing is assigned to you')
              : 'Nothing matches those filters'}
            body={source.length === 0
              ? (scope === 'team'
                  ? 'Once steps in the delivery plan have a named person on them, they appear here.'
                  : 'When a project manager puts your name on a delivery plan step, it lands here with what it needs from you.')
              : 'Clear the search or the project filter to see the rest.'}
            action={source.length === 0
              ? <Link to="/projects" className="text-sm font-semibold text-cyan-link hover:underline">Browse projects</Link>
              : <Button onClick={() => { setQ(''); setProjectFilter(''); }}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((g) => (
            <Card key={g.bucket}>
              <CardHeader
                title={g.bucket}
                subtitle={BUCKET_HINT[g.bucket]}
                action={<Pill tone={g.tasks[0].tone}>{g.tasks.length}</Pill>}
              />
              <CardBody className="pt-4">
                <ul className="space-y-3">
                  {g.tasks.map((t) => (
                    <li key={t.step.id}>
                      <TaskCard
                        task={t}
                        showOwner={scope === 'team'}
                        ownerName={state.people.find((p) => p.id === t.assigneeId)?.name ?? 'Unassigned'}
                        onStart={() => setStatus(t, 'In progress')}
                        onComplete={() => setStatus(t, 'Completed')}
                        onBlock={() => { setBlocking(t); setBlockerNote(t.step.notes); }}
                        onUpload={() => setUpload({
                          projectId: t.projectId, stepId: t.step.id,
                          defaultName: t.step.deliverable || t.step.action, defaultType: 'Evidence',
                        })}
                      />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={applyStatus}
        title={confirming ? `Mark step ${confirming.task.step.step} ${confirming.status.toLowerCase()}?` : ''}
        description={confirming?.task.step.action}
        confirmLabel="Update the plan"
      >
        {confirming?.status === 'Completed' && confirming.task.step.submission !== 'Not required' ? (
          <InlineMessage tone="warning" title="This does not close the step">
            It carries a submission to the client, so the flag becomes Awaiting acknowledgement. It is
            complete only once the client has acknowledged it.
          </InlineMessage>
        ) : (
          <InlineMessage tone="neutral" title="What this changes">
            The delivery plan on {confirming?.task.projectName} is updated, and the project dashboards follow.
          </InlineMessage>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!blocking}
        onClose={() => { setBlocking(null); setBlockerNote(''); }}
        onConfirm={applyBlocker}
        title={blocking ? `Flag step ${blocking.step.step} as blocked?` : ''}
        description={blocking?.step.action}
        confirmLabel="Flag as blocked"
        disabled={blockerNote.trim().length < 5}
      >
        <Field
          label="What is blocking it?"
          required
          htmlFor="blocker"
          hint="This goes to the project manager and shows on both dashboards. Say what you need and from whom."
        >
          <TextArea
            id="blocker"
            rows={3}
            value={blockerNote}
            onChange={(e) => setBlockerNote(e.target.value)}
            placeholder="Waiting on the department to raise the purchase order for the subscription."
          />
        </Field>
        <p className="mt-2 text-[12px] text-ink-muted">
          A blocked step puts the whole project At risk until it clears.
        </p>
      </ConfirmDialog>

      <UploadDialog open={!!upload} onClose={() => setUpload(null)} target={upload} />
    </>
  );
}

const BUCKET_HINT: Record<string, string> = {
  Overdue: 'Past the planned end date. These come first.',
  Blocked: 'Stopped by something outside the step. The manager sees these.',
  'Due today': 'Planned to finish today.',
  'Due this week': 'Planned to finish within seven days.',
  'Waiting on the client': 'Submitted. Not complete until it is acknowledged.',
  Later: 'Planned further out, or with no date yet.',
  Done: 'Delivered and acknowledged.',
};

const ACTION_ICON = {
  start: Play, upload: FileUp, complete: ClipboardCheck,
  submit: ArrowRight, unblock: AlertOctagon, wait: CalendarClock, none: CheckCircle2,
} as const;

function TaskCard({
  task, showOwner, ownerName, onStart, onComplete, onBlock, onUpload,
}: {
  task: Task; showOwner: boolean; ownerName: string;
  onStart: () => void; onComplete: () => void; onBlock: () => void; onUpload: () => void;
}) {
  const navigate = useNavigate();
  const next = nextAction(task);
  const Icon = ACTION_ICON[next.kind];
  const s = task.step;

  return (
    <div className={cx(
      'rounded-xl border p-3.5 transition-colors',
      task.bucket === 'Overdue' || task.bucket === 'Blocked'
        ? 'border-danger/25 bg-danger-bg/25'
        : task.bucket === 'Done' ? 'border-line bg-canvas' : 'border-line bg-surface',
    )}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        {/* What it is */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12px] font-bold tabular-nums text-ink-faint">{s.step}</span>
            <FlagPill flag={task.flag} size="sm" />
            {task.daysLate > 0 ? <Pill tone="danger" size="sm">{task.daysLate} days late</Pill> : null}
            {showOwner ? <Pill tone="neutral" size="sm" icon={UserRound}>{ownerName}</Pill> : null}
            {task.hasEvidence
              ? <Pill tone="success" size="sm">Evidence filed</Pill>
              : s.submission !== 'Not required' ? <Pill tone="warning" size="sm">No evidence</Pill> : null}
          </div>

          <p className="mt-1.5 text-[14px] font-semibold leading-snug text-indigo">{s.action}</p>

          <button
            type="button"
            onClick={() => navigate(`/projects/${task.projectId}/plan`)}
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded text-left text-[12px] text-ink-muted hover:text-indigo"
          >
            <span className="font-medium">{task.projectName}</span>
            <span aria-hidden>·</span>
            <span>{s.phase}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {s.plannedEnd ? `due ${formatDate(s.plannedEnd)}` : 'no planned end date'}
            </span>
            {s.deliverable ? <><span aria-hidden>·</span><span className="truncate">{s.deliverable}</span></> : null}
          </button>

          {s.notes ? (
            <p className="mt-2 rounded-lg bg-canvas p-2 text-[12px] leading-relaxed text-ink-muted">{s.notes}</p>
          ) : null}

          {s.percentComplete > 0 && s.percentComplete < 100 ? (
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar value={s.percentComplete} height="h-1.5" className="max-w-[12rem]" label={`${s.percentComplete}% complete`} />
              <span className="text-[11.5px] tabular-nums text-ink-faint">{s.percentComplete}%</span>
            </div>
          ) : null}
        </div>

        {/* What it needs from you */}
        <div className={cx(
          'shrink-0 rounded-lg border px-3 py-2.5 lg:w-[17.5rem]',
          next.kind === 'none' ? 'border-success/25 bg-success-bg/40' : 'border-line bg-canvas',
        )}>
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-indigo">
            <Icon className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2} aria-hidden />
            {next.label}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">{next.hint}</p>
          {next.kind !== 'none' ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {next.kind === 'start' || next.kind === 'unblock' ? (
                <Button size="sm" variant="primary" icon={Play} onClick={onStart}>
                  {next.kind === 'unblock' ? 'Unblock' : 'Start'}
                </Button>
              ) : null}
              {next.kind === 'upload' ? (
                <Button size="sm" variant="primary" icon={FileUp} onClick={onUpload}>Upload</Button>
              ) : null}
              {next.kind === 'complete' ? (
                <Button size="sm" variant="primary" icon={ClipboardCheck} onClick={onComplete}>Complete</Button>
              ) : null}
              {next.kind !== 'upload' ? (
                <Button size="sm" icon={FileUp} onClick={onUpload}>Evidence</Button>
              ) : null}
              {next.kind !== 'unblock' ? (
                <Button size="sm" variant="ghost" onClick={onBlock}>Blocked</Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
