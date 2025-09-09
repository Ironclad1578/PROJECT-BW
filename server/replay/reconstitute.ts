// Deterministic reconstitution of job snapshot from events
import type { AnyDomainEvent } from '../domain/events';
import type { JobSnapshot } from '../schemas/state.zod';

export function reduceToSnapshot(tenantId: string, jobId: string, events: AnyDomainEvent[]): JobSnapshot {
  let status = 'Draft';
  let intent: string | undefined;
  let updatedAt = new Date(0).toISOString();
  const data: Record<string, unknown> = {};

  for (const ev of events) {
    updatedAt = ev.occurredAt;
    switch (ev.type) {
      case 'JobStatusChanged':
        status = ev.payload.to;
        intent = ev.payload.intent ?? intent;
        break;
      case 'CERT_IMMINENT':
        data.certImminent = [...(data.certImminent as string[] ?? []), ev.payload.name];
        break;
      case 'CERT_EXPIRED':
        data.certExpired = [...(data.certExpired as string[] ?? []), ev.payload.name];
        break;
      case 'RATES_UPDATED':
        data.lastTotals = ev.payload;
        break;
      default:
        // keep additive map of last-seen per-event type if useful
        data[`last_${ev.type}`] = ev.payload ?? true;
    }
  }

  return { tenantId, jobId, status, intent, updatedAt, data };
}
