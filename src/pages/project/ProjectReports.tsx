import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileUp, Plus, Receipt, Trash2 } from 'lucide-react';
import { useApp, useProject } from '@/store/AppStore';
import {
  Button, Card, CardBody, CardHeader, cx, EmptyState, IconButton, InlineMessage, Pill, ProgressBar,
} from '@/components/ui/primitives';
import { ConfirmDialog, DeleteDialog, Modal } from '@/components/ui/Modal';
import { DateInput, Field, MoneyInput, Select, TextInput, Toggle } from '@/components/ui/form';
import { Metric } from '@/components/ui/StatTile';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { UploadDialog, type UploadTarget } from '@/components/documents/Upload';
import { INVOICE_STATUS, PHASES } from '@/data/reference';
import type { Invoice, InvoiceStatus, MonthlyReport } from '@/types';
import { canSubmitInvoice, moneyMetrics } from '@/lib/derive';
import { formatZAR, parseAmount } from '@/lib/money';
import { addMonths, formatDate, formatMonthKey, monthKey, monthRange, today } from '@/lib/dates';
import { uid } from '@/data/factory';

const INVOICE_TONE: Record<InvoiceStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Paid: 'success', 'Approved for payment': 'warning', Submitted: 'neutral', Queried: 'danger',
};

