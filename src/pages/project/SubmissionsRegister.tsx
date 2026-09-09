import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle, Download, FileUp, Paperclip, Plus, Search, Send, Trash2, X,
} from 'lucide-react';
import { useApp, useProject } from '@/store/AppStore';
import {
  Button, Card, CardBody, Chevron, cx, EmptyState, IconButton, InlineMessage, Pill, ProgressBar,
} from '@/components/ui/primitives';
import { ConfirmDialog, DeleteDialog } from '@/components/ui/Modal';
import { DateCell, SelectCell, TextCell } from '@/components/ui/EditableCell';
import { RegisterStatusPill } from '@/components/ui/StatusPills';
import { UploadDialog, type UploadTarget } from '@/components/documents/Upload';
import { PHASES, REGISTER_STATUS, RESPONSIBLE } from '@/data/reference';
import type { RegisterEntry, RegisterStatus } from '@/types';
import { canSubmitRegisterEntry } from '@/lib/derive';
import { formatDate, today } from '@/lib/dates';
import { downloadWorkbook, safeFileName } from '@/lib/export';

const COLUMNS = [
  'No.', 'Phase', 'Submission', 'Template used', 'Signed by', 'Owner',
  'Planned date', 'Date submitted', 'Acknowledged on', 'Status', 'Evidence file', 'Notes',
] as const;

const WIDTHS = [56, 78, 250, 200, 165, 150, 125, 130, 135, 175, 175, 220];

interface Pending {
  entryId: string;
  value: RegisterStatus;
  blockedReason?: string;
  title: string;
  description: string;
  consequence?: string;
}

