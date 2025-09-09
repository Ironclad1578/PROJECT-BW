import type { OutboxItem } from '../outbox/outboxStore';
import { auditLog } from '../observability/auditLog';
import { counters } from '../observability/metrics';

export async function write(item: OutboxItem) {
  await auditLog.append({
    tenantId: item.tenantId,
    jobId: item.jobId,
    type: 'Activity',
    message: 'Activity recorded',
    payload: item.payload,
    at: new Date().toISOString(),
  });
  counters.outbox_delivered.inc({ type: item.type, name: item.name ?? 'activity' });
}