export default function ProjectReports() {
  const { projectId } = useParams();
  const { state, dispatch, toast } = useApp();
  const data = useProject(projectId);

  const [adding, setAdding] = useState(false);
  const [upload, setUpload] = useState<UploadTarget | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [statusChange, setStatusChange] = useState<{ invoice: Invoice; value: InvoiceStatus; blocked?: string } | null>(null);

  /** The support period's months, whether or not a report record exists yet. */
  const months = useMemo(() => {
    if (!data) return [];
    const p = data.project;
    const start = p.contractedCompletion && p.supportPeriodMonths
      ? addMonths(p.contractedCompletion, -p.supportPeriodMonths)
      : p.startDate;
    const end = p.contractedCompletion || today();
    return monthRange(start, end).map((month) => {
      const record = data.reports.find((r) => r.month === month);
      const invoice = record?.invoiceId ? data.invoices.find((i) => i.id === record.invoiceId) : undefined;
      const isPast = month < monthKey(today());
      return { month, record, invoice, isPast };
    });
  }, [data]);

  if (!data) return null;

  const money = moneyMetrics(data.project, state.invoices);
  const outstanding = months.filter((m) => m.isPast && !m.record?.lodged);
  const lodged = months.filter((m) => m.record?.lodged);

  const toggleLodged = (month: string, record: MonthlyReport | undefined, value: boolean) => {
    if (record) {
      dispatch({ type: 'report/update', id: record.id, patch: { lodged: value, lodgedOn: value ? today() : '' } });
    } else {
      dispatch({
        type: 'report/add',
        report: {
          id: uid('mr'), projectId: data.project.id, month,
          lodged: value, lodgedOn: value ? today() : '', invoiceId: null, notes: '',
        },
      });
    }
    toast({ tone: 'success', title: value ? `${formatMonthKey(month)} report lodged` : `${formatMonthKey(month)} report reopened` });
  };

  const requestStatus = (invoice: Invoice, value: InvoiceStatus) => {
    if (value === 'Submitted') {
      const gate = canSubmitInvoice(invoice, data.documents);
      if (!gate.allowed) { setStatusChange({ invoice, value, blocked: gate.reason }); return; }
    }
    setStatusChange({ invoice, value });
  };

  const applyStatus = () => {
    if (!statusChange || statusChange.blocked) return;
    const patch: Partial<Invoice> = { status: statusChange.value };
    if (statusChange.value === 'Paid' && !statusChange.invoice.datePaid) patch.datePaid = today();
    if (statusChange.value !== 'Paid') patch.datePaid = '';
    dispatch({ type: 'invoice/update', id: statusChange.invoice.id, patch });
    toast({ tone: 'success', title: `${statusChange.invoice.number} is now ${statusChange.value}` });
    setStatusChange(null);
  };

  const invoiceColumns: Array<Column<Invoice>> = [
    {
      key: 'number', header: 'Invoice', mobile: 'title', sortValue: (i) => i.number,
      cell: (i) => (
        <div className="min-w-0">
          <p className="font-semibold tabular-nums text-indigo">{i.number}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">{i.periodCovered}</p>
        </div>
      ),
    },
    { key: 'date', header: 'Date', mobile: 'field', width: '120px', sortValue: (i) => i.date, cell: (i) => <span className="whitespace-nowrap text-[13px] tabular-nums">{formatDate(i.date)}</span> },
    { key: 'phase', header: 'Linked phase', mobile: 'field', width: '175px', cell: (i) => <span className="text-[13px]">{i.linkedPhase || '—'}</span> },
    {
      key: 'amount', header: 'Amount', mobile: 'meta', align: 'right', width: '135px', sortValue: (i) => i.amount,
      cell: (i) => <span className="text-[13px] font-semibold tabular-nums">{formatZAR(i.amount)}</span>,
    },
    {
      key: 'report', header: 'Progress report', mobile: 'field', width: '150px',
      cell: (i) => {
        const has = i.progressReportAttached || data.documents.some((d) => d.invoiceId === i.id);
        return has
          ? <Pill tone="success" size="sm" icon={CheckCircle2}>Attached</Pill>
          : (
            <button type="button" onClick={() => setUpload({ projectId: data.project.id, invoiceId: i.id, defaultName: `Progress report for ${i.number}`, defaultType: 'Report' })}
              className="inline-flex items-center gap-1 rounded text-[12.5px] font-semibold text-danger hover:underline">
              <FileUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> Missing — attach
            </button>
          );
      },
    },
    {
      key: 'status', header: 'Status', mobile: 'meta', width: '190px', sortValue: (i) => i.status,
      cell: (i) => (
        <div onClick={(e) => e.stopPropagation()}>
          <label className="sr-only" htmlFor={`inv-${i.id}`}>Status of {i.number}</label>
          <select
            id={`inv-${i.id}`}
            value={i.status}
            onChange={(e) => requestStatus(i, e.target.value as InvoiceStatus)}
            className={cx('h-8 w-full cursor-pointer rounded-lg border bg-surface px-2 text-[12.5px] font-semibold',
              INVOICE_TONE[i.status] === 'success' ? 'border-success/30 text-success'
                : INVOICE_TONE[i.status] === 'danger' ? 'border-danger/30 text-danger'
                : INVOICE_TONE[i.status] === 'warning' ? 'border-warning/30 text-warning'
                : 'border-line text-ink')}
          >
            {INVOICE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ),
    },
    { key: 'paid', header: 'Date paid', mobile: 'field', width: '120px', cell: (i) => <span className="whitespace-nowrap text-[13px] tabular-nums">{formatDate(i.datePaid)}</span> },
    {
      key: 'actions', header: '', mobile: 'hidden', width: '48px',
      cell: (i) => (
        <div onClick={(e) => e.stopPropagation()}>
          <IconButton label={`Delete invoice ${i.number}`} icon={Trash2} size="sm" onClick={() => setDeleting(i)} className="hover:bg-danger-bg hover:text-danger" />
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Monthly reporting position */}
      <Card className="mb-5">
        <CardHeader
          title="Monthly reporting position"
          subtitle="Which months have a report lodged, which invoice each accompanied, and what is outstanding."
          action={outstanding.length > 0
            ? <Pill tone="danger">{outstanding.length} outstanding</Pill>
            : <Pill tone="success" icon={CheckCircle2}>Up to date</Pill>}
        />
        <CardBody className="pt-4">
          {months.length === 0 ? (
            <EmptyState
              title="No support period captured"
              body="Set a contracted completion date and a support period on the Setup tab, and the months that need a report will be listed here."
            />
          ) : (
            <>
              <dl className="mb-5 grid grid-cols-2 gap-4 border-b border-line pb-5 sm:grid-cols-4">
                <Metric label="Months in period" value={months.length} />
                <Metric label="Reports lodged" value={lodged.length} tone="success" />
                <Metric label="Outstanding" value={outstanding.length} tone={outstanding.length ? 'danger' : undefined} />
                <Metric label="Not yet due" value={months.filter((m) => !m.isPast).length} />
              </dl>
              <ProgressBar
                value={months.filter((m) => m.isPast).length ? (lodged.length / months.filter((m) => m.isPast).length) * 100 : 100}
                tone="success"
                className="mb-5"
                label="Share of due months with a report lodged"
              />
              <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {months.map(({ month, record, invoice, isPast }) => {
                  const state_ = record?.lodged ? 'lodged' : isPast ? 'outstanding' : 'future';
                  return (
                    <li
                      key={month}
                      className={cx('rounded-xl border p-3.5',
                        state_ === 'lodged' ? 'border-success/25 bg-success-bg/40'
                          : state_ === 'outstanding' ? 'border-danger/25 bg-danger-bg/40'
                          : 'border-line bg-surface')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-indigo">{formatMonthKey(month)}</p>
                          <p className="mt-0.5 text-[12px] text-ink-muted">
                            {record?.lodged ? `Lodged ${formatDate(record.lodgedOn)}` : isPast ? 'Not lodged' : 'Not yet due'}
                          </p>
                        </div>
                        {state_ === 'lodged'
                          ? <Pill tone="success" size="sm" icon={CheckCircle2}>Lodged</Pill>
                          : state_ === 'outstanding'
                            ? <Pill tone="danger" size="sm" icon={AlertTriangle}>Outstanding</Pill>
                            : <Pill tone="neutral" size="sm">Not yet due</Pill>}
                      </div>
                      <p className="mt-2 text-[12px] text-ink-muted">
                        {invoice
                          ? <>Accompanied <span className="font-semibold tabular-nums text-indigo">{invoice.number}</span></>
                          : 'No invoice linked'}
                      </p>
                      {isPast ? (
                        <div className="mt-2.5">
                          <Toggle
                            checked={!!record?.lodged}
                            onChange={(v) => toggleLodged(month, record, v)}
                            label={record?.lodged ? 'Lodged' : 'Mark as lodged'}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      {/* Invoice register */}
      <Card>
        <CardHeader
          title="Invoice register"
          subtitle="An invoice cannot be marked Submitted without a progress report attached. This mirrors the client's own rule."
          action={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add invoice</Button>}
        />
        <CardBody className="pt-4">
          <dl className="mb-5 grid grid-cols-2 gap-4 border-b border-line pb-5 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Contract value" value={formatZAR(money.contractValue, { decimals: false })} />
            <Metric label="Invoiced" value={formatZAR(money.invoiced, { decimals: false })} />
            <Metric label="Paid" value={formatZAR(money.paid, { decimals: false })} tone="success" />
            <Metric label="Outstanding" value={formatZAR(money.outstanding, { decimals: false })} tone={money.outstanding ? 'warning' : undefined} />
            <Metric label="Still to invoice" value={formatZAR(money.stillToInvoice, { decimals: false })} />
            <Metric label="Invoiced %" value={`${money.invoicedPct}%`} />
          </dl>
          <DataTable
            caption="Invoices for this project"
            columns={invoiceColumns}
            rows={data.invoices}
            rowKey={(i) => i.id}
            initialSort={{ key: 'date', dir: 'desc' }}
            empty={
              <EmptyState
                icon={Receipt}
                title="No invoices yet"
                body="Record each invoice as it is raised, with the progress report that goes with it. Invoiced, paid and outstanding on both dashboards come from this register."
                action={<Button icon={Plus} onClick={() => setAdding(true)}>Add the first invoice</Button>}
              />
            }
          />
        </CardBody>
      </Card>

      <AddInvoiceDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(inv) => {
          dispatch({ type: 'invoice/add', invoice: inv });
          toast({ tone: 'success', title: `${inv.number} added` });
          setAdding(false);
        }}
        projectId={data.project.id}
        existing={data.invoices.map((i) => i.number)}
      />

      <ConfirmDialog
        open={!!statusChange}
        onClose={() => setStatusChange(null)}
        onConfirm={applyStatus}
        title={statusChange?.blocked
          ? 'This invoice cannot be marked Submitted'
          : `Set ${statusChange?.invoice.number} to ${statusChange?.value}?`}
        description={statusChange ? `${formatZAR(statusChange.invoice.amount)} · ${statusChange.invoice.periodCovered}` : undefined}
        confirmLabel={statusChange?.blocked ? 'Close' : 'Apply the change'}
        disabled={!!statusChange?.blocked}
      >
        {statusChange?.blocked ? (
          <>
            <InlineMessage tone="danger" icon={AlertTriangle} title="This is not allowed yet">{statusChange.blocked}</InlineMessage>
            <div className="mt-3">
              <Button
                icon={FileUp}
                onClick={() => {
                  const i = statusChange.invoice;
                  setStatusChange(null);
                  setUpload({ projectId: data.project.id, invoiceId: i.id, defaultName: `Progress report for ${i.number}`, defaultType: 'Report' });
                }}
              >
                Attach the progress report now
              </Button>
            </div>
          </>
        ) : statusChange?.value === 'Paid' ? (
          <InlineMessage tone="success" title="What this means">
            Today's date will be recorded as the date paid, and this amount moves from outstanding to paid on both dashboards.
          </InlineMessage>
        ) : null}
      </ConfirmDialog>

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          dispatch({ type: 'invoice/delete', id: deleting.id });
          toast({ tone: 'success', title: `${deleting.number} deleted` });
          setDeleting(null);
        }}
        title={`Delete invoice ${deleting?.number ?? ''}?`}
        confirmLabel="Delete invoice"
        whatIsLost={
          <ul className="list-inside list-disc space-y-1">
            <li>{deleting ? formatZAR(deleting.amount) : ''} from the invoiced and paid figures on both dashboards</li>
            <li>The progress report filed against it</li>
          </ul>
        }
      />

      <UploadDialog open={!!upload} onClose={() => setUpload(null)} target={upload} />
    </>
  );
}

function AddInvoiceDialog({
  open, onClose, onSave, projectId, existing,
}: {
  open: boolean; onClose: () => void; onSave: (i: Invoice) => void;
  projectId: string; existing: string[];
}) {
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(today());
  const [period, setPeriod] = useState('');
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState('');
  const [report, setReport] = useState(false);

  const errors: Record<string, string> = {};
  if (!number.trim()) errors.number = 'Give the invoice its number.';
  else if (existing.includes(number.trim())) errors.number = 'That invoice number is already on this project.';
  if (!date) errors.date = 'Enter the invoice date.';
  const amt = parseAmount(amount);
  if (amt === null || amt <= 0) errors.amount = 'Enter the amount, VAT inclusive.';
  const valid = Object.keys(errors).length === 0;

  const save = () => {
    if (!valid) return;
    onSave({
      id: uid('inv'), projectId,
      number: number.trim(), date, periodCovered: period.trim(),
      amount: amt!, linkedPhase: phase, progressReportAttached: report,
      // A new invoice starts Submitted only where its progress report is
      // already attached; otherwise the client's rule would be broken on entry.
      status: report ? 'Submitted' : 'Queried',
      datePaid: '',
    });
    setNumber(''); setDate(today()); setPeriod(''); setAmount(''); setPhase(''); setReport(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an invoice"
      description="All amounts VAT inclusive."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>Add invoice</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice number" required error={errors.number} htmlFor="i-num">
          <TextInput id="i-num" value={number} invalid={!!errors.number} onChange={(e) => setNumber(e.target.value)} placeholder="INV-2026-071" />
        </Field>
        <Field label="Invoice date" required error={errors.date} htmlFor="i-date">
          <DateInput id="i-date" value={date} invalid={!!errors.date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Period covered" htmlFor="i-period" className="sm:col-span-2">
          <TextInput id="i-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="September 2026" />
        </Field>
        <Field label="Amount" required error={errors.amount} htmlFor="i-amt">
          <MoneyInput id="i-amt" value={amount} invalid={!!errors.amount} onChange={setAmount} placeholder="99 746.54" />
        </Field>
        <Field label="Linked phase or milestone" htmlFor="i-phase">
          <Select id="i-phase" options={PHASES} placeholder="Not linked" value={phase} onChange={(e) => setPhase(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Toggle
            checked={report}
            onChange={setReport}
            label="Progress report attached"
            description="Without it, this invoice cannot be marked Submitted — the department returns invoices that arrive without one."
          />
        </div>
      </div>
    </Modal>
  );
}
