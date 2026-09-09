import type {
  DOC_STATUS, DOC_TYPE, HEALTH, INVOICE_STATUS, REGISTER_STATUS, RESPONSIBLE,
  STATUS, STORAGE_LOCATION, SUBMISSION_STATUS, YES_NO, FLAGS,
} from '@/data/reference';

export type Phase = string;
export type Status = (typeof STATUS)[number];
export type Responsible = (typeof RESPONSIBLE)[number];
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];
export type YesNo = (typeof YES_NO)[number];
export type DocType = (typeof DOC_TYPE)[number];
export type DocStatus = (typeof DOC_STATUS)[number];
export type RegisterStatus = (typeof REGISTER_STATUS)[number];
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];
export type StorageLocation = (typeof STORAGE_LOCATION)[number];
export type Health = (typeof HEALTH)[number];
export type Flag = (typeof FLAGS)[number] | '';

/** ISO date, `YYYY-MM-DD`. Empty string means "not set". */
export type ISODate = string;

/**
 * What someone may do in the system, as distinct from the job they do on a
 * project. A back-end will map these off real accounts; for now the demo lets
 * you switch between them.
 */
export type AccessRole = 'Director' | 'Project manager' | 'Project lead' | 'Team member';

export interface Person {
  id: string;
  name: string;
  email: string;
  /** The job they do — drives the responsible-party lists. */
  role: Responsible;
  /** What they are allowed to see and change. */
  accessRole: AccessRole;
  active: boolean;
}

export interface DeliveryStep {
  id: string;
  projectId: string;
  /** Display order within the project. `ref` is derived from this, never stored. */
  order: number;
  phase: Phase;
  step: string;
  action: string;
  deliverable: string;
  responsible: Responsible | '';
  /** Named person the step is assigned to, over and above the role. */
  assigneeId: string | null;
  evidenceLink: string;
  plannedStart: ISODate;
  plannedEnd: ISODate;
  actualCompletion: ISODate;
  status: Status;
  percentComplete: number;
  submission: SubmissionStatus;
  dateSubmitted: ISODate;
  acknowledged: YesNo;
  notes: string;
}

export interface RegisterEntry {
  id: string;
  projectId: string;
  order: number;
  phase: string;
  submission: string;
  template: string;
  signedBy: string;
  owner: string;
  plannedDate: ISODate;
  dateSubmitted: ISODate;
  acknowledgedOn: ISODate;
  status: RegisterStatus;
  notes: string;
}

export interface DocumentVersion {
  version: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  /** Object URL for files added in this session; null for seeded demo records. */
  objectUrl: string | null;
}

export interface DocumentRecord {
  id: string;
  projectId: string;
  name: string;
  /** Delivery step this file is evidence for. */
  stepId: string | null;
  /** Register entry this file is the submission for. */
  registerEntryId: string | null;
  /** Invoice this file is the progress report for. */
  invoiceId: string | null;
  type: DocType;
  status: DocStatus;
  storageLocation: StorageLocation;
  link: string;
  currentVersion: number;
  versions: DocumentVersion[];
}

export interface Invoice {
  id: string;
  projectId: string;
  number: string;
  date: ISODate;
  periodCovered: string;
  amount: number;
  linkedPhase: string;
  progressReportAttached: boolean;
  status: InvoiceStatus;
  datePaid: ISODate;
}

export interface MonthlyReport {
  id: string;
  projectId: string;
  /** `YYYY-MM`. */
  month: string;
  lodged: boolean;
  lodgedOn: ISODate;
  invoiceId: string | null;
  notes: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  contractRef: string;
  serviceScheduleRef: string;
  deliveryTier: '1' | '2';

  projectManagerId: string;
  projectLeadId: string;
  projectEmail: string;
  clientProjectManager: string;
  clientBusinessOwner: string;

  startDate: ISODate;
  contractedCompletion: ISODate;
  contractValue: number;
  currency: string;
  supportPeriodMonths: number;
  costBudget: number | null;
  /** Internal cost booked to the project so far. Drives spend against budget. */
  costToDate: number | null;

  systemRepositoryLocation: string;
  workingDocumentLocation: string;
  approvedDocumentLocation: string;

  departmentalWorkbookUpdated: ISODate;
  thisWorkbookUpdated: ISODate;

  archived: boolean;
  createdAt: string;
}

export interface AppState {
  people: Person[];
  projects: Project[];
  steps: DeliveryStep[];
  registerEntries: RegisterEntry[];
  documents: DocumentRecord[];
  invoices: Invoice[];
  monthlyReports: MonthlyReport[];
  /** Who is using the system. No authentication yet — this is the demo switch. */
  currentUserId: string;
  /**
   * Alerts are derived from the data on every render, never stored, so they can
   * never go stale. Only what has been read is remembered, by alert id.
   */
  readAlertIds: string[];
}
