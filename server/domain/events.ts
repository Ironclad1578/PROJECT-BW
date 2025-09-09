// Canonical domain event definitions (runtime-agnostic, versioned)

export type UUID = string;

export type EventVersion = 1;

export interface BaseEvent<T extends string = string, P = unknown> {
  id: UUID;                  // idempotency key for the event
  type: T;                   // e.g., 'JobStatusChanged'
  occurredAt: string;        // ISO timestamp
  tenantId: string;
  jobId: string;
  version: EventVersion;
  payload: P;
  meta?: Record<string, unknown>;
}

/** Core job engine events (additive evolvable list) */
export type JobStatusChanged = BaseEvent<'JobStatusChanged', {
  from?: string;
  to: string;
  reason?: string;
  intent?: string;
}>;

export type SLAEvent =
  | BaseEvent<'SLA_RESPOND_IMMINENT'>
  | BaseEvent<'SLA_RESPOND_BREACHED'>
  | BaseEvent<'SLA_DUE_IMMINENT'>
  | BaseEvent<'SLA_DUE_BREACHED'>;

export type CommercialEvent =
  | BaseEvent<'COMMERCIAL_SUBMITTED', { kind: 'Quote'|'Variation'|'Uplift' }>
  | BaseEvent<'COMMERCIAL_APPROVED',  { kind: 'Quote'|'Variation'|'Uplift' }>
  | BaseEvent<'COMMERCIAL_REJECTED',  { kind: 'Quote'|'Variation'|'Uplift' }>
  | BaseEvent<'COMMERCIAL_QUERIED',   { kind: 'Quote'|'Variation'|'Uplift' }>
  | BaseEvent<'COMMERCIAL_RESUBMITTED',{ kind: 'Quote'|'Variation'|'Uplift' }>
  | BaseEvent<'WORKS_ORDER_ISSUED'>;

export type WorksOrderEvent =
  | BaseEvent<'WO_VERIFIED'>
  | BaseEvent<'WO_VISIT_NO_ACCESS'>;

export type PermitEvent =
  | BaseEvent<'PTW_APPROVED'>
  | BaseEvent<'PTW_REJECTED'>
  | BaseEvent<'PTW_EXPIRED'>;

export type MaterialsEvent = BaseEvent<'MATERIALS_RECEIVED'>;

export type InvoiceEvent =
  | BaseEvent<'INVOICE_DISPUTED'>
  | BaseEvent<'INVOICE_RESOLVED'>;

export type IncidentEvent =
  | BaseEvent<'INCIDENT_LOGGED'>
  | BaseEvent<'INCIDENT_RESOLVED'>;

export type EvidenceEvent =
  | BaseEvent<'DOCS_COMPLETE'>;

export type QAEvent =
  | BaseEvent<'QA_REVIEW_PASSED'>
  | BaseEvent<'QA_REVIEW_REWORK', { notes?: string }>;

export type ComplianceEvent =
  | BaseEvent<'CERT_IMMINENT', { name: string }>
  | BaseEvent<'CERT_EXPIRED',  { name: string }>;

export type RatesEvent =
  | BaseEvent<'RATES_UPDATED', { net:number; tax:number; gross:number }>;

export type RetentionEvent =
  | BaseEvent<'RETENTION_ARCHIVED'>
  | BaseEvent<'RETENTION_PURGED'>;

export type TimerScheduled =
  BaseEvent<'TIMER_SCHEDULED', { timerId: UUID; fireAt: string; kind: string; payload?: unknown }>;
export type TimerFired =
  BaseEvent<'TIMER_FIRED', { timerId: UUID; kind: string; payload?: unknown }>;

export type AnyDomainEvent =
  | JobStatusChanged
  | SLAEvent
  | CommercialEvent
  | WorksOrderEvent
  | PermitEvent
  | MaterialsEvent
  | InvoiceEvent
  | IncidentEvent
  | EvidenceEvent
  | QAEvent
  | ComplianceEvent
  | RatesEvent
  | RetentionEvent
  | TimerScheduled
  | TimerFired;

/** Helpers */
export function nowIso() { return new Date().toISOString(); }
