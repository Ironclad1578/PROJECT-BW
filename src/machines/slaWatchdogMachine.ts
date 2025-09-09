// PATH: src/machines/slaWatchdogMachine.ts
import { createMachine, assign, sendParent } from 'xstate';

interface Ctx {
  respondBy?: number;        // epoch ms
  dueBy?: number;            // epoch ms
  respondImminentMs: number; // e.g., 30 * 60 * 1000
  dueImminentMs: number;     // e.g., 60 * 60 * 1000
  paused: boolean;
}

type Ev =
  | { type: 'SET'; respondBy?: number; dueBy?: number; respondImminentMs: number; dueImminentMs: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' };

const msUntil = (at?: number) => Math.max(0, (at ?? 0) - Date.now());

export const slaWatchdogMachine = createMachine<Ctx, Ev>({
  id: 'slaWatchdog',
  initial: 'idle',
  context: {
    respondImminentMs: 30 * 60 * 1000,
    dueImminentMs: 60 * 60 * 1000,
    paused: false,
  },
  states: {
    idle: {
      on: {
        SET: {
          target: 'running',
          actions: assign((c, e: any) => ({
            respondBy: e.respondBy,
            dueBy: e.dueBy,
            respondImminentMs: e.respondImminentMs,
            dueImminentMs: e.dueImminentMs,
          })),
        },
      },
    },
    running: {
      // Leaving/re-entering this state cancels and reschedules these timers.
      after: [
        {
          delay: (c) => msUntil((c.respondBy ?? 0) - c.respondImminentMs),
          cond: (c) => !!c.respondBy,
          internal: true,
          actions: sendParent({ type: 'SLA_RESPOND_IMMINENT' }),
        },
        {
          delay: (c) => msUntil(c.respondBy),
          cond: (c) => !!c.respondBy,
          internal: true,
          actions: sendParent({ type: 'SLA_RESPOND_BREACHED' }),
        },
        {
          delay: (c) => msUntil((c.dueBy ?? 0) - c.dueImminentMs),
          cond: (c) => !!c.dueBy,
          internal: true,
          actions: sendParent({ type: 'SLA_DUE_IMMINENT' }),
        },
        {
          delay: (c) => msUntil(c.dueBy),
          cond: (c) => !!c.dueBy,
          internal: true,
          actions: sendParent({ type: 'SLA_DUE_BREACHED' }),
        },
      ],
      on: {
        // Re-enter to reschedule all timers with new values
        SET: {
          target: 'running',
          internal: false,
          actions: assign((c, e: any) => ({
            respondBy: e.respondBy,
            dueBy: e.dueBy,
            respondImminentMs: e.respondImminentMs,
            dueImminentMs: e.dueImminentMs,
          })),
        },
        PAUSE: { target: 'idle', actions: assign({ paused: () => true }) },
        RESUME: { target: 'running', actions: assign({ paused: () => false }) },
        CANCEL: { target: 'idle' },
      },
    },
  },
});
