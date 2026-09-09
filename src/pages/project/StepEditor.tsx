import { useEffect, useState } from 'react';
import { FileUp, Paperclip, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button, InlineMessage, Pill } from '@/components/ui/primitives';
import { DateInput, Field, Select, TextArea, TextInput } from '@/components/ui/form';
import { FlagPill } from '@/components/ui/StatusPills';
import { PHASES, RESPONSIBLE, STATUS, SUBMISSION_STATUS, YES_NO } from '@/data/reference';
import type { DeliveryStep, DocumentRecord, Person, Responsible } from '@/types';
import { daysLate, stepDays, stepFlag } from '@/lib/derive';

/**
 * The phone's editor. Everything the desktop grid exposes across nineteen
 * columns, in one scrollable sheet — so a phone never has to scroll a table
 * sideways to reach the status column.
 */
export function StepEditor({
  step, docs, people, onClose, onPatch, onStatus, onSubmission, onAck, onUpload,
}: {
  step: DeliveryStep | null;
  docs: DocumentRecord[];
  people: Person[];
  onClose: () => void;
  onPatch: (p: Partial<DeliveryStep>) => void;
  onStatus: (v: string) => void;
  onSubmission: (v: string) => void;
  onAck: (v: string) => void;
  onUpload: () => void;
}) {
  const [draft, setDraft] = useState<DeliveryStep | null>(step);
  useEffect(() => setDraft(step), [step]);

  if (!step || !draft) return null;

  const set = <K extends keyof DeliveryStep>(k: K, v: DeliveryStep[K]) => setDraft({ ...draft, [k]: v });
  const files = docs.filter((d) => d.stepId === step.id);

  const dateError =
    draft.plannedStart && draft.plannedEnd && draft.plannedEnd < draft.plannedStart
      ? 'Planned end must be on or after the planned start.'
      : undefined;

  const dirty = JSON.stringify(draft) !== JSON.stringify(step);
  const canSave = dirty && !dateError;

  const save = () => {
    onPatch({
      phase: draft.phase, step: draft.step, action: draft.action, deliverable: draft.deliverable,
      responsible: draft.responsible as Responsible, assigneeId: draft.assigneeId,
      evidenceLink: draft.evidenceLink,
      plannedStart: draft.plannedStart, plannedEnd: draft.plannedEnd,
      actualCompletion: draft.actualCompletion,
      percentComplete: draft.percentComplete,
      dateSubmitted: draft.dateSubmitted, notes: draft.notes,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Step ${step.step}`}
      description={step.phase}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Save} onClick={save} disabled={!canSave}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas p-3">
          <FlagPill flag={stepFlag(step)} size="sm" />
          <Pill tone="neutral" size="sm">{stepDays(step) ?? '—'} days planned</Pill>
          <Pill tone={daysLate(step) > 0 ? 'danger' : 'neutral'} size="sm">{daysLate(step)} days late</Pill>
        </div>

        <Field label="Phase" htmlFor="e-phase">
          <Select id="e-phase" options={PHASES} value={draft.phase} onChange={(e) => set('phase', e.target.value)} />
        </Field>
        <Field label="Step" htmlFor="e-step">
          <TextInput id="e-step" value={draft.step} onChange={(e) => set('step', e.target.value)} />
        </Field>
        <Field label="Action" htmlFor="e-action">
          <TextArea id="e-action" rows={3} value={draft.action} onChange={(e) => set('action', e.target.value)} />
        </Field>
        <Field label="Deliverable" htmlFor="e-deliv">
          <TextArea id="e-deliv" rows={2} value={draft.deliverable} onChange={(e) => set('deliverable', e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsible party" htmlFor="e-resp">
            <Select id="e-resp" options={RESPONSIBLE} placeholder="Not assigned" value={draft.responsible} onChange={(e) => set('responsible', e.target.value as Responsible)} />
          </Field>
          <Field label="Assigned to" htmlFor="e-assignee">
            <Select
              id="e-assignee"
              options={people.map((p) => p.name)}
              placeholder="No named person"
              value={people.find((p) => p.id === draft.assigneeId)?.name ?? ''}
              onChange={(e) => set('assigneeId', people.find((p) => p.name === e.target.value)?.id ?? null)}
            />
          </Field>
        </div>

        {/* Evidence */}
        <Field label="Evidence / location" hint="A file, a link, or both. A step with a submission cannot be completed without a file.">
          <div className="rounded-lg border border-line bg-canvas p-3">
            {files.length > 0 ? (
              <ul className="mb-2.5 space-y-1.5">
                {files.map((f) => (
                  <li key={f.id} className="flex items-start gap-2">
                    <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 break-words text-[12.5px] text-ink">
                      {f.versions[f.versions.length - 1]?.fileName ?? f.name}
                      <span className="ml-1.5 text-ink-faint">v{f.currentVersion}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-2.5 text-[12.5px] text-ink-muted">No file attached.</p>
            )}
            <Button size="sm" icon={FileUp} onClick={onUpload}>Upload a file</Button>
          </div>
        </Field>
        <Field label="Evidence link" htmlFor="e-link">
          <TextInput id="e-link" value={draft.evidenceLink} onChange={(e) => set('evidenceLink', e.target.value)} placeholder="https://…" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Planned start" htmlFor="e-ps">
            <DateInput id="e-ps" value={draft.plannedStart} max={draft.plannedEnd || undefined} onChange={(e) => set('plannedStart', e.target.value)} />
          </Field>
          <Field label="Planned end" htmlFor="e-pe" error={dateError}>
            <DateInput id="e-pe" value={draft.plannedEnd} min={draft.plannedStart || undefined} invalid={!!dateError} onChange={(e) => set('plannedEnd', e.target.value)} />
          </Field>
          <Field label="Actual completion" htmlFor="e-ac">
            <DateInput id="e-ac" value={draft.actualCompletion} onChange={(e) => set('actualCompletion', e.target.value)} />
          </Field>
          <Field label="% complete" htmlFor="e-pct">
            <TextInput
              id="e-pct" type="number" min={0} max={100} step={5}
              value={String(draft.percentComplete)}
              onChange={(e) => set('percentComplete', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
          </Field>
        </div>

        {/* Status, submission and acknowledgement change through their own confirmations. */}
        <div className="space-y-4 rounded-lg border border-line p-3.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Status and submission</p>
          <InlineMessage tone="neutral">
            These three are confirmed separately — they change what the flag says and what the dashboards report.
          </InlineMessage>
          <Field label="Status" htmlFor="e-status">
            <Select id="e-status" options={STATUS} value={step.status} onChange={(e) => onStatus(e.target.value)} />
          </Field>
          <Field label="Submission to client" htmlFor="e-sub">
            <Select id="e-sub" options={SUBMISSION_STATUS} value={step.submission} onChange={(e) => onSubmission(e.target.value)} />
          </Field>
          <Field label="Acknowledged" htmlFor="e-ack">
            <Select id="e-ack" options={YES_NO} value={step.acknowledged} onChange={(e) => onAck(e.target.value)} />
          </Field>
        </div>

        <Field label="Date submitted" htmlFor="e-ds">
          <DateInput id="e-ds" value={draft.dateSubmitted} onChange={(e) => set('dateSubmitted', e.target.value)} />
        </Field>
        <Field label="Blockers / notes" htmlFor="e-notes">
          <TextArea id="e-notes" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
