import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useApp, useProject } from '@/store/AppStore';
import { ProjectManagerReminder } from '@/pages/project/ProjectWorkspace';
import { Button, Card, CardBody, CardHeader, cx, InlineMessage, Pill } from '@/components/ui/primitives';
import { ConfirmDialog, DeleteDialog } from '@/components/ui/Modal';
import { DateInput, Field, FieldGroup, MoneyInput, Select, TextInput } from '@/components/ui/form';
import { formatZAR, parseAmount } from '@/lib/money';
import { daysBetween, formatDate, isValidISO, today } from '@/lib/dates';
import type { Project } from '@/types';

type Draft = Record<string, string>;

function toDraft(p: Project): Draft {
  return {
    name: p.name, client: p.client, contractRef: p.contractRef, serviceScheduleRef: p.serviceScheduleRef,
    deliveryTier: p.deliveryTier,
    projectManagerId: p.projectManagerId, projectLeadId: p.projectLeadId, projectEmail: p.projectEmail,
    clientProjectManager: p.clientProjectManager, clientBusinessOwner: p.clientBusinessOwner,
    startDate: p.startDate, contractedCompletion: p.contractedCompletion,
    contractValue: String(p.contractValue), currency: p.currency,
    supportPeriodMonths: String(p.supportPeriodMonths),
    costBudget: p.costBudget == null ? '' : String(p.costBudget),
    costToDate: p.costToDate == null ? '' : String(p.costToDate),
    systemRepositoryLocation: p.systemRepositoryLocation,
    workingDocumentLocation: p.workingDocumentLocation,
    approvedDocumentLocation: p.approvedDocumentLocation,
    departmentalWorkbookUpdated: p.departmentalWorkbookUpdated,
    thisWorkbookUpdated: p.thisWorkbookUpdated,
  };
}

/** How stale is the client's workbook? Amber past 7 days, red past 14. */
export function workbookAge(dateStr: string): { days: number | null; tone: 'success' | 'warning' | 'danger' | 'neutral'; message: string } {
  if (!dateStr) {
    return { days: null, tone: 'danger', message: 'Never recorded. The client\'s workbook must be updated whenever this plan changes.' };
  }
  const days = daysBetween(dateStr, today());
  if (days === null) return { days: null, tone: 'neutral', message: 'Not a valid date.' };
  if (days > 14) return { days, tone: 'danger', message: `${days} days old. This is well past the point where the two plans have diverged.` };
  if (days > 7) return { days, tone: 'warning', message: `${days} days old. Update the client's workbook to match this plan.` };
  return { days, tone: 'success', message: days <= 0 ? 'Updated today.' : `${days} day${days === 1 ? '' : 's'} old. Current.` };
}

