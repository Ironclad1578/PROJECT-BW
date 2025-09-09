// Durable timer worker: converts due timers into domain events
import { timerStore } from './timerStore';
import { eventStore } from '../store/eventStore';
import { nowIso } from '../domain/events';
import { v4 as uuid } from 'uuid';

export async function tickTimers(limit = 100) {
  const due = timerStore.due().slice(0, limit);
  for (const t of due) {
    const ev = {
      id: uuid(),
      type: t.kind as any,
      occurredAt: nowIso(),
      tenantId: t.tenantId,
      jobId: t.jobId,
      version: 1 as const,
      payload: (t.payload ?? {}),
    };
    await eventStore.append(t.jobId, [ev]);
    timerStore.markFired(t.id);
  }
  return due.length;
}
