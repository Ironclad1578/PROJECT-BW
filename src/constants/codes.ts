/* ---------- Intents (not states) ---------- */
export type JobIntent = 'New'|'FollowOn'|'Emergency'|'Reactive'|'Planned'|'Warranty'|'FollowOnWorks';
export const INTENT_LABELS: Record<JobIntent,string> = {
  New:'New Request', FollowOn:'Follow on Request', Emergency:'Emergency Order',
  Reactive:'Reactive Request', Planned:'Planned', Warranty:'Warranty', FollowOnWorks:'Follow-On Works',
};

/* ---------- Statuses ---------- */
export type JobStatus =
  | 'Draft' | 'Triage' | 'Assigned' | 'Scheduled' | 'OnSite'
  | 'AwaitingReport' | 'AwaitingApproval' | 'InProgress'
  | 'Complete' | 'Closed';

/* ---------- Hold / Cancel reasons ---------- */
export type HoldReason = 'AwaitingParts'|'AwaitingClient'|'AwaitingAccess'|'Weather'|'Other';
export type CancelReason = 'Duplicate'|'ClientCancelled'|'OutOfScope'|'NoAccess'|'Other';

/* ---------- Priority codes (P0..P10) ---------- */
export type PriorityCode = 'P0'|'P1'|'P2'|'P3'|'P4'|'P5'|'P6'|'P7'|'P8'|'P9'|'P10';

export const PRIORITIES: Record<PriorityCode, {
  label: string; defaultIntent: JobIntent;
  respondSLAHours?: number; dueSLADays?: number; oohMultiplier?: number;
}> = {
  P0:{ label:'Quotation Required', defaultIntent:'New',       respondSLAHours:24,  dueSLADays:7 },
  P1:{ label:'Emergency',          defaultIntent:'Emergency', respondSLAHours:4,   dueSLADays:1, oohMultiplier:1.5 },
  P2:{ label:'Reactive',           defaultIntent:'Reactive',  respondSLAHours:48,  dueSLADays:7 },
  P3:{ label:'Planned',            defaultIntent:'Planned',   respondSLAHours:72,  dueSLADays:14 },
  P4:{ label:'Warranty/Recall',    defaultIntent:'Warranty',  respondSLAHours:48,  dueSLADays:7 },
  P5:{ label:'Compliance/Cert',    defaultIntent:'Planned',   respondSLAHours:72,  dueSLADays:30 },
  P6:{ label:'Void/Turnaround',    defaultIntent:'Planned',   respondSLAHours:72,  dueSLADays:14 },
  P7:{ label:'Project/Capital',    defaultIntent:'Planned',   respondSLAHours:120, dueSLADays:60 },
  P8:{ label:'Inspection/Survey',  defaultIntent:'New',       respondSLAHours:72,  dueSLADays:14 },
  P9:{ label:'Follow-On/Variation',defaultIntent:'FollowOn',  respondSLAHours:48,  dueSLADays:7 },
  P10:{label:'Service/PPM',        defaultIntent:'Planned',   respondSLAHours:72,  dueSLADays:30 },
};