export default function ProjectSetup() {
  const { projectId } = useParams();
  const { state, dispatch, toast } = useApp();
  const navigate = useNavigate();
  const data = useProject(projectId);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const original = useMemo(() => (data ? toDraft(data.project) : null), [data]);
  const current = draft ?? original;

  if (!data || !current || !original) return null;

  const set = (k: string, v: string) => setDraft({ ...current, [k]: v });
  const dirty = JSON.stringify(current) !== JSON.stringify(original);

  const errors: Record<string, string> = {};
  if (!current.name.trim()) errors.name = 'The project needs a name.';
  if (!current.client.trim()) errors.client = 'Name the client or department.';
  if (!isValidISO(current.startDate)) errors.startDate = 'Enter a valid start date.';
  if (!isValidISO(current.contractedCompletion)) errors.contractedCompletion = 'Enter a valid completion date.';
  else if (isValidISO(current.startDate) && current.contractedCompletion < current.startDate) {
    errors.contractedCompletion = 'Contracted completion cannot be before the project start.';
  }
  if (parseAmount(current.contractValue) === null) errors.contractValue = 'Enter the contract value.';
  if (current.costBudget.trim() && parseAmount(current.costBudget) === null) errors.costBudget = 'Enter a number, or leave it blank.';
  if (current.costToDate.trim() && parseAmount(current.costToDate) === null) errors.costToDate = 'Enter a number, or leave it blank.';
  if (current.departmentalWorkbookUpdated && current.departmentalWorkbookUpdated > today()) {
    errors.departmentalWorkbookUpdated = 'This cannot be a date in the future.';
  }
  if (current.thisWorkbookUpdated && current.thisWorkbookUpdated > today()) {
    errors.thisWorkbookUpdated = 'This cannot be a date in the future.';
  }
  const valid = Object.keys(errors).length === 0;

  const save = () => {
    dispatch({
      type: 'project/update',
      id: data.project.id,
      patch: {
        name: current.name.trim(), client: current.client.trim(),
        contractRef: current.contractRef.trim(), serviceScheduleRef: current.serviceScheduleRef.trim(),
        deliveryTier: current.deliveryTier as '1' | '2',
        projectManagerId: current.projectManagerId, projectLeadId: current.projectLeadId,
        projectEmail: current.projectEmail.trim(),
        clientProjectManager: current.clientProjectManager.trim(),
        clientBusinessOwner: current.clientBusinessOwner.trim(),
        startDate: current.startDate, contractedCompletion: current.contractedCompletion,
        contractValue: parseAmount(current.contractValue) ?? 0,
        currency: current.currency,
        supportPeriodMonths: Number(current.supportPeriodMonths) || 0,
        costBudget: current.costBudget.trim() ? parseAmount(current.costBudget) : null,
        costToDate: current.costToDate.trim() ? parseAmount(current.costToDate) : null,
        systemRepositoryLocation: current.systemRepositoryLocation.trim(),
        workingDocumentLocation: current.workingDocumentLocation.trim(),
        approvedDocumentLocation: current.approvedDocumentLocation.trim(),
        departmentalWorkbookUpdated: current.departmentalWorkbookUpdated,
        thisWorkbookUpdated: current.thisWorkbookUpdated,
      },
    });
    setDraft(null);
    setConfirming(false);
    toast({ tone: 'success', title: 'Project details saved' });
  };

  const people = state.people.filter((p) => p.active);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '';
  const deptAge = workbookAge(current.departmentalWorkbookUpdated);
  const oursAge = workbookAge(current.thisWorkbookUpdated);

  return (
    <>
      <ProjectManagerReminder />

      {/* The two workbook dates, given the prominence they need. */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <WorkbookCard
          title="Departmental workbook last updated on"
          description="The client's own project plan workbook. This system does not replace it."
          value={current.departmentalWorkbookUpdated}
          error={errors.departmentalWorkbookUpdated}
          age={deptAge}
          onChange={(v) => set('departmentalWorkbookUpdated', v)}
          onToday={() => set('departmentalWorkbookUpdated', today())}
          id="wb-dept"
        />
        <WorkbookCard
          title="This workbook last updated on"
          description="When the delivery plan and register here were last brought up to date."
          value={current.thisWorkbookUpdated}
          error={errors.thisWorkbookUpdated}
          age={oursAge}
          onChange={(v) => set('thisWorkbookUpdated', v)}
          onToday={() => set('thisWorkbookUpdated', today())}
          id="wb-ours"
        />
      </div>

      <Card>
        <CardHeader
          title="Project details"
          subtitle="Captured when the project was created. Change what needs changing, then save."
          action={dirty ? <Pill tone="warning">Unsaved changes</Pill> : null}
        />
        <CardBody className="space-y-6 pt-4">
          <FieldGroup title="Project">
            <Field label="Project name" required error={errors.name} htmlFor="s-name" className="sm:col-span-2">
              <TextInput id="s-name" value={current.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Client or department" required error={errors.client} htmlFor="s-client" className="sm:col-span-2">
              <TextInput id="s-client" value={current.client} invalid={!!errors.client} onChange={(e) => set('client', e.target.value)} />
            </Field>
            <Field label="Contract or TOR reference" htmlFor="s-ref">
              <TextInput id="s-ref" value={current.contractRef} onChange={(e) => set('contractRef', e.target.value)} />
            </Field>
            <Field label="Service schedule reference" htmlFor="s-sched">
              <TextInput id="s-sched" value={current.serviceScheduleRef} onChange={(e) => set('serviceScheduleRef', e.target.value)} />
            </Field>
            <Field label="Delivery tier" htmlFor="s-tier">
              <Select id="s-tier" options={['1', '2']} value={current.deliveryTier} onChange={(e) => set('deliveryTier', e.target.value)} />
            </Field>
          </FieldGroup>

          <FieldGroup title="People">
            <Field label="Our project manager" htmlFor="s-pm">
              <Select
                id="s-pm"
                options={people.map((p) => p.name)}
                placeholder="Not assigned"
                value={nameOf(current.projectManagerId)}
                onChange={(e) => set('projectManagerId', people.find((p) => p.name === e.target.value)?.id ?? '')}
              />
            </Field>
            <Field label="Our project lead" htmlFor="s-lead">
              <Select
                id="s-lead"
                options={people.map((p) => p.name)}
                placeholder="Not assigned"
                value={nameOf(current.projectLeadId)}
                onChange={(e) => set('projectLeadId', people.find((p) => p.name === e.target.value)?.id ?? '')}
              />
            </Field>
            <Field label="Project email address" htmlFor="s-email">
              <TextInput id="s-email" type="email" value={current.projectEmail} onChange={(e) => set('projectEmail', e.target.value)} />
            </Field>
            <Field label="Client project manager" htmlFor="s-cpm">
              <TextInput id="s-cpm" value={current.clientProjectManager} onChange={(e) => set('clientProjectManager', e.target.value)} />
            </Field>
            <Field label="Client business owner" htmlFor="s-cbo">
              <TextInput id="s-cbo" value={current.clientBusinessOwner} onChange={(e) => set('clientBusinessOwner', e.target.value)} />
            </Field>
          </FieldGroup>

          <FieldGroup title="Dates and money" description="All amounts VAT inclusive.">
            <Field label="Project start date" required error={errors.startDate} htmlFor="s-start">
              <DateInput id="s-start" value={current.startDate} invalid={!!errors.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Contracted completion date" required error={errors.contractedCompletion} htmlFor="s-end">
              <DateInput id="s-end" value={current.contractedCompletion} min={current.startDate || undefined} invalid={!!errors.contractedCompletion} onChange={(e) => set('contractedCompletion', e.target.value)} />
            </Field>
            <Field label="Contract value" required error={errors.contractValue} htmlFor="s-value">
              <MoneyInput id="s-value" value={current.contractValue} invalid={!!errors.contractValue} onChange={(v) => set('contractValue', v)} />
            </Field>
            <Field label="Internal cost budget" error={errors.costBudget} htmlFor="s-budget" hint="Optional. Drives spend against budget on the portfolio dashboard.">
              <MoneyInput id="s-budget" value={current.costBudget} invalid={!!errors.costBudget} onChange={(v) => set('costBudget', v)} placeholder="Not captured" />
            </Field>
            <Field label="Internal cost to date" error={errors.costToDate} htmlFor="s-cost" hint="What this project has actually cost us so far. Compared against the budget on the portfolio dashboard.">
              <MoneyInput id="s-cost" value={current.costToDate} invalid={!!errors.costToDate} onChange={(v) => set('costToDate', v)} placeholder="Not captured" />
            </Field>
            <Field label="Currency" htmlFor="s-ccy">
              <Select id="s-ccy" options={['ZAR']} value={current.currency} onChange={(e) => set('currency', e.target.value)} />
            </Field>
            <Field label="Support period (months)" htmlFor="s-support">
              <TextInput id="s-support" inputMode="numeric" value={current.supportPeriodMonths} onChange={(e) => set('supportPeriodMonths', e.target.value)} />
            </Field>
          </FieldGroup>

          <FieldGroup title="Locations">
            <Field label="System repository location" htmlFor="s-repo" className="sm:col-span-2">
              <TextInput id="s-repo" value={current.systemRepositoryLocation} onChange={(e) => set('systemRepositoryLocation', e.target.value)} />
            </Field>
            <Field label="Working document location" htmlFor="s-work">
              <TextInput id="s-work" value={current.workingDocumentLocation} onChange={(e) => set('workingDocumentLocation', e.target.value)} />
            </Field>
            <Field label="Approved document location" htmlFor="s-appr">
              <TextInput id="s-appr" value={current.approvedDocumentLocation} onChange={(e) => set('approvedDocumentLocation', e.target.value)} />
            </Field>
          </FieldGroup>

          {!valid ? (
            <InlineMessage tone="danger" title="Fix these before saving" icon={AlertTriangle}>
              {Object.values(errors).join(' ')}
            </InlineMessage>
          ) : null}
        </CardBody>

        <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" icon={RotateCcw} onClick={() => setDraft(null)} disabled={!dirty}>Discard changes</Button>
          <Button variant="primary" icon={Save} onClick={() => setConfirming(true)} disabled={!dirty || !valid}>Save changes</Button>
        </div>
      </Card>

      <Card className="mt-5 border-danger/20">
        <CardHeader title="Delete this project" subtitle="Everything filed against it goes with it." />
        <CardBody className="pt-4">
          <Button variant="danger" icon={Trash2} onClick={() => setDeleting(true)}>Delete project</Button>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={save}
        title="Save these changes?"
        confirmLabel="Save changes"
        disabled={!valid}
        description="The project details will be updated. Remember to reflect any change to dates or scope in the client's workbook too."
      >
        {parseAmount(current.contractValue) !== data.project.contractValue ? (
          <InlineMessage tone="warning" title="The contract value is changing">
            {formatZAR(data.project.contractValue)} becomes {formatZAR(parseAmount(current.contractValue) ?? 0)}.
            This changes the money figures on the portfolio dashboard.
          </InlineMessage>
        ) : null}
      </ConfirmDialog>

      <DeleteDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          dispatch({ type: 'project/delete', id: data.project.id });
          toast({ tone: 'success', title: 'Project deleted', body: `${data.project.name} and everything filed against it has been removed.` });
          navigate('/projects');
        }}
        title={`Delete ${data.project.name}?`}
        confirmLabel="Delete project"
        whatIsLost={
          <ul className="list-inside list-disc space-y-1">
            <li>{data.steps.length} delivery plan steps</li>
            <li>{data.entries.length} submissions register entries</li>
            <li>{data.documents.length} documents and every version of them</li>
            <li>{data.invoices.length} invoices, totalling {formatZAR(data.invoices.reduce((s, i) => s + i.amount, 0), { decimals: false })}</li>
            <li>{data.reports.length} monthly report records</li>
          </ul>
        }
      />
    </>
  );
}

function WorkbookCard({
  title, description, value, error, age, onChange, onToday, id,
}: {
  title: string; description: string; value: string; error?: string;
  age: ReturnType<typeof workbookAge>;
  onChange: (v: string) => void; onToday: () => void; id: string;
}) {
  return (
    <Card className={cx(
      'overflow-hidden',
      age.tone === 'danger' ? 'border-danger/30' : age.tone === 'warning' ? 'border-warning/30' : '',
    )}>
      <div className={cx(
        'h-1 w-full',
        age.tone === 'danger' ? 'bg-danger' : age.tone === 'warning' ? 'bg-warning' : 'bg-success',
      )} aria-hidden />
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold leading-snug text-indigo">{title}</h2>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">{description}</p>
          </div>
          <Pill tone={age.tone} size="sm">
            {age.days === null ? 'Not set' : age.days <= 0 ? 'Today' : `${age.days}d`}
          </Pill>
        </div>
        <div className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor={id} className="sr-only">{title}</label>
            <DateInput id={id} value={value} max={today()} invalid={!!error} onChange={(e) => onChange(e.target.value)} />
          </div>
          <Button icon={CalendarCheck} onClick={onToday}>Today</Button>
        </div>
        <p className={cx(
          'mt-2.5 text-[12.5px] font-medium',
          error ? 'text-danger' : age.tone === 'danger' ? 'text-danger' : age.tone === 'warning' ? 'text-warning' : 'text-success',
        )}>
          {error ?? age.message}
        </p>
        {value && !error ? (
          <p className="mt-1 text-[12px] text-ink-faint">Last updated {formatDate(value)}.</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
