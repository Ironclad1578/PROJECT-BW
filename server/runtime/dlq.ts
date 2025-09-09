export type DLQItem = { id: string; tenantId: string; jobId?: string; reason: string; payload: unknown; at: string };
const items: DLQItem[] = [];

export function pushDLQ(item: DLQItem) { items.push(item); }
export function listDLQ(tenantId?: string) {
  return items.filter(i => !tenantId || i.tenantId===tenantId);
}
