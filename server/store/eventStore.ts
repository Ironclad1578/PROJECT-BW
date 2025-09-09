/// Simple pluggable in-memory event store with idempotency by (jobId,id)
import type { AnyDomainEvent } from '../domain/events';

export interface AppendResult { appended: number; duplicateIds: string[] }
export interface EventStore {
  append(jobId: string, events: AnyDomainEvent[]): Promise<AppendResult>;
  load(jobId: string): Promise<AnyDomainEvent[]>;
  loadSince(jobId: string, sinceSeq: number): Promise<{ seq: number; events: AnyDomainEvent[] }>;
}

type SeqEvent = AnyDomainEvent & { __seq: number };

class InMemoryEventStore implements EventStore {
  private streams = new Map<string, SeqEvent[]>();
  private idIndex = new Map<string, Set<string>>(); // jobId -> set(eventId)
  private seq = 0;

  async append(jobId: string, events: AnyDomainEvent[]): Promise<AppendResult> {
    const stream = this.streams.get(jobId) ?? [];
    const seen = this.idIndex.get(jobId) ?? new Set<string>();
    const dup: string[] = [];
    const toAppend: SeqEvent[] = [];

    for (const e of events) {
      if (seen.has(e.id)) { dup.push(e.id); continue; }
      this.seq += 1;
      toAppend.push(Object.assign({ __seq: this.seq }, e));
      seen.add(e.id);
    }

    if (toAppend.length) {
      stream.push(...toAppend);
      this.streams.set(jobId, stream);
      this.idIndex.set(jobId, seen);
    }
    return { appended: toAppend.length, duplicateIds: dup };
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
