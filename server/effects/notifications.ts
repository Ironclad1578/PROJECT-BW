import type { OutboxItem } from '../outbox/outboxStore';
import { auditLog } from '../observability/auditLog';

export async function deliver(item: OutboxItem) {
  // Send email/SMS/push; we just record to audit for this skeleton
  await auditLog.append({
    tenantId: item.tenantId,
    jobId: item.jobId,
    type: 'Notification',
    message: 'Notification delivered',
    payload: item.payload,
    at: new Date().toISOString(),
  });
}

export async function webhook(item: OutboxItem) {
  await auditLog.append({
    tenantId: item.tenantId,
    jobId: item.jobId,
    type: 'Webhook',
    message: 'Webhook called',
    payload: item.payload,
    at: new Date().toISOString(),
  });
}
