// PATH: src/machines/documentSetMachine.ts
import { createMachine, assign, sendParent } from 'xstate';

interface Ctx {
  before: number;
  after: number;
  minBefore: number;
  minAfter: number;
  needSignoff: boolean;
  requiredCerts: string[];
  signoff: boolean;
}

type Ev =
  | { type: 'CONFIG'; minBefore: number; minAfter: number; needSignoff: boolean; requiredCerts?: string[] }
  | { type: 'PHOTO_ADDED'; when: 'before' | 'after' }
  | { type: 'SIGNOFF_OBTAINED' }
  | { type: 'RESET' };

const meetsPhotoThresholds = (ctx: Ctx) =>
  ctx.before >= ctx.minBefore && ctx.after >= ctx.minAfter;

const docsComplete = (ctx: Ctx) =>
  meetsPhotoThresholds(ctx) && (ctx.needSignoff ? ctx.signoff : true);

export const documentSetMachine = createMachine<Ctx, Ev>({
  id: 'documentSet',
  initial: 'Collecting',
  context: {
    before: 0,
    after: 0,
    minBefore: 0,
    minAfter: 0,
    needSignoff: false,
    requiredCerts: [],
    signoff: false,
  },
  states: {
    Collecting: {
      always: [
        {
          cond: docsComplete,
          target: 'Complete',
          actions: sendParent({ type: 'DOCS_COMPLETE' } as any), // âœ… real action, not a lambda
        },
      ],
      on: {
        CONFIG: {
          actions: assign((_ctx, e) => ({
            minBefore: e.minBefore,
            minAfter: e.minAfter,
            needSignoff: e.needSignoff,
            requiredCerts: e.requiredCerts ?? [],
          })),
        },
        PHOTO_ADDED: {
          actions: assign((ctx, e) => {
            if (e.when === 'before') return { before: ctx.before + 1 };
            return { after: ctx.after + 1 };
          }),
        },
        SIGNOFF_OBTAINED: { actions: assign({ signoff: (_: Ctx) => true }) },
        RESET: {
          actions: assign((_ctx) => ({
            before: 0,
            after: 0,
            signoff: false,
          })),
        },
      },
    },
    Complete: {
      on: {
        RESET: {
          target: 'Collecting',
          actions: assign((_ctx) => ({
            before: 0,
            after: 0,
            signoff: false,
          })),
        },
      },
    },
  },
});
