import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Clock, FileWarning, FolderKanban, Plus, Wallet,
} from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, Card, CardBody, CardHeader, cx, EmptyState, Pill, ProgressBar, Skeleton } from '@/components/ui/primitives';
import { Metric, StatTile, StatTileSkeleton } from '@/components/ui/StatTile';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { HealthPill } from '@/components/ui/StatusPills';
import { CashLine, ChartLegend, Donut, InvoicedBullets, PhaseStackedBar } from '@/components/charts/Charts';
import { CHART } from '@/components/charts/theme';
import { attentionList, cashPosition, phaseProgress, portfolioMetrics, type AttentionItem, type ProjectMetrics } from '@/lib/derive';
import { formatZAR, formatZARCompact } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { useInitialLoad } from '@/lib/useLoading';
import { TodayPanel } from '@/components/TodayPanel';
import { canCreateProject, visibleProjects } from '@/lib/permissions';

export default function PortfolioDashboard() {
  const { state, currentUser } = useApp();
  const navigate = useNavigate();
  const loading = useInitialLoad();

  const visible = useMemo(() => visibleProjects(state, currentUser), [state, currentUser]);
  const activeIds = useMemo(() => new Set(visible.map((p) => p.id)), [visible]);
  const m = useMemo(() => {
    const all = portfolioMetrics(state);
    const perProject = all.perProject.filter((p) => activeIds.has(p.project.id));
    return { ...all, perProject };
  }, [state, activeIds]);
  const attention = useMemo(
    () => attentionList(state).filter((a) => activeIds.has(a.projectId)),
    [state, activeIds],
  );
  const phases = useMemo(
    () => phaseProgress(state.steps.filter((s) => activeIds.has(s.projectId))),
    [state.steps, activeIds],
  );
  const cash = useMemo(
    () => cashPosition(state.invoices.filter((i) => activeIds.has(i.projectId)), 12),
    [state.invoices, activeIds],
  );

  if (loading) return <DashboardSkeleton />;

  const healthData = [
    { name: 'On track', value: m.byHealth['On track'], color: CHART.success },
    { name: 'Behind schedule', value: m.byHealth['Behind schedule'], color: CHART.warning },
    { name: 'At risk', value: m.byHealth['At risk'], color: CHART.danger },
  ];

  const spendPct = m.costBudget ? Math.round((m.spendAgainstBudget / m.costBudget) * 100) : 0;
  const totalSteps = phases.reduce((s, p) => s + p.total, 0);
  const totalComplete = phases.reduce((s, p) => s + p.complete, 0);

  return (
    <>
      <PageHeader
        title="Portfolio dashboard"
        subtitle="Every active delivery, and where the money sits. All amounts are VAT inclusive."
        action={canCreateProject(currentUser)
          ? <Button variant="primary" icon={Plus} onClick={() => navigate('/projects/new')}>New project</Button>
          : undefined}
      />

      <TodayPanel compact />

      {/* Health strip */}
      <section aria-label="Portfolio health" className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active projects"
          value={m.activeProjects}
          icon={FolderKanban}
          tone="brand"
          sub={
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                {m.byHealth['On track']} on track
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
                {m.byHealth['Behind schedule']} behind
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
                {m.byHealth['At risk']} at risk
              </span>
            </span>
          }
          to="/projects"
        />
        <StatTile
          label="Steps overdue"
          value={m.overdueSteps}
          icon={AlertTriangle}
          tone={m.overdueSteps > 0 ? 'danger' : 'success'}
          sub={m.overdueSteps > 0 ? 'Past their planned end date across the portfolio' : 'Nothing is past its planned end date'}
        />
        <StatTile
          label="Awaiting acknowledgement"
          value={m.awaitingAcknowledgement}
          icon={Clock}
          tone={m.awaitingAcknowledgement > 0 ? 'warning' : 'success'}
          sub="Submitted to the client, not yet acknowledged"
        />
        <StatTile
          label="Documents outstanding"
          value={m.documentsOutstanding}
          icon={FileWarning}
          tone={m.documentsOutstanding > 0 ? 'warning' : 'success'}
          sub="Steps marked complete with no evidence uploaded"
          to="/documents"
        />
      </section>

      {/* Money */}
      <Card className="mt-5">
        <CardHeader
          title="Money"
          subtitle="Across active projects, VAT inclusive."
          action={<Pill tone="neutral" icon={Wallet}>ZAR</Pill>}
        />
        <CardBody className="pt-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Contracted value" value={formatZAR(m.contractValue, { decimals: false })} />
            <Metric label="Invoiced to date" value={formatZAR(m.invoiced, { decimals: false })} hint={`${Math.round((m.invoiced / (m.contractValue || 1)) * 100)}% of contracted`} />
            <Metric label="Paid to date" value={formatZAR(m.paid, { decimals: false })} tone="success" />
            <Metric label="Outstanding" value={formatZAR(m.outstanding, { decimals: false })} tone={m.outstanding > 0 ? 'warning' : undefined} hint="Invoiced, not yet paid" />
            <Metric label="Still to invoice" value={formatZAR(m.stillToInvoice, { decimals: false })} hint="Contracted less invoiced" />
          </dl>

          <div className="mt-6 grid gap-5 border-t border-line pt-5 lg:grid-cols-[1fr_auto_1fr]">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Forecast to invoice</h3>
              <p className="mt-1 text-[12.5px] text-ink-muted">From the phases due in each window.</p>
              <dl className="mt-3 grid grid-cols-3 gap-4">
                <Metric label="Next 30 days" value={formatZARCompact(m.forecast.d30)} />
                <Metric label="Next 60 days" value={formatZARCompact(m.forecast.d60)} />
                <Metric label="Next 90 days" value={formatZARCompact(m.forecast.d90)} />
              </dl>
            </div>
            <div className="hidden w-px bg-line lg:block" aria-hidden />
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Spend against budget</h3>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Where an internal cost budget has been captured.
              </p>
              {m.costBudget > 0 ? (
                <>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className={cx('text-[17px] font-bold tracking-tight tabular-nums', spendPct > 100 ? 'text-danger' : 'text-indigo')}>
                      {formatZAR(m.spendAgainstBudget, { decimals: false })}
                    </span>
                    <span className="text-[12.5px] text-ink-muted">
                      of {formatZAR(m.costBudget, { decimals: false })} budgeted
                    </span>
                  </div>
                  <ProgressBar
                    value={spendPct}
                    tone={spendPct > 100 ? 'danger' : spendPct > 90 ? 'warning' : 'brand'}
                    className="mt-2"
                    label={`${spendPct}% of the internal cost budget`}
                  />
                  <p className="mt-2 text-[12px] text-ink-muted">
                    {spendPct}% used
                    {spendPct > 100
                      ? ` — ${formatZAR(m.spendAgainstBudget - m.costBudget, { decimals: false })} over budget.`
                      : ` — ${formatZAR(m.costBudget - m.spendAgainstBudget, { decimals: false })} left.`}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-[13px] text-ink-faint">
                  No project has an internal cost budget captured yet. Add one on a project's Setup tab.
                </p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Charts */}
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Projects by health" subtitle="At risk means a step is overdue or blocked." />
          <CardBody className="pt-4">
            <Donut
              data={healthData}
              centreValue={m.activeProjects}
              centreLabel="Active"
              ariaLabel={`Projects by health: ${healthData.map((d) => `${d.value} ${d.name}`).join(', ')}`}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Portfolio progress by phase"
            subtitle={`${totalComplete} of ${totalSteps} steps complete across the ten phases.`}
          />
          <CardBody className="pt-4">
            <PhaseStackedBar data={phases} />
            <ChartLegend
              className="mt-3 justify-center"
              items={[{ label: 'Complete', color: CHART.cyan }, { label: 'Remaining', color: CHART.track }]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Invoiced against contracted" subtitle="By project. Paid sits inside invoiced." />
          <CardBody className="pt-4">
            <InvoicedBullets
              rows={m.perProject.map((p) => ({
                id: p.project.id,
                name: p.project.name,
                contracted: p.money.contractValue,
                invoiced: p.money.invoiced,
                paid: p.money.paid,
              }))}
              onSelect={(id) => navigate(`/projects/${id}`)}
            />
            <ChartLegend
              className="mt-4"
              items={[
                { label: 'Contracted', color: CHART.track },
                { label: 'Invoiced', color: CHART.violet },
                { label: 'Paid', color: CHART.cyan },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cash position over time" subtitle="Invoiced and paid, accumulated by month. Hover a point for that month's own figure." />
          <CardBody className="pt-4">
            <CashLine data={cash} />
            <ChartLegend
              className="mt-3 justify-center"
              items={[
                { label: 'Invoiced', color: CHART.violet, shape: 'line' },
                { label: 'Paid', color: CHART.cyan, shape: 'line' },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {/* Attention */}
      <Card className="mt-5">
        <CardHeader
          title="Needs attention today"
          subtitle="Overdue steps, returned submissions, missing evidence and stale workbooks."
          action={attention.length > 0 ? <Pill tone="danger">{attention.length} items</Pill> : null}
        />
        <CardBody className="pt-4">
          <AttentionTable items={attention.slice(0, 12)} />
          {attention.length > 12 ? (
            <p className="mt-3 text-[12.5px] text-ink-muted">
              Showing the 12 most pressing of {attention.length}. Open a project to see the rest.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* Projects */}
      <Card className="mt-5">
        <CardHeader
          title="Projects"
          subtitle="Click a row to open the project workspace."
          action={<Button icon={Plus} onClick={() => navigate('/projects/new')}>New project</Button>}
        />
        <CardBody className="pt-4">
          <ProjectsTable metrics={m.perProject} onOpen={(id) => navigate(`/projects/${id}`)} />
        </CardBody>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function AttentionTable({ items }: { items: AttentionItem[] }) {
  const navigate = useNavigate();

  const columns: Array<Column<AttentionItem>> = [
    {
      key: 'what', header: 'What', mobile: 'title',
      cell: (r) => (
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium text-indigo">{r.what}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">{r.detail}</p>
        </div>
      ),
    },
    {
      key: 'kind', header: 'Issue', mobile: 'meta', width: '190px',
      cell: (r) => <Pill tone={r.tone} size="sm">{r.kind}</Pill>,
    },
    {
      key: 'project', header: 'Project', mobile: 'field', width: '240px',
      cell: (r) => <span className="text-[13px] text-ink-muted">{r.projectName}</span>,
      sortValue: (r) => r.projectName,
    },
  ];

  return (
    <DataTable
      caption="Items needing attention across the portfolio"
      columns={columns}
      rows={items}
      rowKey={(r) => r.id}
      onRowClick={(r) => navigate(r.href)}
      dense
      empty={
        <EmptyState
          title="Nothing needs attention"
          body="No overdue steps, no returned submissions, no missing evidence and every workbook is current. This is what the system is for."
        />
      }
    />
  );
}

function ProjectsTable({ metrics, onOpen }: { metrics: ProjectMetrics[]; onOpen: (id: string) => void }) {
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
    {
      key: 'health', header: 'Health', mobile: 'meta', width: '150px', sortValue: (m) => m.health,
      cell: (m) => <HealthPill health={m.health} size="sm" />,
    },
    {
      key: 'pm', header: 'Project manager', mobile: 'field', width: '160px',
      cell: (m) => <ProjectManagerName id={m.project.projectManagerId} />,
    },
    {
      key: 'phase', header: 'Phase reached', mobile: 'field', width: '175px', sortValue: (m) => m.phaseReached,
      cell: (m) => <span className="text-[13px]">{m.phaseReached}</span>,
    },
    {
      key: 'progress', header: '% complete', mobile: 'field', width: '150px', sortValue: (m) => m.delivery.completedPct,
      cell: (m) => (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold tabular-nums text-indigo">{m.delivery.completedPct}%</span>
            <span className="text-[11.5px] tabular-nums text-ink-faint">{m.delivery.completed}/{m.delivery.total}</span>
          </div>
          <ProgressBar value={m.delivery.completedPct} className="mt-1.5" height="h-1.5" label={`${m.project.name}: ${m.delivery.completedPct}% of steps complete`} />
        </div>
      ),
    },
    {
      key: 'value', header: 'Contract value', mobile: 'field', align: 'right', width: '140px', sortValue: (m) => m.money.contractValue,
      cell: (m) => <span className="text-[13px] font-semibold tabular-nums">{formatZAR(m.money.contractValue, { decimals: false })}</span>,
    },
    {
      key: 'invoiced', header: 'Invoiced', mobile: 'field', align: 'right', width: '140px', sortValue: (m) => m.money.invoiced,
      cell: (m) => (
        <div className="text-right">
          <span className="text-[13px] tabular-nums">{formatZAR(m.money.invoiced, { decimals: false })}</span>
          <span className="mt-0.5 block text-[11.5px] tabular-nums text-ink-faint">{m.money.invoicedPct}%</span>
        </div>
      ),
    },
    {
      key: 'next', header: 'Next submission due', mobile: 'field', width: '210px',
      cell: (m) => m.nextSubmissionDue ? (
        <div className="min-w-0">
          <p className="truncate text-[13px]">{m.nextSubmissionDue.label}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">{formatDate(m.nextSubmissionDue.date)}</p>
        </div>
      ) : <span className="text-[13px] text-ink-faint">—</span>,
    },
  ];

  return (
    <DataTable
      caption="All projects with health, progress and money"
      columns={columns}
      rows={metrics}
      rowKey={(m) => m.project.id}
      onRowClick={(m) => onOpen(m.project.id)}
      empty={
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          body="Create the first project and its delivery plan and submissions register are seeded from the standard template — 55 steps and 22 register entries, ready to work with."
          action={<Link to="/projects/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-indigo shadow-card transition-colors hover:bg-canvas"><Plus className="h-4 w-4" strokeWidth={2} aria-hidden />New project</Link>}
        />
      }
    />
  );
}

function ProjectManagerName({ id }: { id: string }) {
  const { state } = useApp();
  const person = state.people.find((p) => p.id === id);
  return <span className="text-[13px]">{person?.name ?? '—'}</span>;
}

/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <>
      <div className="mb-5">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatTileSkeleton key={i} />)}
      </div>
      <Card className="mt-5 p-5">
        <Skeleton className="h-4 w-20" />
        <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-5 w-24" />
            </div>
          ))}
        </div>
      </Card>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-5 h-[200px] w-full rounded-xl" />
          </Card>
        ))}
      </div>
    </>
  );
}
