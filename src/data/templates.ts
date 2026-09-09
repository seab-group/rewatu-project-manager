// The standard template. Every new project is created from exactly this delivery
// plan and this submissions register — verbatim, in this order. Nothing here is
// edited per project; the project's own copy is what the team edits afterwards.

export interface DeliveryPlanTemplateRow {
  phase: string;
  step: string;
  action: string;
  deliverable: string;
  responsible: string;
  submission: string;
}

export interface SubmissionTemplateRow {
  phase: string;
  submission: string;
  template: string;
  signedBy: string;
  owner: string;
}

export const DELIVERY_PLAN_TEMPLATE: DeliveryPlanTemplateRow[] = [
  { phase: "1 Initiation", step: "0.1", action: "Hold the internal project session and appoint a project manager", deliverable: "Session note; PM appointed", responsible: "Project lead", submission: "Not required" },
  { phase: "1 Initiation", step: "1", action: "Read the scope from the TOR and write the internal scope document", deliverable: "Internal scope document", responsible: "Project lead", submission: "Not required" },
  { phase: "1 Initiation", step: "1.2", action: "Create the project email address and appoint the project lead", deliverable: "Project mailbox; lead named", responsible: "Project lead", submission: "Not required" },
  { phase: "1 Initiation", step: "1.3", action: "Set up the internal environment: drive, folders, repository and accounts", deliverable: "Project folder; repository", responsible: "Project lead", submission: "Not required" },
  { phase: "2 Planning", step: "2", action: "Draft the kick-off agenda", deliverable: "Kick-off agenda", responsible: "Project lead", submission: "Not required" },
  { phase: "2 Planning", step: "3", action: "Request the kick-off by email; confirm whether end users will attend", deliverable: "Meeting request; attendance confirmed", responsible: "Project lead", submission: "Not required" },
  { phase: "2 Planning", step: "3.1", action: "Verify calendar availability for all attendees", deliverable: "Confirmed diary slot", responsible: "Project lead", submission: "Not required" },
  { phase: "2 Planning", step: "4", action: "Hold the kick-off and produce the project charter", deliverable: "Project charter (department template)", responsible: "Project lead", submission: "Not yet due" },
  { phase: "2 Planning", step: "4.2", action: "Confirm next steps in writing", deliverable: "Minutes on the departmental template", responsible: "Project manager", submission: "Not yet due" },
  { phase: "2 Planning", step: "4.3", action: "Request the departmental onboarding pack", deliverable: "Onboarding pack received", responsible: "Project manager", submission: "Not required" },
  { phase: "2 Planning", step: "5", action: "Hold the internal documentation briefing; produce the project plan", deliverable: "Project plan workbook", responsible: "Project manager", submission: "Not yet due" },
  { phase: "2 Planning", step: "5.1", action: "Set up internal workflows and the team onboarding pack", deliverable: "Internal workflow pack", responsible: "Project lead", submission: "Not required" },
  { phase: "3 Requirements", step: "4.1", action: "Request the client's existing workflows, SOPs and reports", deliverable: "Source material pack", responsible: "Business analyst", submission: "Not required" },
  { phase: "3 Requirements", step: "6", action: "Draft the requirements documentation and issue it for completion", deliverable: "Template 01, first draft", responsible: "Business analyst", submission: "Not yet due" },
  { phase: "3 Requirements", step: "6.1", action: "Hold the requirements session with the IT team and end users", deliverable: "Session minutes", responsible: "Project lead", submission: "Not yet due" },
  { phase: "3 Requirements", step: "6.2", action: "Complete and sign off the requirements", deliverable: "Template 01, signed", responsible: "Project manager", submission: "Not yet due" },
  { phase: "4 Front-end development", step: "7", action: "Build the workflows needed for the front-end demo", deliverable: "Demo build and user guide", responsible: "Front-end developer", submission: "Not required" },
  { phase: "4 Front-end development", step: "8", action: "Run the internal demo and fix what it exposes", deliverable: "Internal demo note; defect list", responsible: "Project lead", submission: "Not required" },
  { phase: "4 Front-end development", step: "8.1", action: "Begin the technical design document as the architecture settles", deliverable: "Template 02, first draft", responsible: "Project lead", submission: "Not yet due" },
  { phase: "5 Client demo 1", step: "9", action: "Arrange the demo: calendars, demo script, plan", deliverable: "Demo internal training", responsible: "Project manager", submission: "Not required" },
  { phase: "5 Client demo 1", step: "10", action: "Hold the client demo session; capture bugs and new requirements", deliverable: "Client demo session, create notes; change list", responsible: "Project lead", submission: "Not yet due" },
  { phase: "5 Client demo 1", step: "11", action: "Open the change and release register and record everything arising", deliverable: "Template 09, opened", responsible: "Project manager", submission: "Not yet due" },
  { phase: "6 Environment and access", step: "12.1", action: "Submit the Tech Stack Form and obtain written approval", deliverable: "Appendix B, approved", responsible: "Project lead", submission: "Not yet due" },
  { phase: "6 Environment and access", step: "12.2", action: "Submit the Cloud Provisioning Form with resources and cost", deliverable: "Appendix C, approved", responsible: "Project lead", submission: "Not yet due" },
  { phase: "6 Environment and access", step: "12.3", action: "Submit a User Form for every individual needing access", deliverable: "Appendix A, one per person", responsible: "Project manager", submission: "Not yet due" },
  { phase: "6 Environment and access", step: "12.4", action: "Request Azure access formally in writing", deliverable: "Access request", responsible: "Project manager", submission: "Not yet due" },
  { phase: "6 Environment and access", step: "13", action: "Set up the environments once provisioned and configure the pipeline", deliverable: "DEV, TEST and PROD; pipeline", responsible: "Back-end developer", submission: "Not required" },
  { phase: "7 Publish and test", step: "14", action: "Push the changes and create the test link on the departmental environment", deliverable: "Working test link", responsible: "Front-end developer", submission: "Not required" },
  { phase: "7 Publish and test", step: "15", action: "Send the test link with the end-user how-to guide", deliverable: "Template 05, first draft", responsible: "Project manager", submission: "Not yet due" },
  { phase: "7 Publish and test", step: "16", action: "Hold the second demonstration as a how-to session; log every change", deliverable: "Demo minutes; register updated", responsible: "Project lead", submission: "Not yet due" },
  { phase: "7 Publish and test", step: "17", action: "Apply the changes and send the updated test link", deliverable: "Updated release; email record", responsible: "Front-end developer", submission: "Not required" },
  { phase: "7 Publish and test", step: "18", action: "Complete the UAT record with test scenarios and issue it", deliverable: "Template 07 and Annexure A", responsible: "Tester / QA", submission: "Not yet due" },
  { phase: "7 Publish and test", step: "18.1", action: "Update the register, apply changes, confirm in writing", deliverable: "Register updated; confirmation", responsible: "Project manager", submission: "Not yet due" },
  { phase: "7 Publish and test", step: "18.2", action: "Obtain UAT sign-off against a named release version", deliverable: "Signed UAT record", responsible: "Project manager", submission: "Not yet due" },
  { phase: "8 Back-end development", step: "8.1", action: "Appoint the back-end developer and brief them on the signed requirements and UAT round 1", deliverable: "Developer appointed; briefing note", responsible: "Director", submission: "Not required" },
  { phase: "8 Back-end development", step: "8.2", action: "Confirm what the back end must satisfy, including the rules the front end assumed", deliverable: "Confirmed back-end scope", responsible: "Back-end developer", submission: "Not required" },
  { phase: "8 Back-end development", step: "8.3", action: "Update the technical design document as the data model, API and authorisation take shape", deliverable: "Template 02 Parts A, B and C updated", responsible: "Back-end developer", submission: "Not yet due" },
  { phase: "8 Back-end development", step: "8.4", action: "Build the back end: data model, business rules, server-side authorisation, data scoping", deliverable: "Back-end build in DEV", responsible: "Back-end developer", submission: "Not required" },
  { phase: "8 Back-end development", step: "8.5", action: "Integrate the front end and replace placeholder or mock data", deliverable: "Integrated build", responsible: "Back-end developer", submission: "Not required" },
  { phase: "8 Back-end development", step: "8.6", action: "Run internal testing: functional, integration, regression and security", deliverable: "Internal test results; defect list", responsible: "Tester / QA", submission: "Not required" },
  { phase: "8 Back-end development", step: "8.7", action: "Draft the security documentation as the authorisation model settles", deliverable: "Template 03, first draft", responsible: "Back-end developer", submission: "Not yet due" },
  { phase: "8 Back-end development", step: "8.8", action: "Promote the integrated build from DEV to TEST through the pipeline", deliverable: "Release in departmental TEST", responsible: "Back-end developer", submission: "Not required" },
  { phase: "8 Back-end development", step: "8.9", action: "Issue the updated test link and hold the integrated demonstration", deliverable: "Demo minutes; register updated", responsible: "Project lead", submission: "Not yet due" },
  { phase: "8 Back-end development", step: "8.10", action: "Run UAT round 2 on the integrated solution, exercising the back end and not only the screens", deliverable: "Template 07 and Annexure A, round 2", responsible: "Tester / QA", submission: "Not yet due" },
  { phase: "8 Back-end development", step: "8.11", action: "Resolve blocking defects, retest, obtain sign-off on the integrated release", deliverable: "Signed UAT record; register updated", responsible: "Project manager", submission: "Not yet due" },
  { phase: "9 Final deployment", step: "9.1", action: "Submit the deployment plan with domain, DNS and certificate requirements", deliverable: "Template 04 Annexure A", responsible: "Project lead", submission: "Not yet due" },
  { phase: "9 Final deployment", step: "9.2", action: "Obtain independent departmental release authorisation", deliverable: "Written authorisation", responsible: "Project manager", submission: "Not yet due" },
  { phase: "9 Final deployment", step: "9.3", action: "Deploy to production and verify after the event", deliverable: "Verified production release", responsible: "Back-end developer", submission: "Not required" },
  { phase: "9 Final deployment", step: "9.4", action: "Close the change record with the resulting production version", deliverable: "Register closed for the release", responsible: "Project manager", submission: "Not yet due" },
  { phase: "9 Final deployment", step: "9.5", action: "Submit the remaining documentation set", deliverable: "Templates 02, 03, 04, 05 and 08", responsible: "Project manager", submission: "Not yet due" },
  { phase: "10 Training and support", step: "10.1", action: "Create the full training material, including how-to videos to the production standards", deliverable: "Template 06 and materials", responsible: "Trainer", submission: "Not yet due" },
  { phase: "10 Training and support", step: "10.2", action: "Request and hold the skills transfer session with the departmental technical team", deliverable: "Knowledge transfer record", responsible: "Project lead", submission: "Not yet due" },
  { phase: "10 Training and support", step: "10.3", action: "Begin support and maintenance", deliverable: "Support commences", responsible: "Project manager", submission: "Not required" },
  { phase: "10 Training and support", step: "10.4", action: "Produce the monthly report every month for the contracted period", deliverable: "Monthly Report, Parts A to D", responsible: "Project manager", submission: "Not yet due" },
  { phase: "10 Training and support", step: "10.5", action: "Begin closure three months before contract end: final report and full documentation", deliverable: "Close-out report", responsible: "Project manager", submission: "Not yet due" }
];

