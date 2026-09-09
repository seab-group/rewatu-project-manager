import type { AccessRole, AppState, Person, Project } from '@/types';

/**
 * Role-based access.
 *
 * There is no authentication yet — the demo switches who you are from the user
 * menu. Everything below is the shape the real thing will keep: a person's
 * access role plus their relationship to a particular project decides what
 * they can see and change. Every check takes the project it applies to, so
 * "project manager" never means "project manager of everything".
 */

export const ACCESS_ROLES: AccessRole[] = [
  'Director', 'Project manager', 'Project lead', 'Team member',
];

export const ROLE_DESCRIPTION: Record<AccessRole, string> = {
  Director: 'Sees every project and all money. Can create and delete projects, and manage people.',
  'Project manager': 'Runs their own projects end to end, including invoices and the money figures.',
  'Project lead': 'Runs delivery on their projects: the plan, the register and the documents. No money.',
  'Team member': 'Sees the projects they are working on, works their own tasks and uploads evidence.',
};

/** They hold a named role on the project. */
export function leadsProject(person: Person, project: Project): boolean {
  return project.projectManagerId === person.id || project.projectLeadId === person.id;
}

/**
 * They hold a named role on it, or they have work on it. A register entry names
 * a role rather than a person, so it never confers membership on its own.
 */
export function isOnProject(state: AppState, person: Person, project: Project): boolean {
  if (leadsProject(person, project)) return true;
  return state.steps.some((s) => s.projectId === project.id && s.assigneeId === person.id);
}

/** The projects this person may open at all. */
export function visibleProjects(state: AppState, person: Person): Project[] {
  const active = state.projects.filter((p) => !p.archived);
  if (person.accessRole === 'Director') return active;
  return active.filter((p) => isOnProject(state, person, p));
}

export function canSeeProject(state: AppState, person: Person, project: Project): boolean {
  return person.accessRole === 'Director' || isOnProject(state, person, project);
}

/* ------------------------------------------------------------------ *
 * Per-project abilities
 * ------------------------------------------------------------------ */

export interface ProjectAbilities {
  /** Contract value, invoices, and the money blocks. */
  viewMoney: boolean;
  editMoney: boolean;
  /** Add, edit, reorder and delete delivery plan steps. */
  editPlan: boolean;
  /** Change the project's own details. */
  editSetup: boolean;
  editRegister: boolean;
  /** Put a named person on a step. */
  assignWork: boolean;
  uploadDocuments: boolean;
  deleteProject: boolean;
}

const NOTHING: ProjectAbilities = {
  viewMoney: false, editMoney: false, editPlan: false, editSetup: false,
  editRegister: false, assignWork: false, uploadDocuments: false, deleteProject: false,
};

export function abilities(state: AppState, person: Person, project: Project | null): ProjectAbilities {
  if (!project) return NOTHING;
  if (person.accessRole === 'Director') {
    return {
      viewMoney: true, editMoney: true, editPlan: true, editSetup: true,
      editRegister: true, assignWork: true, uploadDocuments: true, deleteProject: true,
    };
  }
  if (!isOnProject(state, person, project)) return NOTHING;

  const isManager = project.projectManagerId === person.id;
  const isLead = project.projectLeadId === person.id;

  if (person.accessRole === 'Project manager' && isManager) {
    return {
      viewMoney: true, editMoney: true, editPlan: true, editSetup: true,
      editRegister: true, assignWork: true, uploadDocuments: true, deleteProject: false,
    };
  }
  if (person.accessRole === 'Project lead' && (isLead || isManager)) {
    return {
      viewMoney: false, editMoney: false, editPlan: true, editSetup: false,
      editRegister: true, assignWork: true, uploadDocuments: true, deleteProject: false,
    };
  }
  // On the project but not running it: work your own tasks and file evidence.
  return { ...NOTHING, uploadDocuments: true };
}

/* ------------------------------------------------------------------ *
 * System-wide abilities
 * ------------------------------------------------------------------ */

export function canCreateProject(person: Person): boolean {
  return person.accessRole === 'Director' || person.accessRole === 'Project manager';
}

export function canManagePeople(person: Person): boolean {
  return person.accessRole === 'Director';
}

/** The portfolio and reports views are a money picture. */
export function canSeePortfolio(person: Person): boolean {
  return person.accessRole !== 'Team member';
}

export function canSeeReports(person: Person): boolean {
  return person.accessRole === 'Director' || person.accessRole === 'Project manager';
}

/** Anyone may work a step that is theirs. */
export function canExecuteStep(person: Person, assigneeId: string | null): boolean {
  return assigneeId === person.id;
}
