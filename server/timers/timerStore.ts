// PATH: server/timers/timerStore.ts
import { v4 as uuid } from 'uuid';

export interface Timer {
  id: string;
  tenantId: string;
  jobId: string;
  kind: string;
  fireAt: number; // epoch ms
  payload?: unknown;
  fired?: boolean;
}

class InMemoryTimerStore {
  private timers: Timer[] = [];

  schedule(input: Omit<Timer, 'id' | 'fired'>) {
    const t: Timer = { id: uuid(), fired: false, ...input };
    this.timers.push(t);
    return t.id;
  }

  due() {
    const now = Date.now();
    return this.timers.filter(t => !t.fired && t.fireAt <= now);
  }

  markFired(id: string) {
    const t = this.timers.find(x => x.id === id);
    if (t) t.fired = true;
  }
}

export const timerStore = new InMemoryTimerStore();
