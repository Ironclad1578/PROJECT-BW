// Durable outbox (in-memory impl)
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
}

export class InMemoryOutbox {
  private items: OutboxItem[] = [];
  add(item: Omit<OutboxItem, 'id' | 'status' | 'attempt' | 'createdAt' | 'nextAttemptAt'>) {
    const now = Date.now();
    const row: OutboxItem = {
      id: uuid(),
      status: 'pending',
      attempt: 0,
      createdAt: now,
      nextAttemptAt: now,
      ...item,
    };
    this.items.push(row);
    return row.id;
  }

  claimDue(limit = 50) {
    const now = Date.now();
    const due = this.items.filter(i => i.status === 'pending' && i.nextAttemptAt <= now).slice(0, limit);
    due.forEach(i => i.status = 'running');
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
