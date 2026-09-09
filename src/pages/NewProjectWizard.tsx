import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Building2, Calendar, Check, FolderTree, ListChecks, Sparkles, Users,
} from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, Card, CardBody, CardHeader, cx, InlineMessage, Pill } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/Modal';
import { DateInput, Field, FieldGroup, MoneyInput, Select, TextInput } from '@/components/ui/form';
import { TEMPLATE_REGISTER_COUNT, TEMPLATE_STEP_COUNT, uid } from '@/data/factory';
import { PHASES } from '@/data/reference';
import { formatZAR, parseAmount } from '@/lib/money';
import { addMonths, formatDate, isValidISO, today } from '@/lib/dates';
import type { Project } from '@/types';

interface Draft {
  name: string; client: string; contractRef: string; serviceScheduleRef: string; deliveryTier: '1' | '2';
  projectManagerId: string; projectLeadId: string; projectEmail: string;
  clientProjectManager: string; clientBusinessOwner: string;
  startDate: string; contractedCompletion: string; contractValue: string; currency: string;
  supportPeriodMonths: string; costBudget: string;
  systemRepositoryLocation: string; workingDocumentLocation: string; approvedDocumentLocation: string;
}

const EMPTY: Draft = {
  name: '', client: '', contractRef: '', serviceScheduleRef: '', deliveryTier: '1',
  projectManagerId: '', projectLeadId: '', projectEmail: '',
  clientProjectManager: '', clientBusinessOwner: '',
  startDate: today(), contractedCompletion: '', contractValue: '', currency: 'ZAR',
  supportPeriodMonths: '12', costBudget: '',
  systemRepositoryLocation: '', workingDocumentLocation: '', approvedDocumentLocation: '',
};

const STEPS = [
  { key: 'details', label: 'Project details', icon: Building2 },
  { key: 'people', label: 'People', icon: Users },
  { key: 'money', label: 'Dates and money', icon: Calendar },
  { key: 'locations', label: 'Locations', icon: FolderTree },
  { key: 'review', label: 'Review and create', icon: Check },
] as const;

type Errors = Partial<Record<keyof Draft, string>>;

function validate(d: Draft, step: number): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!d.name.trim()) e.name = 'Give the project a name. This is what everyone will look for.';
    if (!d.client.trim()) e.client = 'Name the client or department this is delivered for.';
    if (!d.contractRef.trim()) e.contractRef = 'The contract or TOR reference ties this to the signed agreement.';
  }
  if (step === 1) {
    if (!d.projectManagerId) e.projectManagerId = 'Every project needs a project manager.';
    if (!d.projectLeadId) e.projectLeadId = 'Every project needs a project lead.';
    if (d.projectEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.projectEmail.trim())) {
      e.projectEmail = 'That is not a valid email address.';
    }
  }
  if (step === 2) {
    if (!isValidISO(d.startDate)) e.startDate = 'Enter the project start date.';
    if (!isValidISO(d.contractedCompletion)) e.contractedCompletion = 'Enter the contracted completion date.';
    else if (isValidISO(d.startDate) && d.contractedCompletion < d.startDate) {
      e.contractedCompletion = 'Contracted completion cannot be before the project start.';
    }
    const v = parseAmount(d.contractValue);
    if (v === null || v <= 0) e.contractValue = 'Enter the contract value, VAT inclusive.';
    if (d.costBudget.trim() && parseAmount(d.costBudget) === null) {
      e.costBudget = 'Enter a number, or leave it blank.';
    }
    const months = Number(d.supportPeriodMonths);
    if (!Number.isInteger(months) || months < 0 || months > 120) {
      e.supportPeriodMonths = 'Enter a whole number of months, from 0 to 120.';
    }
  }
  return e;
}

