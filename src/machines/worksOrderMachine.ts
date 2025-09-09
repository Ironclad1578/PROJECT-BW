import { createMachine, assign, spawn, sendParent } from 'xstate';
import { visitMachine } from './visitMachine';
import { fakeApi } from '@/api/fakeApi';

interface Ctx {
  id: string;
  jobId: string;
  tenantId?: string;                 // for server event appends
  issuedAt?: number;
  visits: Record<string, any>;
  verified: boolean;
}

type Ev =
  | { type: 'ISSUE' }
  | { type: 'ADD_VISIT'; id: string; payload?: any }
  | { type: 'PROPOSE_VISIT'; id: string; start: string; end: string }
  | { type: 'CONFIRM_VISIT'; id: string }
  | { type: 'NO_ACCESS'; id: string }
  | { type: 'VERIFY' }
  | { type: 'RESET_VERIFICATION' }
  // from child visits:
  | { type: 'VISIT_NO_ACCESS' };

export const worksOrderMachine = (seed: { id: string; jobId: string; tenantId?: string }) =>
  createMachine<Ctx, Ev>({
    id: `wo:${seed.id}`,
    initial: 'Draft',
    context: {
      id: seed.id,
      jobId: seed.jobId,
      tenantId: seed.tenantId,
      issuedAt: undefined,
      visits: {},
      verified: false,
    },
    states: {
      Draft: {
        on: {
          ISSUE: {
            target: 'Issued',
            actions: [
              assign({ issuedAt: (_: Ctx) => Date.now() }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'WorksOrderIssued', payload: { worksOrderId: ctx.id, issuedAt: Date.now() } },
                ]);
              },
            ],
          },
        },
      },

      Issued: {
        on: {
          ADD_VISIT: {
            actions: [
              assign((ctx, e) => {
                if (ctx.visits[e.id]) return ctx;
                const actor = spawn(
                  visitMachine({
                    id: e.id,
                    worksOrderId: ctx.id,
                    jobId: ctx.jobId,          // ← pass through for append stream
                    tenantId: ctx.tenantId,    // ← enables server events in visitMachine
                    ...(e.payload ?? {}),
                  }),
                  { name: `visit:${e.id}` }
                );
                return { visits: { ...ctx.visits, [e.id]: actor } };
              }),
              (ctx, e: any) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'VisitAdded', payload: { worksOrderId: ctx.id, visitId: e.id } },
                ]);
              },
            ],
          },

          PROPOSE_VISIT: {
            actions: [
              (ctx, e: any) => ctx.visits[e.id]?.send({ type: 'PLAN', at: e.start }),
              (ctx, e: any) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'VisitPlanned',
                    payload: { worksOrderId: ctx.id, visitId: e.id, windowStart: e.start, windowEnd: e.end },
                  },
                ]);
              },
            ],
          },

          // No native confirm in visitMachine; leave as a no-op (UI may drive EN_ROUTE/ARRIVE)
          CONFIRM_VISIT: { actions: (_ctx, _e) => {} },

          NO_ACCESS: {
            actions: (ctx, e: any) => ctx.visits[e.id]?.send({ type: 'NO_ACCESS' }),
          },

          VISIT_NO_ACCESS: {
            actions: [
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'WorksVisitNoAccess', payload: { worksOrderId: ctx.id } },
                ]);
              },
              sendParent({ type: 'WO_VISIT_NO_ACCESS' }),
            ],
          },

          VERIFY: {
            target: 'Verified',
            actions: assign({ verified: (_: Ctx) => true }),
          },
        },
      },

      Verified: {
        entry: [
          sendParent({ type: 'WO_VERIFIED' }),
          (ctx) => {
            if (!ctx.tenantId) return;
            void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
              { type: 'WorksOrderVerified', payload: { worksOrderId: ctx.id, verifiedAt: Date.now() } },
            ]);
          },
        ],
        on: {
          RESET_VERIFICATION: {
            target: 'Issued',
            actions: [
              assign({ verified: (_: Ctx) => false }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'WorksOrderVerificationReset', payload: { worksOrderId: ctx.id, at: Date.now() } },
                ]);
              },
            ],
          },
        },
      },
    },
  });
