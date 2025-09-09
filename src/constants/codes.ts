// PATH: src/constants/codes.ts
/* ---------- High-level Intents (not states) ---------- */
export type JobIntent =
  | 'New'
  | 'FollowOn'
  | 'Emergency'
  | 'Reactive'
  | 'Planned'
  | 'Warranty'
  | 'FollowOnWorks';

export const INTENT_LABELS: Record<JobIntent, string> = {
  New: 'New Request',
  FollowOn: 'Follow on Request',
  Emergency: 'Emergency Order',
  Reactive: 'Reactive Request',
  Planned: 'Planned Maintenance',
  Warranty: 'Warranty/Recall',
  FollowOnWorks: 'Follow on Works',
};

/* ---------- P-codes ---------- */
export type RequestCode =
  | 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9' | 'P10';

export const CODEBOOK: Record<RequestCode, {
  label: string;
  defaultIntent?: JobIntent;
  respondSLAHours?: number;
  dueSLADays?: number;
  oohMultiplier?: number;
}> = {
  P0: { label: 'Quotation Required', defaultIntent: 'New',       respondSLAHours: 24,  dueSLADays: 7  },
  P1: { label: 'Emergency',          defaultIntent: 'Emergency', respondSLAHours: 4,   dueSLADays: 1,  oohMultiplier: 1.5 },
  P2: { label: 'Reactive',           defaultIntent: 'Reactive',  respondSLAHours: 48,  dueSLADays: 7  },
  P3: { label: 'Planned',            defaultIntent: 'Planned',   respondSLAHours: 72,  dueSLADays: 14 },
  P4: { label: 'Warranty/Recall',    defaultIntent: 'Warranty',  respondSLAHours: 48,  dueSLADays: 7  },
  P5: { label: 'Compliance/Cert',    defaultIntent: 'Planned',   respondSLAHours: 72,  dueSLADays: 30 },
  P6: { label: 'Void/Turnaround',    defaultIntent: 'Planned',   respondSLAHours: 72,  dueSLADays: 14 },
  P7: { label: 'Project/Capital',    defaultIntent: 'Planned',   respondSLAHours: 120, dueSLADays: 60 },
  P8: { label: 'Inspection/Survey',  defaultIntent: 'New',       respondSLAHours: 72,  dueSLADays: 14 },
  P9: { label: 'Follow-On/Variation',defaultIntent: 'FollowOn',  respondSLAHours: 48,  dueSLADays: 7  },
  P10:{ label: 'Service/PPM',        defaultIntent: 'Planned',   respondSLAHours: 72,  dueSLADays: 30 },
};

/* ---------- Roles & Channels ---------- */
export type Role =
  | 'Admin' | 'Employee' | 'ClientOwner' | 'ClientAgent'
  | 'Contractor' | 'Engineer' | 'Tenant';

export type Channel = 'BW_Internal' | 'Client' | 'Contractor' | 'Tenant';

/* ---------- Job Super-state ---------- */
export type JobStatus =
  | 'Draft' | 'Triage' | 'Assigned' | 'Scheduled' | 'OnSite'
  | 'AwaitingReport' | 'AwaitingApproval' | 'InProgress'
  | 'Complete' | 'Closed' | 'OnHold' | 'Cancelled';

/* ---------- Commercial Items ---------- */
export type WorkItemKind = 'Quote' | 'Variation' | 'Uplift';

export type WorkItemStatus =
  | 'Required' | 'Drafted' | 'Confirmed' | 'Submitted'
  | 'AwaitingClientApproval' | 'AwaitingBWApproval'
  | 'Queried' | 'PendingResubmission' | 'Resubmitted'
  | 'Approved' | 'Rejected' | 'Issued';

/* ---------- Works Orders & Visits ---------- */
export type WorksOrderStatus = 'Issued' | 'Scheduled' | 'InProgress' | 'Completed' | 'Verified';
export type VisitStatus = 'Planned' | 'EnRoute' | 'OnSite' | 'LeftSite' | 'NoAccess';
export type VisitOutcome = 'Done' | 'Partial' | 'NoAccess' | 'Unsafe' | 'Aborted';

/* ---------- Permits / RAMS ---------- */
export type PermitStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Expired';
export type RAMSStatus   = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

/* ---------- Materials ---------- */
export type MaterialsStatus = 'Needed' | 'Sourced' | 'Ordered' | 'Received' | 'NotAvailable';

/* ---------- Billing ---------- */
export type InvoiceStatus = 'Draft' | 'Issued' | 'PartPaid' | 'Paid' | 'Overdue' | 'Disputed' | 'Resolved';

/* ---------- Incidents ---------- */
export type IncidentStatus = 'Logged' | 'Investigating' | 'Resolved';
export type IncidentType =
  | 'NearMiss' | 'Injury' | 'PropertyDamage' | 'Environmental' | 'Security' | 'Other';

/* ---------- Hold/Cancel Reasons ---------- */
export type HoldReason =
  | 'AwaitingClientApproval' | 'AwaitingTenantAccess' | 'AwaitingParts' | 'UnsafeSite'
  | 'Weather' | 'PermitRejected' | 'AccountOnStop' | 'HSIncident' | 'EngineerEligibility' | 'Billing'
  | 'Compliance'  | 'ClientUnavailable'  | 'FinanceHold';
export type CancelReason =
  | 'ClientWithdrawn' | 'Duplicate' | 'WrongAddress' | 'WarrantyRedirect'
  | 'OutOfScope' | 'NoAuthority' | 'FraudSuspected' | 'Other';

/* ---------- Small helpers ---------- */
export const nowIso = () => new Date().toISOString();
