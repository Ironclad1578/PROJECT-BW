// PATH: src/machines/schedulerMachine.ts
import { createMachine, assign, sendParent } from 'xstate';

interface Ctx {
  windowStart?: string;
  windowEnd?: string;
  clashCount?: number;
  tenantConfirmed?: boolean;
}

type Ev =
  | { type: 'PROPOSE'; start: string; end: string; clashes?: number }
  | { type: 'CONFIRM_TENANT' }
  | { type: 'REJECT_SLOT'; reason?: string }
  | { type: 'RESCHEDULE' };

export const schedulerMachine = createMachine<Ctx, Ev>({
  id: 'scheduler',
  initial: 'idle',
  context: {},
  states: {
    idle: {
      on: {
        PROPOSE: {
          target: 'proposed',
          actions: assign((_c, e: any) => ({
            windowStart: e.start,
            windowEnd: e.end,
            clashCount: e.clashes ?? 0,
          })),
        },
      },
    },
    proposed: {
      // Fire conflict notification as a real XState action
      always: [
        {
          cond: (c) => (c.clashCount ?? 0) > 0,
          actions: sendParent({ type: 'SCHEDULE_CONFLICT' }),
        },
      ],
      on: {
        CONFIRM_TENANT: {
          target: 'confirmed',
          actions: [
            assign({ tenantConfirmed: () => true }),
            sendParent({ type: 'SCHEDULE_CONFIRMED' }),
          ],
        },
        REJECT_SLOT: { target: 'idle', actions: sendParent({ type: 'SCHEDULE_REJECTED' }) },
        RESCHEDULE: 'idle',
      },
    },
    confirmed: { type: 'final' },
  },
});