export const SUBMISSIONS_TEMPLATE: SubmissionTemplateRow[] = [
  { phase: "2", submission: "Project charter", template: "Own format, per the TOR", signedBy: "Both parties", owner: "Project manager" },
  { phase: "2", submission: "Kick-off minutes", template: "Meeting Minutes Template", signedBy: "Chair and minute taker", owner: "Project manager" },
  { phase: "2", submission: "Draft project plan", template: "Departmental project plan workbook", signedBy: "Departmental approval", owner: "Project manager" },
  { phase: "3", submission: "System requirements specification", template: "Template 01", signedBy: "Both parties", owner: "Business analyst" },
  { phase: "4", submission: "Technical design document, first draft", template: "Template 02", signedBy: "Provider", owner: "Project lead" },
  { phase: "5", submission: "Change and release register, opened", template: "Template 09", signedBy: "Provider, reviewed", owner: "Project manager" },
  { phase: "6", submission: "User form, one per person", template: "Appendix A", signedBy: "Provider", owner: "Project manager" },
  { phase: "6", submission: "Tech stack form", template: "Appendix B", signedBy: "Directorate decision", owner: "Project lead" },
  { phase: "6", submission: "Cloud provisioning form", template: "Appendix C", signedBy: "Directorate decision", owner: "Project lead" },
  { phase: "7", submission: "User and administrator guide, draft", template: "Template 05", signedBy: "Provider", owner: "Trainer" },
  { phase: "7", submission: "Test evidence and UAT record, round 1", template: "Template 07 and Annexure A", signedBy: "Departmental users", owner: "Tester / QA" },
  { phase: "8", submission: "Technical design document, updated", template: "Template 02", signedBy: "Provider", owner: "Back-end developer" },
  { phase: "8", submission: "Security documentation, first draft", template: "Template 03", signedBy: "Provider", owner: "Back-end developer" },
  { phase: "8", submission: "Test evidence and UAT record, round 2", template: "Template 07 and Annexure A", signedBy: "Departmental users", owner: "Tester / QA" },
  { phase: "9", submission: "Deployment plan", template: "Template 04 Annexure A", signedBy: "Change authority", owner: "Project lead" },
  { phase: "9", submission: "Technical design document, final", template: "Template 02", signedBy: "Both parties", owner: "Project lead" },
  { phase: "9", submission: "Security documentation, final", template: "Template 03", signedBy: "Both parties", owner: "Back-end developer" },
  { phase: "9", submission: "Operations and support manual", template: "Template 04", signedBy: "Both parties", owner: "Project lead" },
  { phase: "10", submission: "Training and knowledge transfer record", template: "Template 06", signedBy: "Both parties", owner: "Trainer" },
  { phase: "10", submission: "Handover and conformance record", template: "Template 08", signedBy: "Technical team", owner: "Project lead" },
  { phase: "10", submission: "Monthly report, every month", template: "Monthly Report Template", signedBy: "Both parties", owner: "Project manager" },
  { phase: "10", submission: "Close-out report", template: "Per the standard", signedBy: "Both parties", owner: "Project manager" }
];
