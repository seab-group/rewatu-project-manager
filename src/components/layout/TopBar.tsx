import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell, Check, ChevronsUpDown, FileText, FolderKanban, ListChecks, LogOut, Menu, Search, UserCog, X,
} from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { cx, IconButton, Pill } from '@/components/ui/primitives';
import { formatDate } from '@/lib/dates';

function useOutsideClose(ref: React.RefObject<HTMLElement>, onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onClose, active]);
}

/* ------------------------------------------------------------------ */

function ProjectSwitcher() {
  const { state } = useApp();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);

  const current = state.projects.find((p) => p.id === projectId);
  if (!current) return null;

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-9 min-w-0 max-w-[min(46vw,20rem)] items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-semibold text-indigo transition-colors hover:bg-canvas"
      >
        <FolderKanban className="h-4 w-4 shrink-0 text-cyan-link" strokeWidth={2} aria-hidden />
        <span className="truncate">{current.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Switch project"
          className="absolute left-0 top-full z-40 mt-1.5 w-[min(92vw,22rem)] overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-pop animate-scale-in"
        >
          {state.projects.filter((p) => !p.archived).map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === current.id}
              onClick={() => { setOpen(false); navigate(`/projects/${p.id}`); }}
              className={cx(
                'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                p.id === current.id ? 'bg-cyan-50' : 'hover:bg-canvas',
              )}
            >
              <Check className={cx('mt-0.5 h-4 w-4 shrink-0', p.id === current.id ? 'text-cyan-link' : 'text-transparent')} strokeWidth={2.5} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-indigo">{p.name}</span>
                <span className="block truncate text-[12px] text-ink-muted">{p.client}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GlobalSearch() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const out: Array<{ id: string; kind: string; label: string; detail: string; href: string; icon: React.ElementType }> = [];
    for (const p of state.projects) {
      if (`${p.name} ${p.client} ${p.contractRef}`.toLowerCase().includes(term)) {
        out.push({ id: `p-${p.id}`, kind: 'Project', label: p.name, detail: p.client, href: `/projects/${p.id}`, icon: FolderKanban });
      }
    }
    for (const s of state.steps) {
      if (out.length > 40) break;
      if (`${s.step} ${s.action} ${s.deliverable}`.toLowerCase().includes(term)) {
        const p = state.projects.find((x) => x.id === s.projectId);
        out.push({
          id: `s-${s.id}`, kind: 'Step', label: `${s.step} ${s.action}`,
          detail: `${p?.name ?? ''} · ${s.phase}`, href: `/projects/${s.projectId}/plan`, icon: ListChecks,
        });
      }
    }
    for (const d of state.documents) {
      if (out.length > 60) break;
      if (d.name.toLowerCase().includes(term) || d.versions.some((v) => v.fileName.toLowerCase().includes(term))) {
        const p = state.projects.find((x) => x.id === d.projectId);
        out.push({
          id: `d-${d.id}`, kind: 'Document', label: d.name,
          detail: `${p?.name ?? ''} · ${d.type}`, href: `/documents?q=${encodeURIComponent(d.name)}`, icon: FileText,
        });
      }
    }
    return out.slice(0, 12);
  }, [q, state]);

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-md" ref={ref}>
      <label htmlFor="global-search" className="sr-only">Search projects, steps and documents</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={2} aria-hidden />
      <input
        id="global-search"
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search projects, steps, documents"
        className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-16 text-sm text-ink placeholder:text-ink-faint hover:border-[#CFD8E1]"
      />
      {q ? (
        <button
          type="button"
          onClick={() => { setQ(''); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-indigo"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint sm:block">
          ⌘K
        </kbd>
      )}

      {open && q.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-card border border-line bg-surface shadow-pop animate-scale-in">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-muted">
              Nothing matches “{q}”. Try a step number, a deliverable or a client name.
            </p>
          ) : (
            <ul className="rw-scroll max-h-[60vh] overflow-y-auto p-1.5">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setQ(''); navigate(r.href); }}
                    className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-canvas"
                  >
                    <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-link" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-indigo">{r.label}</span>
                      <span className="block truncate text-[12px] text-ink-muted">{r.detail}</span>
                    </span>
                    <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                      {r.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Notifications() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);

  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications, none unread'}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-[#EDF1F5] hover:text-indigo"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-[min(92vw,24rem)] overflow-hidden rounded-card border border-line bg-surface shadow-pop animate-scale-in">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold text-indigo">Notifications</h2>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'notify/readAll' })}
                className="rounded text-[12px] font-semibold text-cyan-link hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="rw-scroll max-h-[65vh] divide-y divide-line overflow-y-auto">
            {state.notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'notify/read', id: n.id });
                    setOpen(false);
                    if (n.projectId) navigate(`/projects/${n.projectId}`);
                  }}
                  className={cx('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas', !n.read && 'bg-cyan-50/40')}
                >
                  <span
                    className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      n.tone === 'danger' ? 'bg-danger' : n.tone === 'warning' ? 'bg-warning' : n.tone === 'success' ? 'bg-success' : 'bg-neutral')}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-indigo">
                      {n.title}
                      {!n.read ? <span className="sr-only"> (unread)</span> : null}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-ink-faint">{formatDate(n.createdAt.slice(0, 10))}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function UserMenu() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);

  const initials = currentUser.name.split(' ').map((s) => s[0]).slice(0, 2).join('');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${currentUser.name}`}
        className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-[#EDF1F5]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo text-[12px] font-bold text-white" aria-hidden>
          {initials}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block text-[13px] font-semibold leading-tight text-indigo">{currentUser.name}</span>
          <span className="block text-[11px] leading-tight text-ink-muted">{currentUser.role}</span>
        </span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-pop animate-scale-in">
          <div className="border-b border-line px-2.5 pb-2.5 pt-1.5">
            <p className="text-[13px] font-semibold text-indigo">{currentUser.name}</p>
            <p className="truncate text-[12px] text-ink-muted">{currentUser.email}</p>
            <Pill tone="neutral" size="sm" className="mt-2">{currentUser.role}</Pill>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); navigate('/settings'); }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-canvas"
          >
            <UserCog className="h-4 w-4 text-ink-muted" strokeWidth={2} aria-hidden />
            People and settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-canvas"
          >
            <LogOut className="h-4 w-4 text-ink-muted" strokeWidth={2} aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <IconButton label="Open menu" icon={Menu} onClick={onOpenMenu} className="lg:hidden" />
      <div className="hidden min-w-0 lg:block"><ProjectSwitcher /></div>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Notifications />
        <UserMenu />
      </div>
    </header>
  );
}

export { ProjectSwitcher };
