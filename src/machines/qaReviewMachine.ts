// PATH: src/machines/qaReviewMachine.ts
import { createMachine, sendParent } from 'xstate';

interface Ctx { id: string; jobId: string; reviewerId?: string; notes?: string; }
type Ev =
  | { type: 'ASSIGN_REVIEWER'; reviewerId: string }
  | { type: 'PASS' }
  | { type: 'REWORK'; notes?: string };

export const qaReviewMachine = (seed: Partial<Ctx>) =>
  createMachine<Ctx, Ev>({
    id: `qa:${seed.id ?? 'new'}`,
    context: { id: seed.id ?? 'temp', jobId: seed.jobId ?? '' },
    initial: 'Pending',
    states: {
      Pending: {
        on: {
          ASSIGN_REVIEWER: { actions: (_c, _e:any)=> { /* trace hook if needed */ } },
          PASS:   { target: 'Accepted', actions: sendParent({ type: 'QA_REVIEW_PASSED' }) },
          REWORK: { target: 'Rework',  actions: sendParent((_, e:any)=> ({ type: 'QA_REVIEW_REWORK', notes: e.notes })) },
        },
      },
      Accepted: { type: 'final' },
      Rework:   { type: 'final' },
    },
  });
