import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { Button, cx, InlineMessage, ProgressBar } from '@/components/ui/primitives';
import { Field, Select, TextInput } from '@/components/ui/form';
import { Modal } from '@/components/ui/Modal';
import {
  ACCEPT_ATTR, LIMITS_MESSAGE, fileKindLabel, formatBytes, validateFile,
} from '@/lib/files';
import { DOC_STATUS, DOC_TYPE, STORAGE_LOCATION } from '@/data/reference';
import { useApp } from '@/store/AppStore';
import { uid } from '@/data/factory';
import type { DocStatus, DocType, DocumentRecord, StorageLocation } from '@/types';

interface Queued {
  id: string;
  file: File;
  progress: number;
  error: string | null;
  done: boolean;
}

export interface UploadTarget {
  projectId: string;
  stepId?: string | null;
  registerEntryId?: string | null;
  invoiceId?: string | null;
  /** Add a new version to this record rather than creating a new one. */
  supersedeDocumentId?: string;
  defaultName?: string;
  defaultType?: DocType;
}

/**
 * Upload. Files are held in memory as object URLs — a back end can be attached
 * later without changing anything the rest of the app sees.
 */
export function UploadDialog({
  open, onClose, target, title, description,
}: {
  open: boolean; onClose: () => void; target: UploadTarget | null;
  title?: string; description?: React.ReactNode;
}) {
  const { dispatch, currentUser, toast } = useApp();
  const [queue, setQueue] = useState<Queued[]>([]);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<DocType>('Evidence');
  const [status, setStatus] = useState<DocStatus>('For review');
  const [location, setLocation] = useState<StorageLocation>('Working documents');
  const [link, setLink] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setQueue([]);
    setName(target?.defaultName ?? '');
    setType(target?.defaultType ?? 'Evidence');
    setStatus('For review');
    setLocation('Working documents');
    setLink('');
  }, [open, target]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearInterval(t)); }, []);

  const accept = useCallback((files: FileList | File[]) => {
    const next: Queued[] = [];
    for (const file of Array.from(files)) {
      const error = validateFile(file);
      next.push({ id: uid('file'), file, progress: error ? 0 : 0, error, done: false });
    }
    setQueue((prev) => [...prev, ...next]);

    // No back end yet, so the transfer is simulated — the shape of the
    // interaction is what matters, and it is what a real upload will report.
    for (const item of next) {
      if (item.error) continue;
      const timer = window.setInterval(() => {
        setQueue((prev) => prev.map((q) => {
          if (q.id !== item.id || q.done) return q;
          const p = Math.min(100, q.progress + 12 + Math.random() * 22);
          if (p >= 100) { window.clearInterval(timer); return { ...q, progress: 100, done: true }; }
          return { ...q, progress: p };
        }));
      }, 130);
      timers.current.push(timer);
    }
  }, []);

  const ready = queue.filter((q) => q.done && !q.error);
  const rejected = queue.filter((q) => q.error);
  const busy = queue.some((q) => !q.done && !q.error);
  const isSupersede = Boolean(target?.supersedeDocumentId);
  const canSave = ready.length > 0 && !busy && (isSupersede || name.trim().length > 0);

  const save = () => {
    if (!target || !canSave) return;

    if (isSupersede) {
      const q = ready[0];
      dispatch({
        type: 'doc/addVersion',
        id: target.supersedeDocumentId!,
        version: {
          version: 0, // replaced below by the store caller
          fileName: q.file.name,
          fileSize: q.file.size,
          mimeType: q.file.type || 'application/octet-stream',
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString(),
          objectUrl: URL.createObjectURL(q.file),
        },
      });
      toast({ tone: 'success', title: 'New version uploaded', body: `${q.file.name} supersedes the previous version, which stays in the history.` });
      onClose();
      return;
    }

    ready.forEach((q, i) => {
      const doc: DocumentRecord = {
        id: uid('doc'),
        projectId: target.projectId,
        name: ready.length > 1 ? `${name.trim()} — ${q.file.name}` : name.trim(),
        stepId: target.stepId ?? null,
        registerEntryId: target.registerEntryId ?? null,
        invoiceId: target.invoiceId ?? null,
        type, status, storageLocation: location,
        link: i === 0 ? link.trim() : '',
        currentVersion: 1,
        versions: [{
          version: 1,
          fileName: q.file.name,
          fileSize: q.file.size,
          mimeType: q.file.type || 'application/octet-stream',
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString(),
          objectUrl: URL.createObjectURL(q.file),
        }],
      };
      dispatch({ type: 'doc/add', doc });
    });

    toast({
      tone: 'success',
      title: ready.length === 1 ? 'File uploaded' : `${ready.length} files uploaded`,
      body: target.stepId
        ? 'The document is linked to the step, and the step now shows its evidence.'
        : target.registerEntryId
          ? 'The document is linked to the register entry.'
          : 'The document is filed against the project.',
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? (isSupersede ? 'Upload a new version' : 'Upload a document')}
      description={description ?? (isSupersede
        ? 'The current file becomes a previous version. Nothing is deleted — the history stays visible on the record.'
        : undefined)}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!canSave} icon={UploadCloud}>
            {busy ? 'Uploading…' : isSupersede ? 'Replace with this version' : `Attach ${ready.length || ''} ${ready.length === 1 ? 'file' : 'files'}`.trim()}
          </Button>
        </>
      }
    >
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
        className={cx(
          'rounded-card border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-cyan-600 bg-cyan-50' : 'border-line bg-canvas',
        )}
      >
        <FileUp className="mx-auto h-8 w-8 text-cyan-link" strokeWidth={1.75} aria-hidden />
        <p className="mt-3 text-sm font-semibold text-indigo">Drag files here, or choose them</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-muted">{LIMITS_MESSAGE}</p>
        <input
          ref={inputRef}
          type="file"
          multiple={!isSupersede}
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => { if (e.target.files) accept(e.target.files); e.target.value = ''; }}
        />
        <Button className="mt-4" icon={Paperclip} onClick={() => inputRef.current?.click()}>Choose files</Button>
      </div>

      {queue.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {queue.map((q) => (
            <li
              key={q.id}
              className={cx(
                'rounded-lg border p-3',
                q.error ? 'border-danger/25 bg-danger-bg' : 'border-line bg-surface',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {q.error
                    ? <AlertTriangle className="h-4 w-4 text-danger" strokeWidth={2} aria-hidden />
                    : q.done
                      ? <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={2} aria-hidden />
                      : <UploadCloud className="h-4 w-4 text-cyan-link" strokeWidth={2} aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-indigo">{q.file.name}</p>
                  <p className={cx('mt-0.5 text-[12px]', q.error ? 'text-danger' : 'text-ink-muted')}>
                    {q.error ?? `${fileKindLabel(q.file.name)} · ${formatBytes(q.file.size)}${q.done ? ' · ready' : ''}`}
                  </p>
                  {!q.error && !q.done ? (
                    <ProgressBar value={q.progress} className="mt-2" height="h-1.5" label={`Uploading ${q.file.name}`} />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setQueue((prev) => prev.filter((x) => x.id !== q.id))}
                  className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-canvas hover:text-danger"
                  aria-label={`Remove ${q.file.name}`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {rejected.length > 0 ? (
        <InlineMessage tone="danger" className="mt-3" icon={AlertTriangle} title={`${rejected.length} file${rejected.length === 1 ? '' : 's'} could not be accepted`}>
          Remove them from the list above, fix the problem described, and add them again. The rest will still upload.
        </InlineMessage>
      ) : null}

      {!isSupersede ? (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <Field label="Document name" required htmlFor="up-name" hint="What this file is, in the words the team would use to look for it.">
            <TextInput
              id="up-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Signed UAT record, round 2"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Document type" htmlFor="up-type">
              <Select id="up-type" options={DOC_TYPE} value={type} onChange={(e) => setType(e.target.value as DocType)} />
            </Field>
            <Field label="Status" htmlFor="up-status">
              <Select id="up-status" options={DOC_STATUS} value={status} onChange={(e) => setStatus(e.target.value as DocStatus)} />
            </Field>
            <Field label="Storage location" htmlFor="up-loc" hint="Working documents are drafts. Approved documents are the client-facing record.">
              <Select id="up-loc" options={STORAGE_LOCATION} value={location} onChange={(e) => setLocation(e.target.value as StorageLocation)} />
            </Field>
            <Field label="Link (optional)" htmlFor="up-link" hint="A SharePoint or repository address, if the file also lives elsewhere.">
              <TextInput id="up-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
