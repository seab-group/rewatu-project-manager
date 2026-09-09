import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download, Eye, FileArchive, FileImage, FileSpreadsheet, FileText, FileType2, History,
  LayoutGrid, List, Mail, Paperclip, Plus, Search, Trash2, Upload, X,
} from 'lucide-react';
import { useApp } from '@/store/AppStore';
import {
  Button, Card, CardBody, CardHeader, cx, EmptyState, IconButton, InlineMessage, Pill, SegmentedControl,
} from '@/components/ui/primitives';
import { DeleteDialog, Modal } from '@/components/ui/Modal';
import { UploadDialog, type UploadTarget } from '@/components/documents/Upload';
import { DOC_STATUS, DOC_TYPE } from '@/data/reference';
import type { DocumentRecord } from '@/types';
import { extensionOf, fileKindLabel, formatBytes, isPreviewable } from '@/lib/files';
import { saveFile } from '@/lib/download';
import { formatDate } from '@/lib/dates';
import { submissionRequired } from '@/lib/derive';

const ICONS: Record<string, React.ElementType> = {
  pdf: FileType2, doc: FileText, docx: FileText, xls: FileSpreadsheet, xlsx: FileSpreadsheet,
  csv: FileSpreadsheet, png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, svg: FileImage,
  zip: FileArchive, msg: Mail, eml: Mail,
};

function iconFor(fileName: string) {
  return ICONS[extensionOf(fileName)] ?? FileText;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
  Approved: 'success', 'For review': 'warning', Draft: 'neutral', Superseded: 'neutral',
};

