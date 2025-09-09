import { createMachine, assign, sendParent } from 'xstate';
import { fakeApi } from '@/api/fakeApi';
import type { VisitStatus, VisitOutcome } from '@/constants/codes';

interface VisitContext {
  id: string;
  worksOrderId: string;
  jobId?: string;       // optional: lets us append into the job’s stream
  tenantId?: string;    // NEW: required for server event appends
  status: VisitStatus;
  outcome?: VisitOutcome;
  plannedAt?: string;
  onSiteAt?: string;
  leftSiteAt?: string;
  gpsOk?: boolean;
}

type VisitEvents =
  | { type: 'PLAN'; at: string }
  | { type: 'EN_ROUTE' }
  | { type: 'ARRIVE'; gpsOk?: boolean }
  | { type: 'LEAVE' }
  | { type: 'NO_ACCESS' }
  | { type: 'SET_OUTCOME'; outcome: VisitOutcome };

export const visitMachine = (seed: Partial<VisitContext>) =>
  createMachine<VisitContext, VisitEvents>({
    id: `visit:${seed.id ?? 'new'}`,
    context: {
      id: seed.id ?? 'temp',
      worksOrderId: seed.worksOrderId ?? '',
      jobId: seed.jobId,
      tenantId: seed.tenantId,           // NEW
      status: (seed.status ?? 'Planned') as VisitStatus,
      plannedAt: seed.plannedAt,
      gpsOk: false,
    },
    initial: (seed.status as any) ?? 'Planned',
    states: {
      Planned: {
        on: {
          EN_ROUTE: 'EnRoute',
          PLAN: {
            actions: [
              assign((_ctx, e) => ('at' in e ? { plannedAt: e.at } : {})),
              (ctx, e: any) => {
                if (!ctx.tenantId) return;
                const streamId = ctx.jobId ?? ctx.worksOrderId;
                void fakeApi.events.append(ctx.tenantId, streamId, [
                  {
                    type: 'VisitPlanned',
                    payload: {
                      visitId: ctx.id,
                      worksOrderId: ctx.worksOrderId,
                      plannedAt: e.at,
                    },
                  },
                ]);
              },
            ],
          },
        },
      },

      EnRoute: {
        entry: (ctx) => {
          if (!ctx.tenantId) return;
          const streamId = ctx.jobId ?? ctx.worksOrderId;
          void fakeApi.events.append(ctx.tenantId, streamId, [
            { type: 'VisitEnRoute', payload: { visitId: ctx.id, worksOrderId: ctx.worksOrderId } },
          ]);
        },
        on: {
          ARRIVE: {
            target: 'OnSite',
            actions: [
              assign((_ctx, e) => ({
                onSiteAt: new Date().toISOString(),
                gpsOk: (e as any).gpsOk ?? false,
              })),
              (ctx, e: any) => {
                if (!ctx.tenantId) return;
                const streamId = ctx.jobId ?? ctx.worksOrderId;
                void fakeApi.events.append(ctx.tenantId, streamId, [
                  {
                    type: 'VisitArrived',
                    payload: {
                      visitId: ctx.id,
                      worksOrderId: ctx.worksOrderId,
                      at: ctx.onSiteAt,
                      gpsOk: e.gpsOk ?? false,
                    },
                  },
                ]);
              },
            ],
          },
          NO_ACCESS: 'NoAccess',
        },
      },

      OnSite: {
        on: {
          LEAVE: {
            target: 'LeftSite',
            actions: [
              assign((_ctx) => ({ leftSiteAt: new Date().toISOString() })),
              (ctx) => {
                if (!ctx.tenantId) return;
                const streamId = ctx.jobId ?? ctx.worksOrderId;
                void fakeApi.events.append(ctx.tenantId, streamId, [
                  {
                    type: 'VisitLeft',
                    payload: {
                      visitId: ctx.id,
                      worksOrderId: ctx.worksOrderId,
                      at: ctx.leftSiteAt,
                    },
                  },
                ]);
              },
            ],
          },
          NO_ACCESS: 'NoAccess',
          SET_OUTCOME: { actions: assign((_ctx, e) => ({ outcome: (e as any).outcome })) },
        },
      },

      LeftSite: { type: 'final' },

      NoAccess: {
        entry: [
          sendParent({ type: 'VISIT_NO_ACCESS' }),
          (ctx) => {
            if (!ctx.tenantId) return;
            const streamId = ctx.jobId ?? ctx.worksOrderId;
            void fakeApi.events.append(ctx.tenantId, streamId, [
              { type: 'VisitNoAccess', payload: { visitId: ctx.id, worksOrderId: ctx.worksOrderId } },
            ]);
          },
        ],
        type: 'final',
      },
    },
  });
