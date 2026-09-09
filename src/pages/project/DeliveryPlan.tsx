import { useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowDown, ArrowUp, ChevronsDownUp, ChevronsUpDown, Copy, CornerDownLeft, Eye,
  CornerDownRight, Download, ExternalLink, FileUp, Filter, GripVertical, ListChecks, MoreVertical,
  Paperclip, Pencil, Plus, Search, Trash2, X,
} from 'lucide-react';
import { useApp, useProject } from '@/store/AppStore';
import { ProjectManagerReminder } from '@/pages/project/ProjectWorkspace';
import {
  Button, Card, CardBody, Checkbox, Chevron, cx, EmptyState, IconButton,
  InlineMessage, Pill, ProgressBar,
} from '@/components/ui/primitives';
import { ConfirmDialog, DeleteDialog } from '@/components/ui/Modal';
import { CalcCell, DateCell, PercentCell, SelectCell, TextCell } from '@/components/ui/EditableCell';
import { AcknowledgedPill, FlagPill, StatusPill, SubmissionPill } from '@/components/ui/StatusPills';
import { UploadDialog, type UploadTarget } from '@/components/documents/Upload';
import { StepEditor } from '@/pages/project/StepEditor';
import { PHASES, RESPONSIBLE, STATUS, SUBMISSION_STATUS, YES_NO, FLAGS } from '@/data/reference';
import type { DeliveryStep, DocumentRecord, Person, Responsible } from '@/types';
import { daysLate, stepDays, stepFlag } from '@/lib/derive';
import { formatDate, isValidISO } from '@/lib/dates';
import { downloadWorkbook, safeFileName } from '@/lib/export';
import { abilities } from '@/lib/permissions';
import { PLAN_COLUMNS, describeAcknowledgement, describeStatusChange, planSheet, type PendingChange } from '@/pages/project/planHelpers';

interface Filters {
  q: string; phase: string; status: string; flag: string; responsible: string; overdueOnly: boolean;
}
const NO_FILTERS: Filters = { q: '', phase: '', status: '', flag: '', responsible: '', overdueOnly: false };

