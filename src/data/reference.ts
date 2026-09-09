// Reference lists. These are the controlled vocabularies of the system; every
// drop-down in the app is driven from here so a value can never drift.

export const PHASES = [
  '1 Initiation', '2 Planning', '3 Requirements', '4 Front-end development',
  '5 Client demo 1', '6 Environment and access', '7 Publish and test',
  '8 Back-end development', '9 Final deployment', '10 Training and support',
] as const;

export const STATUS = ['Not started', 'In progress', 'Completed', 'On hold', 'Blocked', 'Not applicable'] as const;

export const RESPONSIBLE = [
  'Project manager', 'Project lead', 'Front-end developer', 'Back-end developer',
  'Business analyst', 'Designer', 'Tester / QA', 'Trainer', 'Director',
  'Department', 'Department and provider', 'External',
] as const;

export const SUBMISSION_STATUS = [
  'Not required', 'Not yet due', 'Prepared', 'Submitted', 'Acknowledged', 'Returned for correction',
] as const;

export const YES_NO = ['Yes', 'No', 'Not applicable'] as const;
export const PRIORITY = ['High', 'Medium', 'Low'] as const;
export const DOC_TYPE = ['Deliverable', 'Evidence', 'Submission', 'Contract', 'Minutes', 'Report', 'Other'] as const;
export const DOC_STATUS = ['Draft', 'For review', 'Approved', 'Superseded'] as const;

export const REGISTER_STATUS = [
  'Not started', 'Prepared', 'Submitted', 'Acknowledged', 'Returned for correction', 'Not applicable',
] as const;

export const INVOICE_STATUS = ['Submitted', 'Approved for payment', 'Paid', 'Queried'] as const;

export const STORAGE_LOCATION = ['Working documents', 'Approved documents'] as const;

export const DELIVERY_TIER = ['1', '2'] as const;

export const FLAGS = [
  'Complete', 'Awaiting acknowledgement', 'Blocked', 'On hold', 'No date', 'Overdue', 'Due soon', 'On track',
] as const;

export const HEALTH = ['On track', 'Behind schedule', 'At risk'] as const;
