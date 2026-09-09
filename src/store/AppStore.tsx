import React, { createContext, useCallback, useContext, useMemo, useReducer, useState } from 'react';
import type {
  AppState, DeliveryStep, DocumentRecord, DocumentVersion, Invoice, MonthlyReport,
  Person, Project, RegisterEntry,
} from '@/types';
import { buildInitialState } from '@/data/seed';
import { instantiateDeliveryPlan, instantiateRegister, scheduleRegister, scheduleSteps, uid } from '@/data/factory';

type Action =
  | { type: 'project/create'; project: Project }
  | { type: 'project/update'; id: string; patch: Partial<Project> }
  | { type: 'project/delete'; id: string }
  | { type: 'step/update'; id: string; patch: Partial<DeliveryStep> }
  | { type: 'step/updateMany'; ids: string[]; patch: Partial<DeliveryStep> }
  | { type: 'step/insert'; projectId: string; afterId: string | null; phase: string }
  | { type: 'step/duplicate'; id: string }
  | { type: 'step/delete'; id: string }
  | { type: 'step/reorder'; projectId: string; phase: string; orderedIds: string[] }
  | { type: 'register/update'; id: string; patch: Partial<RegisterEntry> }
  | { type: 'register/insert'; projectId: string; phase: string }
  | { type: 'register/delete'; id: string }
  | { type: 'doc/add'; doc: DocumentRecord }
  | { type: 'doc/addVersion'; id: string; version: DocumentVersion }
  | { type: 'doc/update'; id: string; patch: Partial<DocumentRecord> }
  | { type: 'doc/delete'; id: string }
  | { type: 'invoice/add'; invoice: Invoice }
  | { type: 'invoice/update'; id: string; patch: Partial<Invoice> }
  | { type: 'invoice/delete'; id: string }
  | { type: 'report/update'; id: string; patch: Partial<MonthlyReport> }
  | { type: 'report/add'; report: MonthlyReport }
  | { type: 'person/add'; person: Person }
  | { type: 'person/update'; id: string; patch: Partial<Person> }
  | { type: 'person/delete'; id: string }
  | { type: 'notify/readAll' }
  | { type: 'notify/read'; id: string };