export default function DeliveryPlan() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const { state, dispatch, toast, currentUser } = useApp();
  const data = useProject(projectId);

  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, phase: params.get('phase') ?? '' });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [deleting, setDeleting] = useState<DeliveryStep | null>(null);
  const [upload, setUpload] = useState<UploadTarget | null>(null);
  const [editing, setEditing] = useState<DeliveryStep | null>(null);
  const [bulk, setBulk] = useState<{ field: 'status' | 'responsible'; value: string } | null>(null);
  const dragged = useRef<{ id: string; phase: string } | null>(null);

  const steps = data?.steps ?? [];
  const docs = data?.documents ?? [];
  const can = abilities(state, currentUser, data?.project ?? null);

  const filtered = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    return steps.filter((s) => {
      if (filters.phase && s.phase !== filters.phase) return false;
      if (filters.status && s.status !== filters.status) return false;
      if (filters.responsible && s.responsible !== filters.responsible) return false;
      if (filters.flag && stepFlag(s) !== filters.flag) return false;
      if (filters.overdueOnly && stepFlag(s) !== 'Overdue') return false;
      if (term && !`${s.step} ${s.action} ${s.deliverable}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [steps, filters]);

  const groups = useMemo(() => {
    const present = PHASES.filter((p) => filtered.some((s) => s.phase === p));
    const extra = [...new Set(filtered.map((s) => s.phase))].filter((p) => !PHASES.includes(p as never));
    return [...present, ...extra].map((phase) => ({
      phase,
      rows: filtered.filter((s) => s.phase === phase),
      all: steps.filter((s) => s.phase === phase),
    }));
  }, [filtered, steps]);

  if (!data) return null;

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    if (k === 'phase') {
      const p = new URLSearchParams(params);
      if (v) p.set('phase', String(v)); else p.delete('phase');
      setParams(p, { replace: true });
    }
  };

  const patch = (id: string, p: Partial<DeliveryStep>) => dispatch({ type: 'step/update', id, patch: p });

  /** Status, submission and acknowledgement all go through a confirmation. */
  const requestStatus = (step: DeliveryStep, value: string) => setPending(describeStatusChange(step, value, docs));
  const requestAck = (step: DeliveryStep, value: string) => setPending(describeAcknowledgement(step, value));
  const requestSubmission = (step: DeliveryStep, value: string) => setPending({
    stepId: step.id, field: 'submission', value,
    title: `Set the submission to ${value}?`,
    description: step.action,
    consequence: value === 'Not required'
      ? 'With no submission required, this step can be marked Completed without an evidence file, and its flag will go straight to Complete.'
      : step.status === 'Completed' && step.acknowledged !== 'Yes'
        ? 'The step is already Completed, so its flag becomes Awaiting acknowledgement until the client acknowledges.'
        : undefined,
  });

  const applyPending = () => {
    if (!pending || pending.blockedReason) return;
    const step = steps.find((s) => s.id === pending.stepId);
    if (!step) return;
    const p: Partial<DeliveryStep> = {};
    if (pending.field === 'status') {
      p.status = pending.value as DeliveryStep['status'];
      if (pending.value === 'Completed') {
        p.percentComplete = 100;
        if (!step.actualCompletion) p.actualCompletion = new Date().toISOString().slice(0, 10);
      }
      if (pending.value === 'Not started') { p.percentComplete = 0; p.actualCompletion = ''; }
    }
    if (pending.field === 'submission') {
      p.submission = pending.value as DeliveryStep['submission'];
      if (pending.value === 'Not required') p.acknowledged = 'Not applicable';
      else if (step.acknowledged === 'Not applicable') p.acknowledged = 'No';
    }
    if (pending.field === 'acknowledged') p.acknowledged = pending.value as DeliveryStep['acknowledged'];
    patch(step.id, p);
    setPending(null);
    toast({ tone: 'success', title: `Step ${step.step} updated`, body: `Flag is now ${stepFlag({ ...step, ...p }) || 'blank'}.` });
  };

  const applyBulk = () => {
    if (!bulk) return;
    const ids = [...selected];
    if (bulk.field === 'status' && bulk.value === 'Completed') {
      // The completion gate applies to every row, not only the one being clicked.
      const blocked = ids
        .map((id) => steps.find((s) => s.id === id)!)
        .filter((s) => s.submission !== 'Not required' && !docs.some((d) => d.stepId === s.id));
      if (blocked.length > 0) {
        toast({
          tone: 'danger',
          title: `${blocked.length} step${blocked.length === 1 ? '' : 's'} cannot be completed`,
          body: 'They carry a submission to the client and have no evidence file. Attach the deliverables first.',
        });
        setBulk(null);
        return;
      }
    }
    dispatch({
      type: 'step/updateMany',
      ids,
      patch: bulk.field === 'status'
        ? { status: bulk.value as DeliveryStep['status'], ...(bulk.value === 'Completed' ? { percentComplete: 100 } : {}) }
        : { responsible: bulk.value as Responsible },
    });
    toast({ tone: 'success', title: `${ids.length} step${ids.length === 1 ? '' : 's'} updated` });
    setSelected(new Set());
    setBulk(null);
  };

  const exportPlan = async () => {
    const result = await downloadWorkbook(
      [planSheet(filtered, docs, state.people, 'Delivery Plan')],
      `${safeFileName(data.project.name)}-delivery-plan`,
    );
    toast(result.ok
      ? {
          tone: 'success',
          title: 'Delivery plan exported',
          body: `${filtered.length} rows, in the column order shown on screen.`,
        }
      : { tone: 'danger', title: 'Export not saved', body: result.reason });
  };

  const onDrop = (targetId: string, phase: string) => {
    const d = dragged.current;
    dragged.current = null;
    if (!d || d.id === targetId || d.phase !== phase) return;
    const inPhase = steps.filter((s) => s.phase === phase).map((s) => s.id);
    const from = inPhase.indexOf(d.id);
    const to = inPhase.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...inPhase];
    next.splice(from, 1);
    next.splice(to, 0, d.id);
    dispatch({ type: 'step/reorder', projectId: data.project.id, phase, orderedIds: next });
    toast({ tone: 'success', title: 'Step moved', body: 'Reference numbers have been resequenced.' });
  };

  const move = (step: DeliveryStep, dir: -1 | 1) => {
    const inPhase = steps.filter((s) => s.phase === step.phase).map((s) => s.id);
    const i = inPhase.indexOf(step.id);
    const j = i + dir;
    if (j < 0 || j >= inPhase.length) return;
    const next = [...inPhase];
    [next[i], next[j]] = [next[j], next[i]];
    dispatch({ type: 'step/reorder', projectId: data.project.id, phase: step.phase, orderedIds: next });
  };

  const refOf = (s: DeliveryStep) => steps.indexOf(s) + 1;

  return (
    <>
      <ProjectManagerReminder />

      {!can.editPlan ? (
        <InlineMessage tone="neutral" className="mb-5" icon={Eye} title="You are reading this plan">
          Only the project manager, the project lead or a director may change it. The steps assigned to
          you are on{' '}
          <Link to="/tasks" className="font-semibold text-cyan-link hover:underline">My tasks</Link>, where
          you can work them and upload evidence.
        </InlineMessage>
      ) : null}

      {/* Toolbar */}
      <Card className="mb-5">
        <CardBody className="space-y-3 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="plan-q" className="sr-only">Search actions and deliverables</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={2} aria-hidden />
              <input
                id="plan-q"
                value={filters.q}
                onChange={(e) => setFilter('q', e.target.value)}
                placeholder="Search across action and deliverable"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm placeholder:text-ink-faint hover:border-[#CFD8E1]"
              />
              {filters.q ? (
                <button type="button" onClick={() => setFilter('q', '')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-indigo">
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={Download} onClick={exportPlan}>Export to Excel</Button>
              <Button
                icon={collapsed.size === groups.length ? ChevronsUpDown : ChevronsDownUp}
                onClick={() => setCollapsed(collapsed.size === groups.length ? new Set() : new Set(groups.map((g) => g.phase)))}
              >
                {collapsed.size === groups.length ? 'Expand all' : 'Collapse all'}
              </Button>
              {can.editPlan ? (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => dispatch({ type: 'step/insert', projectId: data.project.id, afterId: null, phase: filters.phase || PHASES[0] })}
                >
                  Add step
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-faint">
              <Filter className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Filter
            </span>
            <FilterSelect label="Phase" value={filters.phase} options={PHASES} onChange={(v) => setFilter('phase', v)} allLabel="All phases" />
            <FilterSelect label="Status" value={filters.status} options={STATUS} onChange={(v) => setFilter('status', v)} allLabel="All statuses" />
            <FilterSelect label="Flag" value={filters.flag} options={FLAGS} onChange={(v) => setFilter('flag', v)} allLabel="All flags" />
            <FilterSelect label="Responsible party" value={filters.responsible} options={RESPONSIBLE} onChange={(v) => setFilter('responsible', v)} allLabel="Anyone" />
            <div className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-2.5 hover:border-[#CFD8E1]">
              <Checkbox
                checked={filters.overdueOnly}
                onChange={(v) => setFilter('overdueOnly', v)}
                label="Show overdue steps only"
                text="Overdue only"
              />
            </div>
            {filtersActive ? (
              <Button size="sm" variant="ghost" icon={X} onClick={() => { setFilters(NO_FILTERS); setParams(new URLSearchParams(), { replace: true }); }}>
                Clear filters
              </Button>
            ) : null}
            <span className="ml-auto text-[12.5px] tabular-nums text-ink-muted">
              {filtered.length} of {steps.length} steps
            </span>
          </div>
        </CardBody>
      </Card>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="sticky top-[68px] z-10 mb-5 flex flex-col gap-3 rounded-card border border-cyan-600/25 bg-cyan-50 p-3.5 shadow-raised sm:flex-row sm:items-center">
          <p className="text-[13px] font-semibold text-indigo">
            {selected.size} step{selected.size === 1 ? '' : 's'} selected
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <BulkSelect label="Set status" options={STATUS} onPick={(v) => setBulk({ field: 'status', value: v })} />
            <BulkSelect label="Set responsible party" options={RESPONSIBLE} onPick={(v) => setBulk({ field: 'responsible', value: v })} />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
          </div>
        </div>
      ) : null}

      {/* Groups */}
      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title={steps.length === 0 ? 'This plan has no steps' : 'No step matches those filters'}
            body={steps.length === 0
              ? 'A project created through the wizard arrives with 55 steps across 10 phases. Add the first step to start building this plan by hand.'
              : 'Clear the filters to see the rest of the plan, or widen the search.'}
            action={steps.length === 0
              ? <Button icon={Plus} onClick={() => dispatch({ type: 'step/insert', projectId: data.project.id, afterId: null, phase: PHASES[0] })}>Add the first step</Button>
              : <Button onClick={() => { setFilters(NO_FILTERS); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.phase);
            const complete = g.all.filter((s) => stepFlag(s) === 'Complete').length;
            const countable = g.all.filter((s) => s.status !== 'Not applicable').length;
            const pctDone = countable ? Math.round((complete / countable) * 100) : 0;
            const allSelected = g.rows.length > 0 && g.rows.every((s) => selected.has(s.id));

            return (
              <Card key={g.phase}>
                <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => {
                      const n = new Set(prev);
                      if (n.has(g.phase)) n.delete(g.phase); else n.add(g.phase);
                      return n;
                    })}
                    aria-expanded={!isCollapsed}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded text-left"
                  >
                    <Chevron open={!isCollapsed} className="text-ink-muted" />
                    <h2 className="text-[15px] font-semibold text-indigo">{g.phase}</h2>
                    <Pill tone={pctDone === 100 ? 'success' : 'neutral'} size="sm">
                      {complete}/{countable} complete
                    </Pill>
                  </button>
                  <div className="flex items-center gap-3 sm:w-72">
                    <ProgressBar
                      value={pctDone}
                      tone={pctDone === 100 ? 'success' : 'brand'}
                      label={`${g.phase}: ${pctDone}% complete`}
                    />
                    <span className="w-9 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-indigo">{pctDone}%</span>
                    {can.editPlan ? (
                      <Button
                        size="sm"
                        icon={Plus}
                        onClick={() => dispatch({
                          type: 'step/insert',
                          projectId: data.project.id,
                          afterId: g.all[g.all.length - 1]?.id ?? null,
                          phase: g.phase,
                        })}
                      >
                        <span className="hidden sm:inline">Add step</span>
                      </Button>
                    ) : null}
                  </div>
                </div>

                {!isCollapsed ? (
                  <>
                    {/* Desktop grid. The card holds the horizontal scroll, not the page. */}
                    <div className="rw-scroll hidden overflow-x-auto border-t border-line md:block">
                      <table className="w-full border-collapse text-sm" style={{ minWidth: 2560 }}>
                        <caption className="sr-only">{g.phase} delivery plan steps</caption>
                        <thead>
                          <tr className="border-b border-line bg-canvas/60">
                            <th scope="col" className="w-10 px-2 py-2.5">
                              <Checkbox
                                checked={allSelected}
                                indeterminate={!allSelected && g.rows.some((s) => selected.has(s.id))}
                                label={`Select all steps in ${g.phase}`}
                                onChange={(v) => setSelected((prev) => {
                                  const n = new Set(prev);
                                  g.rows.forEach((s) => (v ? n.add(s.id) : n.delete(s.id)));
                                  return n;
                                })}
                              />
                            </th>
                            <th scope="col" className="w-8 px-1 py-2.5"><span className="sr-only">Reorder</span></th>
                            {PLAN_COLUMNS.map((c, i) => (
                              <th
                                key={c}
                                scope="col"
                                style={{ width: COLUMN_WIDTHS[i] }}
                                className="px-2.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint"
                              >
                                {c}
                              </th>
                            ))}
                            <th scope="col" className="w-10 px-2 py-2.5"><span className="sr-only">Row actions</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((s) => (
                            <StepRow
                              key={s.id}
                              step={s}
                              refNo={refOf(s)}
                              docs={docs}
                              people={state.people}
                              selected={selected.has(s.id)}
                              onSelect={(v) => setSelected((prev) => {
                                const n = new Set(prev);
                                if (v) n.add(s.id); else n.delete(s.id);
                                return n;
                              })}
                              onPatch={(p) => patch(s.id, p)}
                              onStatus={(v) => requestStatus(s, v)}
                              onSubmission={(v) => requestSubmission(s, v)}
                              onAck={(v) => requestAck(s, v)}
                              onUpload={() => setUpload({
                                projectId: data.project.id, stepId: s.id,
                                defaultName: s.deliverable || s.action, defaultType: 'Evidence',
                              })}
                              onDelete={() => setDeleting(s)}
                              onDuplicate={() => dispatch({ type: 'step/duplicate', id: s.id })}
                              onInsert={(where) => dispatch({
                                type: 'step/insert', projectId: data.project.id,
                                afterId: where === 'below' ? s.id : (g.all[g.all.indexOf(s) - 1]?.id ?? null),
                                phase: s.phase,
                              })}
                              onMove={(d) => move(s, d)}
                              canEdit={can.editPlan}
                              onDragStart={() => { dragged.current = { id: s.id, phase: g.phase }; }}
                              onDropOn={() => onDrop(s.id, g.phase)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Phone: one card per step, with a full-field editor behind Edit. */}
                    <ul className="space-y-3 border-t border-line p-4 md:hidden">
                      {g.rows.map((s) => (
                        <li key={s.id}>
                          <StepCard
                            step={s}
                            refNo={refOf(s)}
                            hasEvidence={docs.some((d) => d.stepId === s.id)}
                            selected={selected.has(s.id)}
                            onSelect={(v) => setSelected((prev) => {
                              const n = new Set(prev);
                              if (v) n.add(s.id); else n.delete(s.id);
                              return n;
                            })}
                            onEdit={() => setEditing(s)}
                            onUpload={() => setUpload({
                              projectId: data.project.id, stepId: s.id,
                              defaultName: s.deliverable || s.action, defaultType: 'Evidence',
                            })}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={applyPending}
        title={pending?.title ?? ''}
        confirmLabel={pending?.blockedReason ? 'Close' : 'Apply the change'}
        disabled={!!pending?.blockedReason}
        description={pending?.description}
      >
        {pending?.blockedReason ? (
          <InlineMessage tone="danger" icon={AlertTriangle} title="This is not allowed yet">
            {pending.blockedReason}
          </InlineMessage>
        ) : pending?.consequence ? (
          <InlineMessage tone="warning" title="What this means">{pending.consequence}</InlineMessage>
        ) : null}
        {pending?.blockedReason && pending.field === 'status' ? (
          <div className="mt-3">
            <Button
              icon={FileUp}
              onClick={() => {
                const s = steps.find((x) => x.id === pending.stepId);
                setPending(null);
                if (s) setUpload({ projectId: data.project.id, stepId: s.id, defaultName: s.deliverable || s.action, defaultType: 'Evidence' });
              }}
            >
              Upload the evidence now
            </Button>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!bulk}
        onClose={() => setBulk(null)}
        onConfirm={applyBulk}
        title={bulk ? `Set ${bulk.field === 'status' ? 'status' : 'responsible party'} on ${selected.size} step${selected.size === 1 ? '' : 's'}?` : ''}
        confirmLabel="Apply to selected"
        description={bulk ? `Every selected step will be set to “${bulk.value}”.` : undefined}
      >
        {bulk?.field === 'status' && bulk.value === 'Completed' ? (
          <InlineMessage tone="warning" title="The evidence rule still applies">
            Any selected step that carries a submission to the client and has no evidence file will stop this from going ahead.
          </InlineMessage>
        ) : null}
      </ConfirmDialog>

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          dispatch({ type: 'step/delete', id: deleting.id });
          toast({ tone: 'success', title: 'Step deleted', body: 'The remaining steps have been resequenced.' });
          setDeleting(null);
        }}
        title={`Delete step ${deleting?.step ?? ''}?`}
        confirmLabel="Delete step"
        whatIsLost={
          <ul className="list-inside list-disc space-y-1">
            <li>{deleting?.action}</li>
            <li>Its dates, status, submission record and notes</li>
            {docs.some((d) => d.stepId === deleting?.id) ? (
              <li>The link between this step and {docs.filter((d) => d.stepId === deleting?.id).length} document(s). The files stay in the Documents tab.</li>
            ) : null}
          </ul>
        }
      />

      <UploadDialog open={!!upload} onClose={() => setUpload(null)} target={upload} />

      <StepEditor
        step={editing}
        docs={docs}
        people={state.people}
        onClose={() => setEditing(null)}
        onPatch={(p) => editing && patch(editing.id, p)}
        onStatus={(v) => editing && requestStatus(editing, v)}
        onSubmission={(v) => editing && requestSubmission(editing, v)}
        onAck={(v) => editing && requestAck(editing, v)}
        onUpload={() => editing && setUpload({
          projectId: data.project.id, stepId: editing.id,
          defaultName: editing.deliverable || editing.action, defaultType: 'Evidence',
        })}
      />
    </>
  );
}

const COLUMN_WIDTHS = [
  56, 160, 76, 280, 200, 165, 165, 125, 125, 60, 130, 150, 84, 175, 130, 115, 82, 185, 230,
];

/* ------------------------------------------------------------------ */

function FilterSelect({
  label, value, options, onChange, allLabel,
}: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; allLabel: string }) {
  return (
    <div>
      <label className="sr-only" htmlFor={`f-${label}`}>{label}</label>
      <select
        id={`f-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'h-9 cursor-pointer rounded-lg border bg-surface px-2.5 text-[13px] font-medium hover:border-[#CFD8E1]',
          value ? 'border-cyan-600 text-indigo' : 'border-line text-ink-muted',
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function BulkSelect({ label, options, onPick }: { label: string; options: readonly string[]; onPick: (v: string) => void }) {
  return (
    <div>
      <label className="sr-only" htmlFor={`b-${label}`}>{label}</label>
      <select
        id={`b-${label}`}
        value=""
        onChange={(e) => { if (e.target.value) onPick(e.target.value); e.target.value = ''; }}
        className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-[13px] font-semibold text-indigo hover:border-[#CFD8E1]"
      >
        <option value="">{label}…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface RowProps {
  step: DeliveryStep;
  refNo: number;
  docs: DocumentRecord[];
  people: Person[];
  selected: boolean;
  onSelect: (v: boolean) => void;
  onPatch: (p: Partial<DeliveryStep>) => void;
  onStatus: (v: string) => void;
  onSubmission: (v: string) => void;
  onAck: (v: string) => void;
  onUpload: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onInsert: (where: 'above' | 'below') => void;
  onMove: (d: -1 | 1) => void;
  canEdit: boolean;
  onDragStart: () => void;
  onDropOn: () => void;
}

function StepRow(props: RowProps) {
  const {
    step: s, refNo, docs, people, selected, onSelect, onPatch, onStatus, onSubmission, onAck,
    onUpload, onDelete, onDuplicate, onInsert, onMove, canEdit, onDragStart, onDropOn,
  } = props;

  const flag = stepFlag(s);
  const late = daysLate(s);
  const files = docs.filter((d) => d.stepId === s.id);
  const [over, setOver] = useState(false);

  const cell = 'px-2.5 py-2 align-top';

  return (
    <tr
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDropOn(); }}
      className={cx(
        'border-b border-line/70 last:border-b-0',
        selected ? 'bg-cyan-50/70' : 'hover:bg-canvas/70',
        over && 'border-t-2 border-t-cyan-600',
        flag === 'Overdue' && !selected && 'bg-danger-bg/25',
        flag === 'Blocked' && !selected && 'bg-danger-bg/25',
      )}
    >
      <td className="px-2 py-2.5 align-top">
        <Checkbox checked={selected} onChange={onSelect} label={`Select step ${s.step}`} />
      </td>
      <td className="px-1 py-2.5 align-top">
        <span
          draggable={canEdit}
          onDragStart={onDragStart}
          className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-ink-faint hover:bg-canvas hover:text-indigo active:cursor-grabbing"
          title="Drag to reorder within this phase"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} />
        </span>
      </td>

      {/* Ref — automatic, never typed */}
      <td className={cx(cell, 'text-center')}>
        <CalcCell title="Automatic. Renumbers when a row is inserted or reordered.">
          <span className="font-semibold text-indigo">{refNo}</span>
        </CalcCell>
      </td>
      <td className={cell}>
        <SelectCell label={`Phase for step ${s.step}`} value={s.phase} options={PHASES} onCommit={(v) => onPatch({ phase: v })} />
      </td>
      <td className={cell}>
        <TextCell label={`Step number, row ${refNo}`} value={s.step} onCommit={(v) => onPatch({ step: v })} placeholder="—" mono />
      </td>
      <td className={cell}>
        <TextCell label={`Action for step ${s.step}`} value={s.action} onCommit={(v) => onPatch({ action: v })} multiline placeholder="Describe the action" />
      </td>
      <td className={cell}>
        <TextCell label={`Deliverable for step ${s.step}`} value={s.deliverable} onCommit={(v) => onPatch({ deliverable: v })} multiline rows={2} placeholder="What this produces" />
      </td>

      {/* Responsible party — role, and a named person */}
      <td className={cell}>
        <SelectCell
          label={`Responsible party for step ${s.step}`}
          value={s.responsible}
          options={RESPONSIBLE}
          placeholder="Not assigned"
          onCommit={(v) => onPatch({ responsible: v as Responsible })}
        />
        <div className="mt-1">
          <SelectCell
            label={`Assigned person for step ${s.step}`}
            value={people.find((p) => p.id === s.assigneeId)?.name ?? ''}
            options={people.map((p) => p.name)}
            placeholder="No named person"
            onCommit={(v) => onPatch({ assigneeId: people.find((p) => p.name === v)?.id ?? null })}
            render={(v) => <span className="text-[12px] text-ink-muted">{v || 'No named person'}</span>}
          />
        </div>
      </td>

      {/* Evidence / location */}
      <td className={cell}>
        <EvidenceCell files={files} link={s.evidenceLink} onUpload={onUpload} onLink={(v) => onPatch({ evidenceLink: v })} stepLabel={s.step} />
      </td>

      <td className={cell}>
        <DateCell
          label={`Planned start for step ${s.step}`}
          value={s.plannedStart}
          max={s.plannedEnd || undefined}
          onCommit={(v) => onPatch({ plannedStart: v })}
          render={(v) => <span className="whitespace-nowrap text-[13px] tabular-nums">{v ? formatDate(v) : '—'}</span>}
          validate={(v) => (v && s.plannedEnd && v > s.plannedEnd ? 'Planned start cannot be after planned end.' : null)}
        />
      </td>
      <td className={cell}>
        <DateCell
          label={`Planned end for step ${s.step}`}
          value={s.plannedEnd}
          min={s.plannedStart || undefined}
          onCommit={(v) => onPatch({ plannedEnd: v })}
          render={(v) => <span className="whitespace-nowrap text-[13px] tabular-nums">{v ? formatDate(v) : '—'}</span>}
          validate={(v) => (v && s.plannedStart && v < s.plannedStart ? 'Planned end must be on or after the planned start.' : (v && !isValidISO(v) ? 'Enter a valid date.' : null))}
        />
      </td>
      <td className={cx(cell, 'text-center')}>
        <CalcCell title="Planned end less planned start, inclusive.">{stepDays(s) ?? '—'}</CalcCell>
      </td>
      <td className={cell}>
        <DateCell
          label={`Actual completion for step ${s.step}`}
          value={s.actualCompletion}
          onCommit={(v) => onPatch({ actualCompletion: v })}
          render={(v) => <span className="whitespace-nowrap text-[13px] tabular-nums">{v ? formatDate(v) : '—'}</span>}
        />
      </td>

      <td className={cell}>
        <SelectCell
          label={`Status of step ${s.step}`}
          value={s.status}
          options={STATUS}
          placeholder=""
          confirmValues={STATUS}
          onConfirmNeeded={onStatus}
          onCommit={() => undefined}
          render={(v) => <StatusPill status={v as DeliveryStep['status']} size="sm" />}
        />
      </td>
      <td className={cx(cell, 'text-center')}>
        <PercentCell label={`Percent complete for step ${s.step}`} value={s.percentComplete} onCommit={(v) => onPatch({ percentComplete: v })} />
      </td>

      <td className={cell}>
        <SelectCell
          label={`Submission to client for step ${s.step}`}
          value={s.submission}
          options={SUBMISSION_STATUS}
          placeholder=""
          confirmValues={SUBMISSION_STATUS}
          onConfirmNeeded={onSubmission}
          onCommit={() => undefined}
          render={(v) => <SubmissionPill status={v} size="sm" />}
        />
      </td>
      <td className={cell}>
        <DateCell
          label={`Date submitted for step ${s.step}`}
          value={s.dateSubmitted}
          onCommit={(v) => onPatch({ dateSubmitted: v })}
          render={(v) => <span className="whitespace-nowrap text-[13px] tabular-nums">{v ? formatDate(v) : '—'}</span>}
        />
      </td>
      <td className={cell}>
        <SelectCell
          label={`Acknowledged for step ${s.step}`}
          value={s.acknowledged}
          options={YES_NO}
          placeholder=""
          confirmValues={YES_NO}
          onConfirmNeeded={onAck}
          onCommit={() => undefined}
          render={(v) => <AcknowledgedPill value={v as DeliveryStep['acknowledged']} />}
        />
      </td>

      <td className={cx(cell, 'text-center')}>
        <CalcCell title="Completed: planned end to actual completion, never below zero. Otherwise days since a planned end that has passed.">
          <span className={late > 0 ? 'font-semibold text-danger' : ''}>{late}</span>
        </CalcCell>
      </td>
      <td className={cell}>
        <FlagPill flag={flag} size="sm" />
      </td>
      <td className={cell}>
        <TextCell label={`Blockers or notes for step ${s.step}`} value={s.notes} onCommit={(v) => onPatch({ notes: v })} multiline rows={2} placeholder="—" />
      </td>

      <td className="px-2 py-2 align-top">
        {canEdit ? <RowMenu
          stepLabel={s.step}
          onInsertAbove={() => onInsert('above')}
          onInsertBelow={() => onInsert('below')}
          onDuplicate={onDuplicate}
          onMoveUp={() => onMove(-1)}
          onMoveDown={() => onMove(1)}
          onDelete={onDelete}
        /> : null}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */

function EvidenceCell({
  files, link, onUpload, onLink, stepLabel,
}: {
  files: Array<{ id: string; name: string; versions: Array<{ fileName: string }> }>;
  link: string; onUpload: () => void; onLink: (v: string) => void; stepLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.slice(0, 2).map((f) => (
            <li key={f.id} className="flex items-start gap-1.5">
              <Paperclip className="mt-0.5 h-3 w-3 shrink-0 text-success" strokeWidth={2} aria-hidden />
              <span className="min-w-0 break-words text-[12px] leading-snug text-ink">
                {f.versions[f.versions.length - 1]?.fileName ?? f.name}
              </span>
            </li>
          ))}
          {files.length > 2 ? <li className="text-[11.5px] text-ink-muted">+{files.length - 2} more</li> : null}
        </ul>
      ) : (
        <p className="text-[12px] text-ink-faint">No file attached</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex items-center gap-1 rounded text-[12px] font-semibold text-cyan-link hover:underline"
        >
          <FileUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          {files.length ? 'Add file' : 'Upload'}
        </button>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-cyan-link hover:underline"
          >
            Link <ExternalLink className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          </a>
        ) : null}
      </div>
      <TextCell
        label={`Evidence link for step ${stepLabel}`}
        value={link}
        onCommit={onLink}
        placeholder="Add a link"
        className="text-[12px]"
      />
    </div>
  );
}

function RowMenu({
  stepLabel, onInsertAbove, onInsertBelow, onDuplicate, onMoveUp, onMoveDown, onDelete,
}: {
  stepLabel: string;
  onInsertAbove: () => void; onInsertBelow: () => void; onDuplicate: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: 'Insert a step above', icon: CornerDownLeft, run: onInsertAbove },
    { label: 'Insert a step below', icon: CornerDownRight, run: onInsertBelow },
    { label: 'Duplicate this step', icon: Copy, run: onDuplicate },
    { label: 'Move up', icon: ArrowUp, run: onMoveUp },
    { label: 'Move down', icon: ArrowDown, run: onMoveDown },
  ];
  return (
    <div className="relative">
      <IconButton
        label={`Actions for step ${stepLabel}`}
        icon={MoreVertical}
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      />
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 top-8 z-40 w-56 rounded-card border border-line bg-surface p-1.5 shadow-pop animate-scale-in">
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); it.run(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-canvas"
              >
                <it.icon className="h-4 w-4 text-ink-muted" strokeWidth={2} aria-hidden />
                {it.label}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-danger transition-colors hover:bg-danger-bg"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              Delete this step
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StepCard({
  step: s, refNo, hasEvidence, selected, onSelect, onEdit, onUpload,
}: {
  step: DeliveryStep; refNo: number; hasEvidence: boolean; selected: boolean;
  onSelect: (v: boolean) => void; onEdit: () => void; onUpload: () => void;
}) {
  const flag = stepFlag(s);
  const late = daysLate(s);
  return (
    <div className={cx('rounded-xl border p-4', selected ? 'border-cyan-600 bg-cyan-50/60' : 'border-line bg-surface')}>
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onChange={onSelect} label={`Select step ${s.step}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-[11px] font-bold text-ink-faint tabular-nums">#{refNo}</span>
            <span className="shrink-0 text-[13px] font-bold text-indigo tabular-nums">{s.step}</span>
          </div>
          <p className="mt-1 text-[13px] font-medium leading-snug text-ink">{s.action || <span className="text-ink-faint">No action recorded</span>}</p>
          {s.deliverable ? <p className="mt-1 text-[12.5px] text-ink-muted">{s.deliverable}</p> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <FlagPill flag={flag} size="sm" />
        <StatusPill status={s.status} size="sm" />
        <SubmissionPill status={s.submission} size="sm" />
        {late > 0 ? <Pill tone="danger" size="sm">{late} days late</Pill> : null}
        {hasEvidence ? <Pill tone="success" size="sm" icon={Paperclip}>Evidence</Pill> : null}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-3">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Responsible</dt>
          <dd className="mt-0.5 text-[12.5px]">{s.responsible || '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">% complete</dt>
          <dd className="mt-0.5 text-[12.5px] tabular-nums">{s.percentComplete}%</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Planned start</dt>
          <dd className="mt-0.5 text-[12.5px] tabular-nums">{formatDate(s.plannedStart)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Planned end</dt>
          <dd className="mt-0.5 text-[12.5px] tabular-nums">{formatDate(s.plannedEnd)}</dd>
        </div>
      </dl>

      {s.notes ? (
        <p className="mt-3 rounded-lg bg-canvas p-2.5 text-[12.5px] leading-relaxed text-ink-muted">{s.notes}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button size="sm" icon={Pencil} onClick={onEdit} className="flex-1">Edit step</Button>
        <Button size="sm" icon={FileUp} onClick={onUpload}>Evidence</Button>
      </div>
    </div>
  );
}
