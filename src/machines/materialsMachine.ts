// PATH: src/machines/materialsMachine.ts
import { createMachine, assign, sendParent } from 'xstate';
import { fakeApi } from '@/api/fakeApi';
import type { MaterialsStatus } from '@/constants/codes';

interface MaterialsContext {
  id: string;
  jobId: string;
  tenantId?: string;          // ← NEW: allows server event appends
  status: MaterialsStatus;
  expectedAt?: string;
}

type MaterialsEvents =
  | { type: 'SOURCE' }
  | { type: 'ORDER'; expectedAt?: string }
  | { type: 'RECEIVE' }
  | { type: 'NOT_AVAILABLE' };

export const materialsMachine = (seed: Partial<MaterialsContext>) =>
  createMachine<MaterialsContext, MaterialsEvents>({
    id: `materials:${seed.id ?? 'new'}`,
    context: {
      id: seed.id ?? 'temp',
      jobId: seed.jobId ?? '',
      tenantId: seed.tenantId,                              // ← NEW
      status: (seed.status ?? 'Needed') as MaterialsStatus,
      expectedAt: seed.expectedAt,
    },
    initial: (seed.status as any) ?? 'Needed',
    states: {
      Needed: {
        on: {
          SOURCE: {
            target: 'Sourced',
            actions: (ctx) => {
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'MaterialsSourced', payload: { materialsId: ctx.id } },
              ]);
            },
          },
        },
      },

      Sourced: {
        on: {
          ORDER: {
            target: 'Ordered',
            actions: [
              assign((_c, e: any) => ('expectedAt' in e ? { expectedAt: e.expectedAt } : {})),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'MaterialsOrdered',
                    payload: { materialsId: ctx.id, expectedAt: ctx.expectedAt },
                  },
                ]);
              },
            ],
          },
        },
      },

      Ordered: {
        on: {
          RECEIVE: {
            target: 'Received',
            actions: [
              sendParent({ type: 'MATERIALS_RECEIVED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'MaterialsReceived', payload: { materialsId: ctx.id } },
                ]);
              },
            ],
          },
        },
      },

      Received: { type: 'final' },

      NotAvailable: {},
    },

    // Global transition (works from any state)
    on: {
      NOT_AVAILABLE: {
        target: '.NotAvailable',
        actions: (ctx) => {
          if (!ctx.tenantId) return;
          void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
            { type: 'MaterialsNotAvailable', payload: { materialsId: ctx.id } },
          ]);
        },
      },
    },
  });
