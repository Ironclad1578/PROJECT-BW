import type { OutboxItem } from '../outbox/outboxStore';
import { counters } from '../observability/metrics';

export async function push(item: OutboxItem) {
  const name = (item.payload as any)?.name ?? 'custom_metric';
  counters.outbox_delivered.inc({ type: item.type, name });
}