/** Rewrite `order` so the Ref column is a clean 1..n sequence again. */
function renumber(steps: DeliveryStep[], projectId: string): DeliveryStep[] {
  const mine = steps.filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order);
  const orderById = new Map(mine.map((s, i) => [s.id, i]));
  return steps.map((s) => (orderById.has(s.id) ? { ...s, order: orderById.get(s.id)! } : s));
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'project/create': {
      const p = action.project;
      const steps = scheduleSteps(instantiateDeliveryPlan(p.id), p.startDate, p.contractedCompletion);
      const entries = scheduleRegister(instantiateRegister(p.id), steps);
      return {
        ...state,
        projects: [...state.projects, p],
        steps: [...state.steps, ...steps],
        registerEntries: [...state.registerEntries, ...entries],
      };
    }
    case 'project/update':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case 'project/delete':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        steps: state.steps.filter((s) => s.projectId !== action.id),
        registerEntries: state.registerEntries.filter((e) => e.projectId !== action.id),
        documents: state.documents.filter((d) => d.projectId !== action.id),
        invoices: state.invoices.filter((i) => i.projectId !== action.id),
        monthlyReports: state.monthlyReports.filter((r) => r.projectId !== action.id),
      };

    case 'step/update':
      return {
        ...state,
        steps: state.steps.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case 'step/updateMany': {
      const ids = new Set(action.ids);
      return {
        ...state,
        steps: state.steps.map((s) => (ids.has(s.id) ? { ...s, ...action.patch } : s)),
      };
    }
    case 'step/insert': {
      const after = action.afterId
        ? state.steps.find((s) => s.id === action.afterId)
        // With no anchor, the row joins the end of its own phase rather than
        // the end of the plan, so the phase groups stay contiguous.
        : [...state.steps]
            .filter((s) => s.projectId === action.projectId && s.phase === action.phase)
            .sort((a, b) => a.order - b.order)
            .pop() ?? null;
      const at = after ? after.order + 0.5 : Number.MAX_SAFE_INTEGER;
      const fresh: DeliveryStep = {
        id: uid('step'), projectId: action.projectId, order: at,
        phase: after?.phase ?? action.phase, step: '', action: '', deliverable: '',
        responsible: '', assigneeId: null, evidenceLink: '',
        plannedStart: '', plannedEnd: '', actualCompletion: '',
        status: 'Not started', percentComplete: 0, submission: 'Not required',
        dateSubmitted: '', acknowledged: 'Not applicable', notes: '',
      };
      return { ...state, steps: renumber([...state.steps, fresh], action.projectId) };
    }
    case 'step/duplicate': {
      const src = state.steps.find((s) => s.id === action.id);
      if (!src) return state;
      const copy: DeliveryStep = {
        ...src, id: uid('step'), order: src.order + 0.5,
        status: 'Not started', percentComplete: 0, actualCompletion: '',
        dateSubmitted: '', acknowledged: src.submission === 'Not required' ? 'Not applicable' : 'No',
      };
      return { ...state, steps: renumber([...state.steps, copy], src.projectId) };
    }
    case 'step/delete': {
      const src = state.steps.find((s) => s.id === action.id);
      if (!src) return state;
      return {
        ...state,
        steps: renumber(state.steps.filter((s) => s.id !== action.id), src.projectId),
        documents: state.documents.map((d) => (d.stepId === action.id ? { ...d, stepId: null } : d)),
      };
    }
    case 'step/reorder': {
      const base = state.steps.filter((s) => s.projectId === action.projectId).sort((a, b) => a.order - b.order);
      // The phase keeps the slots it already occupies; only the occupants move.
      const slots = base.filter((s) => s.phase === action.phase).map((s) => s.order);
      const moved = new Map<string, number>();
      action.orderedIds.forEach((id, i) => { if (slots[i] !== undefined) moved.set(id, slots[i]); });
      return {
        ...state,
        steps: renumber(
          state.steps.map((s) => (moved.has(s.id) ? { ...s, order: moved.get(s.id)! } : s)),
          action.projectId,
        ),
      };
    }

    case 'register/update':
      return {
        ...state,
        registerEntries: state.registerEntries.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      };
    case 'register/insert': {
      const mine = state.registerEntries.filter((e) => e.projectId === action.projectId);
      const fresh: RegisterEntry = {
        id: uid('reg'), projectId: action.projectId,
        order: Math.max(-1, ...mine.map((e) => e.order)) + 1,
        phase: action.phase.split(' ')[0], submission: '', template: '', signedBy: '', owner: '',
        plannedDate: '', dateSubmitted: '', acknowledgedOn: '', status: 'Not started', notes: '',
      };
      return { ...state, registerEntries: [...state.registerEntries, fresh] };
    }
    case 'register/delete':
      return {
        ...state,
        registerEntries: state.registerEntries.filter((e) => e.id !== action.id),
        documents: state.documents.map((d) =>
          d.registerEntryId === action.id ? { ...d, registerEntryId: null } : d),
      };

    case 'doc/add':
      return { ...state, documents: [action.doc, ...state.documents] };
    case 'doc/addVersion':
      // The uploader does not know the record's history; the store assigns the
      // next version number and keeps every earlier one visible.
      return {
        ...state,
        documents: state.documents.map((d) => {
          if (d.id !== action.id) return d;
          const next = Math.max(0, ...d.versions.map((v) => v.version)) + 1;
          return {
            ...d,
            currentVersion: next,
            status: d.status === 'Superseded' ? 'For review' : d.status,
            versions: [...d.versions, { ...action.version, version: next }],
          };
        }),
      };
    case 'doc/update':
      return {
        ...state,
        documents: state.documents.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)),
      };
    case 'doc/delete':
      return { ...state, documents: state.documents.filter((d) => d.id !== action.id) };

    case 'invoice/add':
      return { ...state, invoices: [...state.invoices, action.invoice] };
    case 'invoice/update':
      return {
        ...state,
        invoices: state.invoices.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)),
      };
    case 'invoice/delete':
      return {
        ...state,
        invoices: state.invoices.filter((i) => i.id !== action.id),
        documents: state.documents.filter((d) => d.invoiceId !== action.id),
      };

    case 'report/add':
      return { ...state, monthlyReports: [...state.monthlyReports, action.report] };
    case 'report/update':
      return {
        ...state,
        monthlyReports: state.monthlyReports.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };

    case 'person/add':
      return { ...state, people: [...state.people, action.person] };
    case 'person/update':
      return {
        ...state,
        people: state.people.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case 'person/delete':
      return { ...state, people: state.people.filter((p) => p.id !== action.id) };

    case 'notify/readAll':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case 'notify/read':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      };
    default:
      return state;
  }
}

export interface Toast {
  id: string;
  tone: 'success' | 'danger' | 'warning' | 'neutral';
  title: string;
  body?: string;
}

interface Ctx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  currentUser: Person;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid('toast');
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const currentUser = useMemo(
    () => state.people.find((p) => p.id === state.currentUserId) ?? state.people[0],
    [state.people, state.currentUserId],
  );

  const value = useMemo(
    () => ({ state, dispatch, toasts, toast, dismissToast, currentUser }),
    [state, toasts, toast, dismissToast, currentUser],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** Everything belonging to one project, in one hook. */
export function useProject(projectId: string | undefined) {
  const { state } = useApp();
  return useMemo(() => {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return null;
    return {
      project,
      steps: state.steps.filter((s) => s.projectId === project.id).sort((a, b) => a.order - b.order),
      entries: state.registerEntries.filter((e) => e.projectId === project.id).sort((a, b) => a.order - b.order),
      documents: state.documents.filter((d) => d.projectId === project.id),
      invoices: state.invoices.filter((i) => i.projectId === project.id),
      reports: state.monthlyReports.filter((r) => r.projectId === project.id),
    };
  }, [state, projectId]);
}
