import type { AnyDomainEvent } from '../domain/events';
import type { JobSnapshot } from '../schemas/state.zod';

export function reduceToSnapshot(tenantId: string, jobId: string, events: AnyDomainEvent[]): JobSnapshot {
  let status = 'Draft';
  let intent: string | undefined;
  let updatedAt = new Date(0).toISOString();
  const data: Record<string, unknown> = { certImminent: [], certExpired: [], sla: [] };

  for (const ev of events) {
    updatedAt = ev.occurredAt;
    switch (ev.type) {
      case 'JobStatusChanged':
        status = ev.payload.to;
        intent = ev.payload.intent ?? intent;
        break;
      case 'CERT_IMMINENT':
        (data.certImminent as string[]).push((ev.payload as any).name);
        break;
      case 'CERT_EXPIRED':
        (data.certExpired as string[]).push((ev.payload as any).name);
        break;
      case 'SLA_RESPOND_IMMINENT':
      case 'SLA_RESPOND_BREACHED':
      case 'SLA_DUE_IMMINENT':
      case 'SLA_DUE_BREACHED':
        (data.sla as any[]).push({ type: ev.type, at: ev.occurredAt });
        break;
      default:
        // keep last-seen payload by type
        (data as any)[`last_${ev.type}`] = ev.payload ?? true;
    }
  }

  return { tenantId, jobId, status, intent, updatedAt, data };
}
