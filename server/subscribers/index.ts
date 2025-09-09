// Event subscribers: translate domain events into outbox work/metrics/etc.
import type { AnyDomainEvent } from '../domain/events';
import { outbox } from '../outbox/outboxStore';
import { counters } from '../observability/metrics';

export async function handleEvent(ev: AnyDomainEvent) {
  counters.events_appended.inc({ type: ev.type });

  // Example fan-out
  if (ev.type === 'JobStatusChanged') {
    outbox.add({
      tenantId: ev.tenantId,
      jobId: ev.jobId,
      type: 'activity',
      payload: { message: `Status changed to ${ev.payload.to}`, meta: ev.payload },
    });
    outbox.add({
      tenantId: ev.tenantId,
      jobId: ev.jobId,
      type: 'notification',
      payload: { event: ev.type, meta: ev.payload },
    });
  }

  if (ev.type === 'CERT_IMMINENT' || ev.type === 'CERT_EXPIRED') {
    outbox.add({
      tenantId: ev.tenantId,
      jobId: ev.jobId,
      type: 'activity',
      payload: { message: `${ev.type.replace('_',' ').toLowerCase()}: ${(ev.payload as any).name}` },
    });
    outbox.add({
      tenantId: ev.tenantId,
      jobId: ev.jobId,
      type: 'metrics',
      payload: { name: ev.type.toLowerCase() },
    });
  }
}