export default function SubmissionsRegister() {
  const { projectId } = useParams();
  const { dispatch, toast } = useApp();
  const data = useProject(projectId);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [upload, setUpload] = useState<UploadTarget | null>(null);
  const [deleting, setDeleting] = useState<RegisterEntry | null>(null);

  const entries = data?.entries ?? [];
  const docs = data?.documents ?? [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (term && !`${e.submission} ${e.template} ${e.owner}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [entries, q, statusFilter]);

  const groups = useMemo(() => {
    const phaseNumbers = [...new Set(entries.map((e) => e.phase))]
      .sort((a, b) => Number(a) - Number(b));
    return phaseNumbers
      .map((phase) => ({
        phase,
        name: PHASES.find((p) => p.startsWith(`${phase} `)) ?? `Phase ${phase}`,
        rows: filtered.filter((e) => e.phase === phase),
        all: entries.filter((e) => e.phase === phase),
      }))
      .filter((g) => g.rows.length > 0);
  }, [entries, filtered]);

  if (!data) return null;

  const fileFor = (e: RegisterEntry) => docs.filter((d) => d.registerEntryId === e.id);

  const requestStatus = (entry: RegisterEntry, value: RegisterStatus) => {
    if (value === 'Submitted') {
      const gate = canSubmitRegisterEntry(entry, docs);
      if (!gate.allowed) {
        setPending({
          entryId: entry.id, value,
          blockedReason: gate.reason,
          title: 'This submission cannot be marked Submitted',
          description: entry.submission,
        });
        return;
      }
    }
    if (value === 'Acknowledged' && !entry.acknowledgedOn) {
      setPending({
        entryId: entry.id, value,
        blockedReason: 'Record the date the client acknowledged this before marking it Acknowledged. Without the date there is nothing to point at when the department asks.',
        title: 'This submission cannot be marked Acknowledged yet',
        description: entry.submission,
      });
      return;
    }
    setPending({
      entryId: entry.id, value,
      title: `Set “${entry.submission}” to ${value}?`,
      description: `Phase ${entry.phase} · ${entry.template}`,
      consequence: value === 'Acknowledged'
        ? 'This is what makes the phase complete. It will count towards the acknowledged percentage on both dashboards.'
        : value === 'Returned for correction'
          ? 'This appears on the attention list on both dashboards until it is resubmitted and acknowledged.'
          : undefined,
    });
  };

  const applyPending = () => {
    if (!pending || pending.blockedReason) return;
    const entry = entries.find((e) => e.id === pending.entryId);
    if (!entry) return;
    const patch: Partial<RegisterEntry> = { status: pending.value };
    if (pending.value === 'Submitted' && !entry.dateSubmitted) patch.dateSubmitted = today();
    dispatch({ type: 'register/update', id: entry.id, patch });
    setPending(null);
    toast({ tone: 'success', title: `${entry.submission} is now ${pending.value}` });
  };

  const exportRegister = () => {
    downloadWorkbook([{
      name: 'Submissions Register',
      headers: [...COLUMNS],
      widths: [6, 8, 34, 28, 22, 20, 14, 14, 15, 22, 26, 32],
      rows: filtered.map((e, i) => [
        i + 1, e.phase, e.submission, e.template, e.signedBy, e.owner,
        e.plannedDate ? formatDate(e.plannedDate) : '',
        e.dateSubmitted ? formatDate(e.dateSubmitted) : '',
        e.acknowledgedOn ? formatDate(e.acknowledgedOn) : '',
        e.status,
        fileFor(e).map((d) => d.versions[d.versions.length - 1]?.fileName ?? d.name).join('; '),
        e.notes,
      ]),
    }], `${safeFileName(data.project.name)}-submissions-register`);
    toast({ tone: 'success', title: 'Submissions register exported', body: `${filtered.length} entries.` });
  };

  const patch = (id: string, p: Partial<RegisterEntry>) => dispatch({ type: 'register/update', id, patch: p });

  return (
    <>
      <Card className="mb-5">
        <CardBody className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="reg-q" className="sr-only">Search submissions</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={2} aria-hidden />
            <input
              id="reg-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search submission, template or owner"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm placeholder:text-ink-faint hover:border-[#CFD8E1]"
            />
            {q ? (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-indigo">
                <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="reg-status">Filter by status</label>
            <select
              id="reg-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cx('h-10 cursor-pointer rounded-lg border bg-surface px-2.5 text-[13px] font-medium hover:border-[#CFD8E1]',
                statusFilter ? 'border-cyan-600 text-indigo' : 'border-line text-ink-muted')}
            >
              <option value="">All statuses</option>
              {REGISTER_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button icon={Download} onClick={exportRegister}>Export to Excel</Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => dispatch({ type: 'register/insert', projectId: data.project.id, phase: PHASES[0] })}
            >
              Add entry
            </Button>
          </div>
        </CardBody>
      </Card>

      <InlineMessage tone="neutral" className="mb-5" icon={Send}>
        <span className="font-semibold text-indigo">A submission cannot be marked Submitted without a file attached,</span>{' '}
        and marking one Acknowledged needs the date the client acknowledged it. This register is the evidence trail for the whole contract.
      </InlineMessage>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Send}
            title={entries.length === 0 ? 'This register is empty' : 'No entry matches those filters'}
            body={entries.length === 0
              ? 'A project created through the wizard arrives with 22 register entries from the standard template. Add the first entry to build this register by hand.'
              : 'Clear the search or the status filter to see the rest of the register.'}
            action={entries.length === 0
              ? <Button icon={Plus} onClick={() => dispatch({ type: 'register/insert', projectId: data.project.id, phase: PHASES[0] })}>Add the first entry</Button>
              : <Button onClick={() => { setQ(''); setStatusFilter(''); }}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.phase);
            const countable = g.all.filter((e) => e.status !== 'Not applicable');
            const ack = countable.filter((e) => e.status === 'Acknowledged').length;
            const pctDone = countable.length ? Math.round((ack / countable.length) * 100) : 0;

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
                    <h2 className="text-[15px] font-semibold text-indigo">{g.name}</h2>
                    <Pill tone={pctDone === 100 ? 'success' : 'neutral'} size="sm">
                      {ack}/{countable.length} acknowledged
                    </Pill>
                  </button>
                  <div className="flex items-center gap-3 sm:w-64">
                    <ProgressBar value={pctDone} tone={pctDone === 100 ? 'success' : 'brand'} label={`${g.name}: ${pctDone}% acknowledged`} />
                    <span className="w-9 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-indigo">{pctDone}%</span>
                  </div>
                </div>

                {!isCollapsed ? (
                  <>
                    <div className="rw-scroll hidden overflow-x-auto border-t border-line md:block">
                      <table className="w-full border-collapse text-sm" style={{ minWidth: 1780 }}>
                        <caption className="sr-only">{g.name} submissions</caption>
                        <thead>
                          <tr className="border-b border-line bg-canvas/60">
                            {COLUMNS.map((c, i) => (
                              <th key={c} scope="col" style={{ width: WIDTHS[i] }} className="px-2.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                                {c}
                              </th>
                            ))}
                            <th scope="col" className="w-10 px-2 py-2.5"><span className="sr-only">Actions</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((e) => {
                            const no = entries.indexOf(e) + 1;
                            const files = fileFor(e);
                            const cell = 'px-2.5 py-2 align-top';
                            return (
                              <tr
                                key={e.id}
                                className={cx(
                                  'border-b border-line/70 last:border-b-0 hover:bg-canvas/70',
                                  e.status === 'Returned for correction' && 'bg-danger-bg/25',
                                )}
                              >
                                <td className={cx(cell, 'text-center')}>
                                  <span className="text-[13px] font-semibold tabular-nums text-indigo">{no}</span>
                                </td>
                                <td className={cx(cell, 'text-center')}>
                                  <span className="text-[13px] tabular-nums">{e.phase}</span>
                                </td>
                                <td className={cell}>
                                  <TextCell label={`Submission ${no}`} value={e.submission} onCommit={(v) => patch(e.id, { submission: v })} multiline rows={2} />
                                </td>
                                <td className={cell}>
                                  <TextCell label={`Template used for submission ${no}`} value={e.template} onCommit={(v) => patch(e.id, { template: v })} multiline rows={2} />
                                </td>
                                <td className={cell}>
                                  <TextCell label={`Signed by for submission ${no}`} value={e.signedBy} onCommit={(v) => patch(e.id, { signedBy: v })} />
                                </td>
                                <td className={cell}>
                                  <SelectCell label={`Owner of submission ${no}`} value={e.owner} options={RESPONSIBLE} placeholder="Not assigned" onCommit={(v) => patch(e.id, { owner: v })} />
                                </td>
                                <td className={cell}>
                                  <DateCell
                                    label={`Planned date for submission ${no}`}
                                    value={e.plannedDate}
                                    onCommit={(v) => patch(e.id, { plannedDate: v })}
                                    render={(v) => <span className="whitespace-nowrap text-[13px] tabular-nums">{v ? formatDate(v) : '—'}</span>}
                                  />
                                </td>
                                <td className={cell}>
                                  <DateCell
                                    label={`Date submitted for submission ${no}`}
                                    value={e.dateSubmitted}
                                    onCommit={(v) => patch(e.id, { dateSubmitted: v })}
                                    render={(v) => <span className="whitespace-nowrap text-[13px] tabular-nums">{v ? formatDate(v) : '—'}</span>}
                                  />
                                </td>
                                <td className={cell}>
                                  <DateCell
                                    label={`Acknowledged on for submission ${no}`}
                                    value={e.acknowledgedOn}
                                    min={e.dateSubmitted || undefined}
                                    onCommit={(v) => patch(e.id, { acknowledgedOn: v })}
                                    validate={(v) => (v && e.dateSubmitted && v < e.dateSubmitted ? 'The client cannot acknowledge before it was submitted.' : null)}
                                    render={(v) => <span className="whitespace-nowrap text-[13px] tabular-nums">{v ? formatDate(v) : '—'}</span>}
                                  />
                                </td>
                                <td className={cell}>
                                  <SelectCell
                                    label={`Status of submission ${no}`}
                                    value={e.status}
                                    options={REGISTER_STATUS}
                                    placeholder=""
                                    confirmValues={REGISTER_STATUS}
                                    onConfirmNeeded={(v) => requestStatus(e, v as RegisterStatus)}
                                    onCommit={() => undefined}
                                    render={(v) => <RegisterStatusPill status={v as RegisterStatus} size="sm" />}
                                  />
                                </td>
                                <td className={cell}>
                                  {files.length > 0 ? (
                                    <ul className="mb-1 space-y-1">
                                      {files.map((f) => (
                                        <li key={f.id} className="flex items-start gap-1.5">
                                          <Paperclip className="mt-0.5 h-3 w-3 shrink-0 text-success" strokeWidth={2} aria-hidden />
                                          <span className="min-w-0 break-words text-[12px] leading-snug">
                                            {f.versions[f.versions.length - 1]?.fileName ?? f.name}
                                            {f.currentVersion > 1 ? <span className="ml-1 text-ink-faint">v{f.currentVersion}</span> : null}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="mb-1 text-[12px] text-danger">No file attached</p>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setUpload({
                                      projectId: data.project.id, registerEntryId: e.id,
                                      defaultName: e.submission, defaultType: 'Submission',
                                    })}
                                    className="inline-flex items-center gap-1 rounded text-[12px] font-semibold text-cyan-link hover:underline"
                                  >
                                    <FileUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                                    {files.length ? 'Add file' : 'Upload'}
                                  </button>
                                </td>
                                <td className={cell}>
                                  <TextCell label={`Notes for submission ${no}`} value={e.notes} onCommit={(v) => patch(e.id, { notes: v })} multiline rows={2} placeholder="—" />
                                </td>
                                <td className="px-2 py-2 align-top">
                                  <IconButton label={`Delete submission ${no}`} icon={Trash2} size="sm" onClick={() => setDeleting(e)} className="hover:bg-danger-bg hover:text-danger" />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <ul className="space-y-3 border-t border-line p-4 md:hidden">
                      {g.rows.map((e) => {
                        const no = entries.indexOf(e) + 1;
                        const files = fileFor(e);
                        return (
                          <li key={e.id} className={cx('rounded-xl border p-4', e.status === 'Returned for correction' ? 'border-danger/30 bg-danger-bg/30' : 'border-line bg-surface')}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className="text-[11px] font-bold tabular-nums text-ink-faint">#{no} · Phase {e.phase}</span>
                                <h3 className="mt-0.5 text-[13.5px] font-semibold leading-snug text-indigo">{e.submission}</h3>
                                <p className="mt-1 text-[12.5px] text-ink-muted">{e.template}</p>
                              </div>
                              <RegisterStatusPill status={e.status} size="sm" />
                            </div>

                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-3">
                              <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Owner</dt>
                                <dd className="mt-0.5 text-[12.5px]">{e.owner || '—'}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Signed by</dt>
                                <dd className="mt-0.5 text-[12.5px]">{e.signedBy || '—'}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Planned</dt>
                                <dd className="mt-0.5 text-[12.5px] tabular-nums">{formatDate(e.plannedDate)}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Submitted</dt>
                                <dd className="mt-0.5 text-[12.5px] tabular-nums">{formatDate(e.dateSubmitted)}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Acknowledged on</dt>
                                <dd className="mt-0.5 text-[12.5px] tabular-nums">{formatDate(e.acknowledgedOn)}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Evidence file</dt>
                                <dd className={cx('mt-0.5 text-[12.5px]', files.length ? '' : 'text-danger')}>
                                  {files.length ? `${files.length} attached` : 'None'}
                                </dd>
                              </div>
                            </dl>

                            {e.notes ? <p className="mt-3 rounded-lg bg-canvas p-2.5 text-[12.5px] leading-relaxed text-ink-muted">{e.notes}</p> : null}

                            <div className="mt-3 flex flex-wrap gap-2">
                              <label className="sr-only" htmlFor={`m-status-${e.id}`}>Status of {e.submission}</label>
                              <select
                                id={`m-status-${e.id}`}
                                value={e.status}
                                onChange={(ev) => requestStatus(e, ev.target.value as RegisterStatus)}
                                className="h-8 flex-1 cursor-pointer rounded-lg border border-line bg-surface px-2 text-[13px] font-semibold text-indigo"
                              >
                                {REGISTER_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <Button
                                size="sm"
                                icon={FileUp}
                                onClick={() => setUpload({ projectId: data.project.id, registerEntryId: e.id, defaultName: e.submission, defaultType: 'Submission' })}
                              >
                                File
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={applyPending}
        title={pending?.title ?? ''}
        description={pending?.description}
        confirmLabel={pending?.blockedReason ? 'Close' : 'Apply the change'}
        disabled={!!pending?.blockedReason}
      >
        {pending?.blockedReason ? (
          <>
            <InlineMessage tone="danger" icon={AlertTriangle} title="This is not allowed yet">
              {pending.blockedReason}
            </InlineMessage>
            {pending.value === 'Submitted' ? (
              <div className="mt-3">
                <Button
                  icon={FileUp}
                  onClick={() => {
                    const e = entries.find((x) => x.id === pending.entryId);
                    setPending(null);
                    if (e) setUpload({ projectId: data.project.id, registerEntryId: e.id, defaultName: e.submission, defaultType: 'Submission' });
                  }}
                >
                  Attach the file now
                </Button>
              </div>
            ) : null}
          </>
        ) : pending?.consequence ? (
          <InlineMessage tone="warning" title="What this means">{pending.consequence}</InlineMessage>
        ) : null}
      </ConfirmDialog>

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          dispatch({ type: 'register/delete', id: deleting.id });
          toast({ tone: 'success', title: 'Register entry deleted' });
          setDeleting(null);
        }}
        title={`Delete “${deleting?.submission ?? ''}”?`}
        confirmLabel="Delete entry"
        whatIsLost={
          <ul className="list-inside list-disc space-y-1">
            <li>The register record for this submission, including its dates and status</li>
            {docs.some((d) => d.registerEntryId === deleting?.id) ? (
              <li>Its link to {docs.filter((d) => d.registerEntryId === deleting?.id).length} document(s). The files stay in the Documents tab.</li>
            ) : null}
          </ul>
        }
      />

      <UploadDialog open={!!upload} onClose={() => setUpload(null)} target={upload} />
    </>
  );
}
