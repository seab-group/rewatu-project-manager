import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, Receipt } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, Card, CardBody, CardHeader, cx, EmptyState, Pill, ProgressBar, Skeleton } from '@/components/ui/primitives';
import { Metric, StatTile } from '@/components/ui/StatTile';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { CashLine, ChartLegend } from '@/components/charts/Charts';
import { CHART } from '@/components/charts/theme';
import { cashPosition, monthlyReportsOutstanding, portfolioMetrics } from '@/lib/derive';
import { formatZAR } from '@/lib/money';
import { formatDate, formatMonthKey } from '@/lib/dates';
import { downloadWorkbook } from '@/lib/export';
import { useInitialLoad } from '@/lib/useLoading';
import type { Invoice } from '@/types';

export default function Reports() {
  const { state, toast } = useApp();
  const loading = useInitialLoad();

  const m = useMemo(() => portfolioMetrics(state), [state]);
  const outstanding = useMemo(() => monthlyReportsOutstanding(state), [state]);
  const cash = useMemo(() => cashPosition(state.invoices, 18), [state.invoices]);
  const invoices = useMemo(
    () => [...state.invoices].sort((a, b) => b.date.localeCompare(a.date)),
    [state.invoices],
  );

  if (loading) {
    return (
      <>
        <div className="mb-5"><Skeleton className="h-7 w-36" /></div>
        <div className="grid gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-8 w-20" /></Card>
          ))}
        </div>
      </>
    );
  }

  const projectName = (id: string) => state.projects.find((p) => p.id === id)?.name ?? '—';

  const exportAll = async () => {
    const result = await downloadWorkbook([
      {
        name: 'Portfolio position',
        headers: ['Project', 'Client', 'Health', 'Phase reached', 'Steps complete', 'Steps total', '% complete',
          'Contract value', 'Invoiced', 'Paid', 'Outstanding', 'Still to invoice', 'Overdue steps', 'Blocked steps'],
        widths: [38, 34, 16, 24, 14, 12, 11, 15, 15, 15, 14, 15, 13, 13],
        rows: m.perProject.map((p) => [
          p.project.name, p.project.client, p.health, p.phaseReached,
          p.delivery.completed, p.delivery.total, p.delivery.completedPct,
          p.money.contractValue, p.money.invoiced, p.money.paid, p.money.outstanding, p.money.stillToInvoice,
          p.delivery.overdue, p.delivery.blocked,
        ]),
      },
      {
        name: 'Invoices',
        headers: ['Project', 'Invoice', 'Date', 'Period covered', 'Linked phase', 'Amount', 'Progress report', 'Status', 'Date paid'],
        widths: [34, 16, 13, 28, 24, 14, 15, 20, 13],
        rows: invoices.map((i) => [
          projectName(i.projectId), i.number, formatDate(i.date), i.periodCovered, i.linkedPhase,
          i.amount, i.progressReportAttached ? 'Attached' : 'Missing', i.status, i.datePaid ? formatDate(i.datePaid) : '',
        ]),
      },
      {
        name: 'Monthly reports',
        headers: ['Project', 'Month', 'Lodged', 'Lodged on', 'Invoice', 'Notes'],
        widths: [34, 14, 10, 14, 16, 30],
        rows: state.monthlyReports.map((r) => [
          projectName(r.projectId), formatMonthKey(r.month), r.lodged ? 'Yes' : 'No',
          r.lodgedOn ? formatDate(r.lodgedOn) : '',
          state.invoices.find((i) => i.id === r.invoiceId)?.number ?? '', r.notes,
        ]),
      },
    ], 'rewatu-portfolio-report');
    toast(result.ok
      ? { tone: 'success', title: 'Report exported', body: 'Three sheets: portfolio position, invoices and monthly reports.' }
      : { tone: 'danger', title: 'Report not saved', body: result.reason });
  };

  const invoiceColumns: Array<Column<Invoice>> = [
    {
      key: 'number', header: 'Invoice', mobile: 'title', sortValue: (i) => i.number,
      cell: (i) => (
        <div className="min-w-0">
          <p className="font-semibold tabular-nums text-indigo">{i.number}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">{projectName(i.projectId)}</p>
        </div>
      ),
    },
    { key: 'date', header: 'Date', mobile: 'field', width: '120px', sortValue: (i) => i.date, cell: (i) => <span className="whitespace-nowrap text-[13px] tabular-nums">{formatDate(i.date)}</span> },
    { key: 'period', header: 'Period covered', mobile: 'field', width: '210px', cell: (i) => <span className="text-[13px]">{i.periodCovered || '—'}</span> },
    { key: 'amount', header: 'Amount', mobile: 'meta', align: 'right', width: '140px', sortValue: (i) => i.amount, cell: (i) => <span className="text-[13px] font-semibold tabular-nums">{formatZAR(i.amount)}</span> },
    {
      key: 'report', header: 'Progress report', mobile: 'field', width: '150px',
      cell: (i) => (i.progressReportAttached || state.documents.some((d) => d.invoiceId === i.id))
        ? <Pill tone="success" size="sm" icon={CheckCircle2}>Attached</Pill>
        : <Pill tone="danger" size="sm" icon={AlertTriangle}>Missing</Pill>,
    },
    {
      key: 'status', header: 'Status', mobile: 'meta', width: '160px', sortValue: (i) => i.status,
      cell: (i) => (
        <Pill size="sm" tone={i.status === 'Paid' ? 'success' : i.status === 'Queried' ? 'danger' : i.status === 'Approved for payment' ? 'warning' : 'neutral'}>
          {i.status}
        </Pill>
      ),
    },
    { key: 'paid', header: 'Date paid', mobile: 'field', width: '120px', cell: (i) => <span className="whitespace-nowrap text-[13px] tabular-nums">{formatDate(i.datePaid)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="The monthly reporting position across the portfolio, and every invoice raised."
        action={<Button variant="primary" icon={Download} onClick={exportAll}>Export to Excel</Button>}
      />

      <section aria-label="Reporting summary" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Monthly reports outstanding"
          value={outstanding.length}
          icon={AlertTriangle}
          tone={outstanding.length ? 'danger' : 'success'}
          sub={outstanding.length ? 'Months that have passed with no report lodged' : 'Every month due has a report lodged'}
        />
        <StatTile label="Invoiced to date" value={formatZAR(m.invoiced, { decimals: false })} icon={Receipt} sub="Across active projects, VAT inclusive" />
        <StatTile label="Paid to date" value={formatZAR(m.paid, { decimals: false })} tone="success" icon={CheckCircle2} sub={`${Math.round((m.paid / (m.invoiced || 1)) * 100)}% of what has been invoiced`} />
        <StatTile
          label="Invoices missing a report"
          value={state.invoices.filter((i) => !i.progressReportAttached && !state.documents.some((d) => d.invoiceId === i.id)).length}
          icon={AlertTriangle}
          tone="warning"
          sub="These will be returned unpaid"
        />
      </section>

      {outstanding.length > 0 ? (
        <Card className="mt-5">
          <CardHeader title="Monthly reports outstanding" subtitle="Every month that has passed without a report lodged." />
          <CardBody className="pt-4">
            <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {outstanding.map((r) => (
                <li key={r.id} className="min-w-0">
                  <Link
                    to={`/projects/${r.projectId}/reports`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-bg/40 p-3.5 transition-colors hover:bg-danger-bg/70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-indigo">{projectName(r.projectId)}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">{formatMonthKey(r.month)}</p>
                    </div>
                    <Pill tone="danger" size="sm" icon={AlertTriangle}>Outstanding</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-5">
        <CardHeader title="Position by project" subtitle="Delivery and money side by side." />
        <CardBody className="pt-4">
          <ul className="space-y-5">
            {m.perProject.map((p) => (
              <li key={p.project.id} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link to={`/projects/${p.project.id}`} className="rounded text-[14px] font-semibold text-indigo hover:underline">
                    {p.project.name}
                  </Link>
                  <Pill tone={p.health === 'At risk' ? 'danger' : p.health === 'Behind schedule' ? 'warning' : 'success'} size="sm">
                    {p.health}
                  </Pill>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric label="Complete" value={`${p.delivery.completedPct}%`} />
                  <Metric label="Contract" value={formatZAR(p.money.contractValue, { decimals: false })} />
                  <Metric label="Invoiced" value={formatZAR(p.money.invoiced, { decimals: false })} />
                  <Metric label="Paid" value={formatZAR(p.money.paid, { decimals: false })} tone="success" />
                  <Metric label="Outstanding" value={formatZAR(p.money.outstanding, { decimals: false })} tone={p.money.outstanding ? 'warning' : undefined} />
                  <Metric label="Acknowledged" value={`${p.submissions.acknowledgedPct}%`} />
                </dl>
                <ProgressBar value={p.delivery.completedPct} className="mt-3" height="h-1.5" label={`${p.project.name}: ${p.delivery.completedPct}% complete`} />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Cash position" subtitle="Invoiced and paid, accumulated by month, across the whole portfolio." />
        <CardBody className="pt-4">
          <CashLine data={cash} height={280} />
          <ChartLegend
            className="mt-3 justify-center"
            items={[{ label: 'Invoiced', color: CHART.violet, shape: 'line' }, { label: 'Paid', color: CHART.cyan, shape: 'line' }]}
          />
        </CardBody>
      </Card>

      <Card className={cx('mt-5')}>
        <CardHeader title="All invoices" subtitle="Every invoice raised across the portfolio." />
        <CardBody className="pt-4">
          <DataTable
            caption="All invoices across the portfolio"
            columns={invoiceColumns}
            rows={invoices}
            rowKey={(i) => i.id}
            empty={<EmptyState icon={Receipt} title="No invoices yet" body="Invoices are recorded on a project's Reports tab. Once they are, they roll up here." />}
          />
        </CardBody>
      </Card>
    </>
  );
}