export default function NewProjectWizard() {
  const { state, dispatch, toast } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const errors = useMemo(() => validate(draft, step), [draft, step]);
  const stepValid = Object.keys(errors).length === 0;
  const allValid = useMemo(
    () => [0, 1, 2].every((s) => Object.keys(validate(draft, s)).length === 0),
    [draft],
  );

  const people = state.people.filter((p) => p.active);
  const managers = people.filter((p) => p.role === 'Project manager' || p.role === 'Director');
  const leads = people.filter((p) => p.role === 'Project lead' || p.role === 'Director');

  const next = () => {
    setTouched(true);
    if (!stepValid) return;
    setTouched(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => { setTouched(false); setStep((s) => Math.max(s - 1, 0)); };

  const create = () => {
    const id = uid('proj');
    const project: Project = {
      id,
      name: draft.name.trim(),
      client: draft.client.trim(),
      contractRef: draft.contractRef.trim(),
      serviceScheduleRef: draft.serviceScheduleRef.trim(),
      deliveryTier: draft.deliveryTier,
      projectManagerId: draft.projectManagerId,
      projectLeadId: draft.projectLeadId,
      projectEmail: draft.projectEmail.trim(),
      clientProjectManager: draft.clientProjectManager.trim(),
      clientBusinessOwner: draft.clientBusinessOwner.trim(),
      startDate: draft.startDate,
      contractedCompletion: draft.contractedCompletion,
      contractValue: parseAmount(draft.contractValue) ?? 0,
      currency: draft.currency,
      supportPeriodMonths: Number(draft.supportPeriodMonths) || 0,
      costBudget: draft.costBudget.trim() ? parseAmount(draft.costBudget) : null,
      // Internal cost accrues as the work happens; it is captured on Setup.
      costToDate: null,
      systemRepositoryLocation: draft.systemRepositoryLocation.trim(),
      workingDocumentLocation: draft.workingDocumentLocation.trim(),
      approvedDocumentLocation: draft.approvedDocumentLocation.trim(),
      departmentalWorkbookUpdated: '',
      thisWorkbookUpdated: today(),
      archived: false,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'project/create', project });
    setConfirming(false);
    toast({
      tone: 'success',
      title: 'Project created',
      body: `${TEMPLATE_STEP_COUNT} delivery plan steps and ${TEMPLATE_REGISTER_COUNT} register entries were seeded from the standard template.`,
    });
    navigate(`/projects/${id}`);
  };

  const err = (k: keyof Draft) => (touched ? errors[k] : undefined);
  const personName = (id: string) => state.people.find((p) => p.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader
        title="New project"
        subtitle="The delivery plan and submissions register are created for you from the standard template. Nobody copies last project's file."
        action={<Button variant="ghost" onClick={() => navigate('/projects')}>Cancel</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Step rail */}
        <nav aria-label="Wizard progress" className="min-w-0">
          <ol className="flex gap-2 overflow-x-auto rw-scroll lg:sticky lg:top-[84px] lg:flex-col lg:gap-1 lg:overflow-visible">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={s.key} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => { if (i <= step) { setTouched(false); setStep(i); } }}
                    disabled={i > step}
                    aria-current={current ? 'step' : undefined}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition-colors',
                      current ? 'bg-cyan-50 text-indigo'
                        : done ? 'text-ink-muted hover:bg-canvas'
                        : 'cursor-not-allowed text-ink-faint',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        current ? 'bg-cyan-600 text-white'
                          : done ? 'bg-success-bg text-success'
                          : 'bg-neutral-bg text-ink-faint',
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <Card>
          <CardHeader
            title={STEPS[step].label}
            subtitle={
              step === 0 ? 'What this project is and which agreement it sits under.'
                : step === 1 ? 'Ours and theirs. These names appear on every submission.'
                : step === 2 ? 'The contract term and the money. All amounts VAT inclusive.'
                : step === 3 ? 'Where the code and the documents live.'
                : 'Check it, then create the project.'
            }
          />
          <CardBody className="pt-4">
            {step === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project name" required error={err('name')} htmlFor="w-name" className="sm:col-span-2">
                  <TextInput id="w-name" value={draft.name} invalid={!!err('name')} onChange={(e) => set('name', e.target.value)} placeholder="Vulindlela Power Business Intelligence System" />
                </Field>
                <Field label="Client or department" required error={err('client')} htmlFor="w-client" className="sm:col-span-2">
                  <TextInput id="w-client" value={draft.client} invalid={!!err('client')} onChange={(e) => set('client', e.target.value)} placeholder="Department of Science, Technology and Innovation" />
                </Field>
                <Field label="Contract or TOR reference" required error={err('contractRef')} htmlFor="w-ref">
                  <TextInput id="w-ref" value={draft.contractRef} invalid={!!err('contractRef')} onChange={(e) => set('contractRef', e.target.value)} placeholder="DSTI/TOR/2026-118" />
                </Field>
                <Field label="Service schedule reference" htmlFor="w-sched">
                  <TextInput id="w-sched" value={draft.serviceScheduleRef} onChange={(e) => set('serviceScheduleRef', e.target.value)} placeholder="SS-2026-118-04" />
                </Field>
                <Field label="Delivery tier" htmlFor="w-tier" hint="Tier 2 carries the full documentation set.">
                  <Select id="w-tier" options={['1', '2']} value={draft.deliveryTier} onChange={(e) => set('deliveryTier', e.target.value as '1' | '2')} />
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-6">
                <FieldGroup title="Rewatu">
                  <Field label="Our project manager" required error={err('projectManagerId')} htmlFor="w-pm">
                    <Select
                      id="w-pm"
                      invalid={!!err('projectManagerId')}
                      options={managers.map((p) => p.name)}
                      placeholder="Choose a project manager"
                      value={personName(draft.projectManagerId) === '—' ? '' : personName(draft.projectManagerId)}
                      onChange={(e) => set('projectManagerId', people.find((p) => p.name === e.target.value)?.id ?? '')}
                    />
                  </Field>
                  <Field label="Our project lead" required error={err('projectLeadId')} htmlFor="w-lead">
                    <Select
                      id="w-lead"
                      invalid={!!err('projectLeadId')}
                      options={leads.map((p) => p.name)}
                      placeholder="Choose a project lead"
                      value={personName(draft.projectLeadId) === '—' ? '' : personName(draft.projectLeadId)}
                      onChange={(e) => set('projectLeadId', people.find((p) => p.name === e.target.value)?.id ?? '')}
                    />
                  </Field>
                  <Field label="Project email address" error={err('projectEmail')} htmlFor="w-email" className="sm:col-span-2" hint="Created in phase 1, step 1.2. Every submission goes from here.">
                    <TextInput id="w-email" type="email" invalid={!!err('projectEmail')} value={draft.projectEmail} onChange={(e) => set('projectEmail', e.target.value)} placeholder="projectname@rewatu.co.za" />
                  </Field>
                </FieldGroup>
                <FieldGroup title="Client">
                  <Field label="Client project manager" htmlFor="w-cpm">
                    <TextInput id="w-cpm" value={draft.clientProjectManager} onChange={(e) => set('clientProjectManager', e.target.value)} />
                  </Field>
                  <Field label="Client business owner" htmlFor="w-cbo">
                    <TextInput id="w-cbo" value={draft.clientBusinessOwner} onChange={(e) => set('clientBusinessOwner', e.target.value)} />
                  </Field>
                </FieldGroup>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project start date" required error={err('startDate')} htmlFor="w-start">
                  <DateInput id="w-start" value={draft.startDate} invalid={!!err('startDate')} onChange={(e) => set('startDate', e.target.value)} />
                </Field>
                <Field
                  label="Contracted completion date" required error={err('contractedCompletion')} htmlFor="w-end"
                  hint={draft.startDate && !err('contractedCompletion') ? 'Must be on or after the project start.' : undefined}
                >
                  <DateInput id="w-end" value={draft.contractedCompletion} min={draft.startDate || undefined} invalid={!!err('contractedCompletion')} onChange={(e) => set('contractedCompletion', e.target.value)} />
                </Field>
                <Field label="Contract value (VAT inclusive)" required error={err('contractValue')} htmlFor="w-value">
                  <MoneyInput id="w-value" value={draft.contractValue} invalid={!!err('contractValue')} onChange={(v) => set('contractValue', v)} placeholder="498 732.72" />
                </Field>
                <Field label="Currency" htmlFor="w-ccy">
                  <Select id="w-ccy" options={['ZAR']} value={draft.currency} onChange={(e) => set('currency', e.target.value)} />
                </Field>
                <Field label="Support period (months)" error={err('supportPeriodMonths')} htmlFor="w-support">
                  <TextInput id="w-support" inputMode="numeric" invalid={!!err('supportPeriodMonths')} value={draft.supportPeriodMonths} onChange={(e) => set('supportPeriodMonths', e.target.value)} />
                </Field>
                <Field label="Internal cost budget (optional)" error={err('costBudget')} htmlFor="w-budget" hint="Used for spend against budget on the portfolio dashboard.">
                  <MoneyInput id="w-budget" value={draft.costBudget} invalid={!!err('costBudget')} onChange={(v) => set('costBudget', v)} placeholder="341 000.00" />
                </Field>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4">
                <Field label="System repository location" htmlFor="w-repo" hint="Where the code lives. Set up in phase 1, step 1.3.">
                  <TextInput id="w-repo" value={draft.systemRepositoryLocation} onChange={(e) => set('systemRepositoryLocation', e.target.value)} placeholder="github.com/rewatu/project-name" />
                </Field>
                <Field label="Working document location" htmlFor="w-work" hint="Drafts in progress.">
                  <TextInput id="w-work" value={draft.workingDocumentLocation} onChange={(e) => set('workingDocumentLocation', e.target.value)} placeholder="SharePoint › Rewatu › Project › 01 Working" />
                </Field>
                <Field label="Approved document location" htmlFor="w-appr" hint="The client-facing record. Only signed and acknowledged documents belong here.">
                  <TextInput id="w-appr" value={draft.approvedDocumentLocation} onChange={(e) => set('approvedDocumentLocation', e.target.value)} placeholder="SharePoint › Rewatu › Project › 02 Approved" />
                </Field>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-5">
                <ReviewGroup title="Project details" rows={[
                  ['Project name', draft.name],
                  ['Client or department', draft.client],
                  ['Contract or TOR reference', draft.contractRef],
                  ['Service schedule reference', draft.serviceScheduleRef || '—'],
                  ['Delivery tier', `Tier ${draft.deliveryTier}`],
                ]} />
                <ReviewGroup title="People" rows={[
                  ['Our project manager', personName(draft.projectManagerId)],
                  ['Our project lead', personName(draft.projectLeadId)],
                  ['Project email address', draft.projectEmail || '—'],
                  ['Client project manager', draft.clientProjectManager || '—'],
                  ['Client business owner', draft.clientBusinessOwner || '—'],
                ]} />
                <ReviewGroup title="Dates and money" rows={[
                  ['Project start date', formatDate(draft.startDate)],
                  ['Contracted completion', formatDate(draft.contractedCompletion)],
                  ['Contract value', formatZAR(parseAmount(draft.contractValue) ?? 0)],
                  ['Internal cost budget', draft.costBudget.trim() ? formatZAR(parseAmount(draft.costBudget) ?? 0) : 'Not captured'],
                  ['Support period', `${draft.supportPeriodMonths} months, to ${formatDate(addMonths(draft.contractedCompletion, Number(draft.supportPeriodMonths) || 0))}`],
                ]} />
                <ReviewGroup title="Locations" rows={[
                  ['System repository', draft.systemRepositoryLocation || '—'],
                  ['Working documents', draft.workingDocumentLocation || '—'],
                  ['Approved documents', draft.approvedDocumentLocation || '—'],
                ]} />

                <div className="rounded-card border border-cyan-600/20 bg-cyan-50 p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-link" strokeWidth={2} aria-hidden />
                    <div>
                      <h3 className="text-[14px] font-semibold text-indigo">What will be created</h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
                        <span className="font-semibold">{TEMPLATE_STEP_COUNT} delivery plan steps across {PHASES.length} phases</span>
                        {' and '}
                        <span className="font-semibold">{TEMPLATE_REGISTER_COUNT} register entries</span>
                        {' will be created from the standard template. You can add, edit and reorder them afterwards.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill tone="neutral" size="sm" icon={ListChecks}>Status: Not started</Pill>
                        <Pill tone="neutral" size="sm">Submission status as seeded</Pill>
                        <Pill tone="neutral" size="sm">Planned dates drafted across the term</Pill>
                      </div>
                    </div>
                  </div>
                </div>

                {!allValid ? (
                  <InlineMessage tone="danger" title="Something earlier is incomplete">
                    Go back and fill in the fields marked in red. The project cannot be created until the name, client, contract reference, people, dates and contract value are all present.
                  </InlineMessage>
                ) : null}
              </div>
            ) : null}
          </CardBody>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas px-5 py-4">
            <Button variant="ghost" icon={ArrowLeft} onClick={back} disabled={step === 0}>Back</Button>
            <div className="flex items-center gap-2">
              <span className="hidden text-[12.5px] text-ink-muted sm:block">Step {step + 1} of {STEPS.length}</span>
              {step < STEPS.length - 1 ? (
                <Button variant="primary" iconRight={ArrowRight} onClick={next}>Continue</Button>
              ) : (
                <Button variant="primary" icon={Check} onClick={() => setConfirming(true)} disabled={!allValid}>
                  Create project
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={create}
        title="Create this project?"
        confirmLabel="Create project"
        disabled={!allValid}
        description={
          <>
            <span className="font-semibold text-indigo">{draft.name}</span> will be created for {draft.client}, with{' '}
            {TEMPLATE_STEP_COUNT} delivery plan steps and {TEMPLATE_REGISTER_COUNT} register entries seeded from the standard template.
          </>
        }
      />
    </>
  );
}

function ReviewGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section>
      <h3 className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">{title}</h3>
      <dl className="mt-2.5 divide-y divide-line rounded-lg border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
            <dt className="w-52 shrink-0 text-[12.5px] text-ink-muted">{k}</dt>
            <dd className="min-w-0 text-[13px] font-medium text-indigo">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
