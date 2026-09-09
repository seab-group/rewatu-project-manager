import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderKanban, LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Button, Card, CardBody, CardHeader, EmptyState, Pill, ProgressBar, SegmentedControl, Skeleton,
} from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { HealthPill } from '@/components/ui/StatusPills';
import { Select } from '@/components/ui/form';
import { portfolioMetrics, type ProjectMetrics } from '@/lib/derive';
import { canCreateProject, visibleProjects } from '@/lib/permissions';
import { formatZAR } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { HEALTH } from '@/data/reference';
import { useInitialLoad } from '@/lib/useLoading';

export default function ProjectsList() {
  const { state, currentUser } = useApp();
  const navigate = useNavigate();
  const loading = useInitialLoad();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [q, setQ] = useState('');
  const [health, setHealth] = useState('');

  const visibleIds = useMemo(
    () => new Set(visibleProjects(state, currentUser).map((p) => p.id)),
    [state, currentUser],
  );
  const all = useMemo(
    () => portfolioMetrics(state).perProject.filter((m) => visibleIds.has(m.project.id)),
    [state, visibleIds],
  );
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((m) => {
      if (health && m.health !== health) return false;
      if (!term) return true;
      return `${m.project.name} ${m.project.client} ${m.project.contractRef}`.toLowerCase().includes(term);
    });
  }, [all, q, health]);

  if (loading) {
    return (
      <>
        <div className="mb-5"><Skeleton className="h-7 w-40" /></div>
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-5 h-2 w-full rounded-full" />
              <div className="mt-5 grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-8" />)}
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${all.length} project${all.length === 1 ? '' : 's'}. Every one carries the standard delivery plan and submissions register.`}
        action={canCreateProject(currentUser)
          ? <Button variant="primary" icon={Plus} onClick={() => navigate('/projects/new')}>New project</Button>
          : undefined}
      />

      <Card className="mb-5">
        <CardBody className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="proj-search" className="sr-only">Search projects</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={2} aria-hidden />
            <input
              id="proj-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by project, client or contract reference"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm placeholder:text-ink-faint hover:border-[#CFD8E1]"
            />
            {q ? (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-indigo">
                <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-44">
              <label htmlFor="proj-health" className="sr-only">Filter by health</label>
              <Select id="proj-health" options={HEALTH} placeholder="All health" value={health} onChange={(e) => setHealth(e.target.value)} />
            </div>
            <SegmentedControl
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'cards', label: 'Cards', icon: LayoutGrid },
                { value: 'table', label: 'Table', icon: List },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={all.length === 0 ? 'No projects yet' : 'No project matches those filters'}
            body={all.length === 0
              ? 'Create the first project. Its delivery plan and submissions register are seeded from the standard template — 55 steps across 10 phases and 22 register entries — so nobody starts from an empty grid.'
              : 'Clear the search or the health filter to see the rest of the portfolio.'}
            action={all.length === 0
              ? <Button icon={Plus} onClick={() => navigate('/projects/new')}>New project</Button>
              : <Button onClick={() => { setQ(''); setHealth(''); }}>Clear filters</Button>}
          />
        </Card>
      ) : view === 'cards' ? (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((m) => <ProjectCard key={m.project.id} m={m} />)}
        </div>
      ) : (
        <Card>
          <CardHeader title="All projects" subtitle="Click a row to open the workspace." />
          <CardBody className="pt-4">
            <ProjectsTable rows={rows} />
          </CardBody>
        </Card>
      )}
    </>
  );
}

function ProjectCard({ m }: { m: ProjectMetrics }) {
  const { state } = useApp();
  const pm = state.people.find((p) => p.id === m.project.projectManagerId);

  return (
    <Card as="div" className="transition-shadow hover:shadow-raised">
      <Link to={`/projects/${m.project.id}`} className="block rounded-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-snug text-indigo">{m.project.name}</h2>
            <p className="mt-1 text-[13px] text-ink-muted">{m.project.client}</p>
          </div>
          <HealthPill health={m.health} size="sm" />
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-medium text-ink-muted">{m.phaseReached}</span>
            <span className="text-[12.5px] font-semibold tabular-nums text-indigo">
              {m.delivery.completedPct}% · {m.delivery.completed}/{m.delivery.total} steps
            </span>
          </div>
          <ProgressBar value={m.delivery.completedPct} className="mt-2" label={`${m.delivery.completedPct}% of steps complete`} />
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Contract</dt>
            <dd className="mt-1 text-[13px] font-semibold tabular-nums text-indigo">{formatZAR(m.money.contractValue, { decimals: false })}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Invoiced</dt>
            <dd className="mt-1 text-[13px] font-semibold tabular-nums text-indigo">{m.money.invoicedPct}%</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Manager</dt>
            <dd className="mt-1 truncate text-[13px] text-ink">{pm?.name ?? '—'}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {m.delivery.overdue > 0 ? <Pill tone="danger" size="sm">{m.delivery.overdue} overdue</Pill> : null}
          {m.delivery.blocked > 0 ? <Pill tone="danger" size="sm">{m.delivery.blocked} blocked</Pill> : null}
          {m.submissions.awaiting > 0 ? <Pill tone="warning" size="sm">{m.submissions.awaiting} awaiting acknowledgement</Pill> : null}
          {m.attention.completedNoEvidence > 0 ? <Pill tone="warning" size="sm">{m.attention.completedNoEvidence} missing evidence</Pill> : null}
          {m.delivery.overdue === 0 && m.delivery.blocked === 0 && m.submissions.awaiting === 0 && m.attention.completedNoEvidence === 0
            ? <Pill tone="success" size="sm">Nothing outstanding</Pill>
            : null}
        </div>

        {m.nextSubmissionDue ? (
          <p className="mt-4 text-[12.5px] text-ink-muted">
            Next submission: <span className="font-medium text-indigo">{m.nextSubmissionDue.label}</span>
            {' · '}{formatDate(m.nextSubmissionDue.date)}
          </p>
        ) : null}
      </Link>
    </Card>
  );
}

function ProjectsTable({ rows }: { rows: ProjectMetrics[] }) {
  const navigate = useNavigate();
  const { state } = useApp();

  const columns: Array<Column<ProjectMetrics>> = [
    {
      key: 'name', header: 'Project', mobile: 'title', sortValue: (m) => m.project.name,
      cell: (m) => (
        <div className="min-w-0">
          <p className="font-semibold text-indigo">{m.project.name}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">{m.project.client}</p>
        </div>
      ),
    },
    { key: 'health', header: 'Health', mobile: 'meta', width: '150px', sortValue: (m) => m.health, cell: (m) => <HealthPill health={m.health} size="sm" /> },
    { key: 'phase', header: 'Phase reached', mobile: 'field', width: '180px', sortValue: (m) => m.phaseReached, cell: (m) => <span className="text-[13px]">{m.phaseReached}</span> },
    {
      key: 'progress', header: 'Progress', mobile: 'field', width: '150px', sortValue: (m) => m.delivery.completedPct,
      cell: (m) => (
        <div>
          <span className="text-[13px] font-semibold tabular-nums text-indigo">{m.delivery.completedPct}%</span>
          <ProgressBar value={m.delivery.completedPct} className="mt-1.5" height="h-1.5" label={`${m.delivery.completedPct}% complete`} />
        </div>
      ),
    },
    {
      key: 'pm', header: 'Project manager', mobile: 'field', width: '160px',
      cell: (m) => <span className="text-[13px]">{state.people.find((p) => p.id === m.project.projectManagerId)?.name ?? '—'}</span>,
    },
    {
      key: 'value', header: 'Contract value', mobile: 'field', align: 'right', width: '145px', sortValue: (m) => m.money.contractValue,
      cell: (m) => <span className="text-[13px] font-semibold tabular-nums">{formatZAR(m.money.contractValue, { decimals: false })}</span>,
    },
    {
      key: 'next', header: 'Next submission due', mobile: 'field', width: '200px',
      cell: (m) => m.nextSubmissionDue
        ? <div><p className="truncate text-[13px]">{m.nextSubmissionDue.label}</p><p className="text-[11.5px] text-ink-faint">{formatDate(m.nextSubmissionDue.date)}</p></div>
        : <span className="text-[13px] text-ink-faint">—</span>,
    },
  ];

  return (
    <DataTable
      caption="Projects with health, phase, progress and money"
      columns={columns}
      rows={rows}
      rowKey={(m) => m.project.id}
      onRowClick={(m) => navigate(`/projects/${m.project.id}`)}
    />
  );
}
