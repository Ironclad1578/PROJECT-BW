import { v4 as uuid } from 'uuid';

export type OutboxStatus = 'pending'|'running'|'succeeded'|'failed';
export interface OutboxItem {
  id: string;
  jobId: string;
  tenantId: string;
  type: 'activity'|'notification'|'metrics'|'webhook';
  payload: unknown;
  status: OutboxStatus;
  attempt: number;
  nextAttemptAt: number; // epoch ms
  createdAt: number;
  idempotencyKey?: string;
  name?: string; // metric tag
}

class InMemoryOutbox {
  private items: OutboxItem[] = [];

  add(partial: Partial<OutboxItem>) {
    const item: OutboxItem = {
      id: partial.id ?? uuid(),
      jobId: String(partial.jobId ?? 'unknown'),
      tenantId: String(partial.tenantId ?? 'default'),
      type: (partial.type ?? 'activity') as OutboxItem['type'],
      payload: partial.payload ?? {},
      status: 'pending',
      attempt: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      idempotencyKey: partial.idempotencyKey,
      name: partial.name,
    };
    this.items.push(item);
    return item.id;
  }

  claimDue(limit = 50) {
    const now = Date.now();
    const due = this.items.filter(i => i.status === 'pending' && i.nextAttemptAt <= now).slice(0, limit);
    for (const it of due) it.status = 'running';
    return due;
  }

  markSuccess(id: string) {
    const it = this.items.find(i => i.id === id);
    if (it) it.status = 'succeeded';
  }

  markFailure(id: string, backoffMs = 30_000) {
    const it = this.items.find(i => i.id === id);
    if (it) {
      it.status = 'pending';
      it.attempt += 1;
      it.nextAttemptAt = Date.now() + backoffMs * Math.min(8, it.attempt);
    }
  }
}

export const outbox = new InMemoryOutbox();