export function DocumentsView({ projectId }: { projectId?: string }) {
  const { state, dispatch, toast } = useApp();
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [q, setQ] = useState('');
  const [project, setProject] = useState(projectId ?? '');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<DocumentRecord | null>(null);
  const [history, setHistory] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState<DocumentRecord | null>(null);
  const [upload, setUpload] = useState<UploadTarget | null>(null);

  const scoped = useMemo(
    () => (projectId ? state.documents.filter((d) => d.projectId === projectId) : state.documents),
    [state.documents, projectId],
  );

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scoped.filter((d) => {
      if (!projectId && project && d.projectId !== project) return false;
      if (type && d.type !== type) return false;
      if (status && d.status !== status) return false;
      const latest = d.versions[d.versions.length - 1];
      const day = latest?.uploadedAt.slice(0, 10) ?? '';
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (term) {
        const hay = `${d.name} ${d.type} ${d.versions.map((v) => v.fileName).join(' ')}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => {
      const av = a.versions[a.versions.length - 1]?.uploadedAt ?? '';
      const bv = b.versions[b.versions.length - 1]?.uploadedAt ?? '';
      return bv.localeCompare(av);
    });
  }, [scoped, q, project, type, status, from, to, projectId]);

  /** Documents held per project, and the steps still missing their evidence. */
  const byProject = useMemo(() => {
    const projects = projectId
      ? state.projects.filter((p) => p.id === projectId)
      : state.projects.filter((p) => !p.archived);
    return projects.map((p) => {
      const docs = state.documents.filter((d) => d.projectId === p.id);
      const missing = state.steps.filter(
        (s) => s.projectId === p.id && s.status === 'Completed' && submissionRequired(s) && !docs.some((d) => d.stepId === s.id),
      ).length;
      return { project: p, count: docs.length, missing };
    });
  }, [state, projectId]);

  const filtersActive = Boolean(q || (!projectId && project) || type || status || from || to);
  const clearFilters = () => { setQ(''); if (!projectId) setProject(''); setType(''); setStatus(''); setFrom(''); setTo(''); };

  const stepFor = (d: DocumentRecord) => state.steps.find((s) => s.id === d.stepId);
  const entryFor = (d: DocumentRecord) => state.registerEntries.find((e) => e.id === d.registerEntryId);
  const invoiceFor = (d: DocumentRecord) => state.invoices.find((i) => i.id === d.invoiceId);
  const projectOf = (d: DocumentRecord) => state.projects.find((p) => p.id === d.projectId);

  const download = async (d: DocumentRecord) => {
    const v = d.versions[d.versions.length - 1];
    if (!v?.objectUrl) {
      toast({
        tone: 'neutral',
        title: 'This is a sample record',
        body: `${v?.fileName ?? d.name} is seeded demo data with no file behind it. Files you upload yourself download normally.`,
      });
      return;
    }
    const blob = await fetch(v.objectUrl).then((r) => r.blob());
    const result = await saveFile(v.fileName, blob);
    if (!result.ok) toast({ tone: 'danger', title: 'Download not saved', body: result.reason });
  };

  return (
    <>
      {/* Documents by project */}
      <Card className="mb-5">
        <CardHeader
          title="Documents by project"
          subtitle="How many files each project holds, and how many completed steps are still missing their evidence."
        />
        <CardBody className="pt-4">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {byProject.map(({ project: p, count, missing }) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}/documents`}
                  className="block rounded-xl border border-line p-3.5 transition-colors hover:border-cyan-600/40 hover:bg-cyan-50/40"
                >
                  <p className="truncate text-[13px] font-semibold text-indigo">{p.name}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[22px] font-bold leading-none tabular-nums text-indigo">{count}</span>
                    <span className="text-[12px] text-ink-muted">document{count === 1 ? '' : 's'}</span>
                  </div>
                  <div className="mt-2.5">
                    {missing > 0
                      ? <Pill tone="danger" size="sm">{missing} step{missing === 1 ? '' : 's'} missing evidence</Pill>
                      : <Pill tone="success" size="sm">Evidence complete</Pill>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Filters */}
      <Card className="mb-5">
        <CardBody className="space-y-3 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="doc-q" className="sr-only">Search documents</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={2} aria-hidden />
              <input
                id="doc-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by document name or file name"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm placeholder:text-ink-faint hover:border-[#CFD8E1]"
              />
              {q ? (
                <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-indigo">
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <SegmentedControl
                label="View"
                value={view}
                onChange={setView}
                options={[{ value: 'list', label: 'List', icon: List }, { value: 'grid', label: 'Grid', icon: LayoutGrid }]}
              />
              {projectId ? (
                <Button variant="primary" icon={Upload} onClick={() => setUpload({ projectId })}>Upload</Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            {!projectId ? (
              <Filter label="Project" value={project} onChange={setProject} allLabel="All projects"
                options={state.projects.map((p) => ({ value: p.id, label: p.name }))} />
            ) : null}
            <Filter label="Type" value={type} onChange={setType} allLabel="All types"
              options={DOC_TYPE.map((t) => ({ value: t, label: t }))} />
            <Filter label="Status" value={status} onChange={setStatus} allLabel="All statuses"
              options={DOC_STATUS.map((s) => ({ value: s, label: s }))} />
            <div>
              <label htmlFor="doc-from" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Uploaded from</label>
              <input id="doc-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-[13px] hover:border-[#CFD8E1]" />
            </div>
            <div>
              <label htmlFor="doc-to" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">to</label>
              <input id="doc-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-[13px] hover:border-[#CFD8E1]" />
            </div>
            {filtersActive ? <Button size="sm" variant="ghost" icon={X} onClick={clearFilters}>Clear filters</Button> : null}
            <span className="ml-auto text-[12.5px] tabular-nums text-ink-muted">{rows.length} of {scoped.length} documents</span>
          </div>
        </CardBody>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={scoped.length === 0 ? 'No documents yet' : 'No document matches those filters'}
            body={scoped.length === 0
              ? 'Every file uploaded against a delivery plan step, a register entry or an invoice appears here, linked both ways. Upload the first one and the step it belongs to will show its evidence.'
              : 'Clear the filters to see everything filed against this project.'}
            action={scoped.length === 0 && projectId
              ? <Button icon={Plus} onClick={() => setUpload({ projectId })}>Upload a document</Button>
              : filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : undefined}
          />
        </Card>
      ) : view === 'grid' ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((d) => {
            const v = d.versions[d.versions.length - 1];
            const Icon = iconFor(v?.fileName ?? '');
            return (
              <li key={d.id}>
                <Card className="flex h-full flex-col p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-link">
                      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-indigo">{d.name}</p>
                      <p className="mt-1 truncate text-[12px] text-ink-muted">{v?.fileName}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Pill tone="neutral" size="sm">{d.type}</Pill>
                    <Pill tone={STATUS_TONE[d.status]} size="sm">{d.status}</Pill>
                    {d.currentVersion > 1 ? <Pill tone="neutral" size="sm">v{d.currentVersion}</Pill> : null}
                  </div>
                  <dl className="mt-3 space-y-1.5 text-[12px]">
                    {!projectId ? (
                      <div className="flex gap-2"><dt className="text-ink-faint">Project</dt><dd className="min-w-0 truncate text-ink">{projectOf(d)?.name}</dd></div>
                    ) : null}
                    <div className="flex gap-2"><dt className="text-ink-faint">Location</dt><dd className="text-ink">{d.storageLocation}</dd></div>
                    <div className="flex gap-2"><dt className="text-ink-faint">Uploaded</dt><dd className="text-ink">{formatDate(v?.uploadedAt.slice(0, 10) ?? '')} by {v?.uploadedBy}</dd></div>
                    <div className="flex gap-2"><dt className="text-ink-faint">Size</dt><dd className="text-ink">{v ? formatBytes(v.fileSize) : '—'}</dd></div>
                  </dl>
                  <LinkedTo doc={d} step={stepFor(d)} entry={entryFor(d)} invoice={invoiceFor(d)} />
                  <div className="mt-auto flex gap-1.5 border-t border-line pt-3">
                    <Actions
                      doc={d}
                      onPreview={() => setPreview(d)}
                      onDownload={() => download(d)}
                      onHistory={() => setHistory(d)}
                      onNewVersion={() => setUpload({ projectId: d.projectId, supersedeDocumentId: d.id })}
                      onDelete={() => setDeleting(d)}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((d) => {
              const v = d.versions[d.versions.length - 1];
              const Icon = iconFor(v?.fileName ?? '');
              return (
                <li key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-link">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold leading-snug text-indigo">{d.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-muted">
                      {v?.fileName} · {v ? formatBytes(v.fileSize) : '—'} · {fileKindLabel(v?.fileName ?? '')}
                      {!projectId ? <> · {projectOf(d)?.name}</> : null}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill tone="neutral" size="sm">{d.type}</Pill>
                      <Pill tone={STATUS_TONE[d.status]} size="sm">{d.status}</Pill>
                      <Pill tone="neutral" size="sm">{d.storageLocation}</Pill>
                      {d.currentVersion > 1 ? <Pill tone="neutral" size="sm">v{d.currentVersion}</Pill> : null}
                    </div>
                    <LinkedTo doc={d} step={stepFor(d)} entry={entryFor(d)} invoice={invoiceFor(d)} />
                  </div>
                  <div className="shrink-0 text-right text-[12px] text-ink-muted sm:w-40">
                    {formatDate(v?.uploadedAt.slice(0, 10) ?? '')}
                    <span className="block text-ink-faint">{v?.uploadedBy}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Actions
                      doc={d}
                      onPreview={() => setPreview(d)}
                      onDownload={() => download(d)}
                      onHistory={() => setHistory(d)}
                      onNewVersion={() => setUpload({ projectId: d.projectId, supersedeDocumentId: d.id })}
                      onDelete={() => setDeleting(d)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Preview */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name ?? ''}
        description={preview?.versions[preview.versions.length - 1]?.fileName}
        size="lg"
        footer={preview ? <Button icon={Download} onClick={() => download(preview)}>Download</Button> : null}
      >
        {preview ? <PreviewBody doc={preview} /> : null}
      </Modal>

      {/* Version history */}
      <Modal
        open={!!history}
        onClose={() => setHistory(null)}
        title="Version history"
        description={history?.name}
        size="md"
      >
        {history ? (
          <ol className="space-y-2.5">
            {[...history.versions].reverse().map((v) => (
              <li
                key={v.version}
                className={cx(
                  'rounded-lg border p-3.5',
                  v.version === history.currentVersion ? 'border-cyan-600/30 bg-cyan-50' : 'border-line bg-surface',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-indigo">
                      Version {v.version}
                      {v.version === history.currentVersion
                        ? <Pill tone="success" size="sm" className="ml-2">Current</Pill>
                        : <Pill tone="neutral" size="sm" className="ml-2">Superseded</Pill>}
                    </p>
                    <p className="mt-1 break-words text-[12.5px] text-ink-muted">{v.fileName}</p>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      {formatBytes(v.fileSize)} · {v.uploadedBy} · {formatDate(v.uploadedAt.slice(0, 10))}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </Modal>

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          dispatch({ type: 'doc/delete', id: deleting.id });
          toast({ tone: 'success', title: 'Document deleted' });
          setDeleting(null);
        }}
        title={`Delete “${deleting?.name ?? ''}”?`}
        confirmLabel="Delete document"
        whatIsLost={
          <ul className="list-inside list-disc space-y-1">
            <li>All {deleting?.versions.length} version{deleting?.versions.length === 1 ? '' : 's'} of this file</li>
            {deleting?.stepId ? <li>The evidence for a delivery plan step, which will then appear on the attention list</li> : null}
            {deleting?.registerEntryId ? <li>The file behind a submissions register entry</li> : null}
            {deleting?.invoiceId ? <li>The progress report attached to an invoice</li> : null}
          </ul>
        }
      />

      <UploadDialog open={!!upload} onClose={() => setUpload(null)} target={upload} />
    </>
  );
}

function Filter({
  label, value, onChange, options, allLabel,
}: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; allLabel: string }) {
  return (
    <div>
      <label htmlFor={`df-${label}`} className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</label>
      <select
        id={`df-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx('h-9 max-w-[200px] cursor-pointer rounded-lg border bg-surface px-2.5 text-[13px] font-medium hover:border-[#CFD8E1]',
          value ? 'border-cyan-600 text-indigo' : 'border-line text-ink-muted')}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function LinkedTo({
  doc, step, entry, invoice,
}: {
  doc: DocumentRecord;
  step?: { id: string; step: string; action: string; projectId: string };
  entry?: { id: string; submission: string; projectId: string };
  invoice?: { id: string; number: string; projectId: string };
}) {
  if (!step && !entry && !invoice && !doc.link) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]">
      <Paperclip className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={2} aria-hidden />
      {step ? (
        <Link to={`/projects/${step.projectId}/plan`} className="rounded font-medium text-cyan-link hover:underline">
          Step {step.step}: {step.action.slice(0, 48)}{step.action.length > 48 ? '…' : ''}
        </Link>
      ) : null}
      {entry ? (
        <Link to={`/projects/${entry.projectId}/submissions`} className="rounded font-medium text-cyan-link hover:underline">
          Register: {entry.submission}
        </Link>
      ) : null}
      {invoice ? (
        <Link to={`/projects/${invoice.projectId}/reports`} className="rounded font-medium text-cyan-link hover:underline">
          Invoice {invoice.number}
        </Link>
      ) : null}
      {doc.link ? (
        <a href={doc.link} target="_blank" rel="noreferrer" className="rounded font-medium text-cyan-link hover:underline">
          External link
        </a>
      ) : null}
    </div>
  );
}

function Actions({
  doc, onPreview, onDownload, onHistory, onNewVersion, onDelete,
}: {
  doc: DocumentRecord;
  onPreview: () => void; onDownload: () => void; onHistory: () => void;
  onNewVersion: () => void; onDelete: () => void;
}) {
  const v = doc.versions[doc.versions.length - 1];
  const canPreview = !!v && isPreviewable(v.fileName, v.mimeType);
  return (
    <>
      <IconButton label={`Preview ${doc.name}`} icon={Eye} size="sm" onClick={onPreview} disabled={!canPreview} />
      <IconButton label={`Download ${doc.name}`} icon={Download} size="sm" onClick={onDownload} />
      <IconButton label={`Version history for ${doc.name}`} icon={History} size="sm" onClick={onHistory} />
      <IconButton label={`Upload a new version of ${doc.name}`} icon={Upload} size="sm" onClick={onNewVersion} />
      <IconButton label={`Delete ${doc.name}`} icon={Trash2} size="sm" onClick={onDelete} className="hover:bg-danger-bg hover:text-danger" />
    </>
  );
}

function PreviewBody({ doc }: { doc: DocumentRecord }) {
  const v = doc.versions[doc.versions.length - 1];
  if (!v) return null;

  if (!v.objectUrl) {
    return (
      <InlineMessage tone="neutral" title="Nothing to preview">
        {v.fileName} is a seeded demo record, so there is no file behind it. Upload a file of your own and it
        previews here where the browser can render it.
      </InlineMessage>
    );
  }
  if (v.mimeType.startsWith('image/')) {
    return <img src={v.objectUrl} alt={doc.name} className="mx-auto max-h-[65vh] rounded-lg" />;
  }
  if (v.mimeType === 'application/pdf') {
    return <iframe src={v.objectUrl} title={doc.name} className="h-[65vh] w-full rounded-lg border border-line" />;
  }
  return (
    <InlineMessage tone="neutral" title="The browser cannot render this file type">
      {fileKindLabel(v.fileName)} files download rather than preview. Use Download to open it in the right application.
    </InlineMessage>
  );
}
