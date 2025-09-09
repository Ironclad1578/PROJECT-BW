import type { AnyDomainEvent } from '../domain/events';
import { outbox } from '../outbox/outboxStore';
import { counters } from '../observability/metrics';

export async function handleEvent(ev: AnyDomainEvent) {
  counters.events_appended.inc({ type: ev.type });

  if (ev.type === 'JobStatusChanged') {
    outbox.add({
      tenantId: ev.tenantId,
      jobId: ev.jobId,
      type: 'activity',
      name: 'status-change',
      payload: { message: `Status → ${ev.payload.to}`, meta: ev.payload },
    });
  }

  if (ev.type.startsWith('SLA_')) {
    outbox.add({
      tenantId: ev.tenantId,
      jobId: ev.jobId,
      type: 'metrics',
      name: ev.type.toLowerCase(),
      payload: { at: ev.occurredAt },
    });
  }

  if (ev.type.startsWith('CERT_')) {
    outbox.add({
      tenantId: ev.tenantId,
      jobId: ev.jobId,
      type: 'notification',
      name: 'compliance',
      payload: ev.payload,
    });
  }
}
