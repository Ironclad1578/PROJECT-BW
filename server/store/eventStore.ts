// Simple pluggable in-memory event store with idempotency by (jobId,id)

import type { AnyDomainEvent } from '../domain/events';

export interface AppendResult {
  appended: number;
  duplicateIds: string[];
}
export interface EventStore {
  append(jobId: string, events: AnyDomainEvent[]): Promise<AppendResult>;
  load(jobId: string): Promise<AnyDomainEvent[]>;
  loadSince(jobId: string, sinceSeq: number): Promise<{ seq: number; events: AnyDomainEvent[] }>;
}

type SeqEvent = AnyDomainEvent & { __seq: number };

export class InMemoryEventStore implements EventStore {
  private streams = new Map<string, SeqEvent[]>();
  private seen = new Set<string>(); // idempotency key: `${jobId}:${eventId}`
  private seqCounter = 0;

  async append(jobId: string, events: AnyDomainEvent[]): Promise<AppendResult> {
    const stream = this.streams.get(jobId) ?? [];
    const duplicateIds: string[] = [];
    let appended = 0;

    for (const ev of events) {
      const key = `${jobId}:${ev.id}`;
      if (this.seen.has(key)) { duplicateIds.push(ev.id); continue; }
      this.seen.add(key);
      stream.push({ ...ev, __seq: ++this.seqCounter });
      appended++;
    }
    this.streams.set(jobId, stream);
    return { appended, duplicateIds };
  }

  async load(jobId: string): Promise<AnyDomainEvent[]> {
    return (this.streams.get(jobId) ?? []).slice().sort((a,b)=>a.__seq-b.__seq);
  }

  async loadSince(jobId: string, sinceSeq: number) {
    const all = (this.streams.get(jobId) ?? []).filter(e => e.__seq > sinceSeq).sort((a,b)=>a.__seq-b.__seq);
    const maxSeq = all.length ? all[all.length-1].__seq : sinceSeq;
    return { seq: maxSeq, events: all };
  }
}

export const eventStore: EventStore = new InMemoryEventStore();
