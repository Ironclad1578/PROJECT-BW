// PATH: src/machines/incidentMachine.ts
import { createMachine, sendParent } from 'xstate';
import { fakeApi } from '@/api/fakeApi';
import type { IncidentStatus, IncidentType } from '@/constants/codes';

interface IncidentContext {
  id: string;
  jobId: string;
  tenantId?: string;             // â† NEW: to emit domain events server-side
  type: IncidentType;
  status: IncidentStatus;
}

type IncidentEvents =
  | { type: 'LOG' }
  | { type: 'INVESTIGATE' }
  | { type: 'RESOLVE' };

export const incidentMachine = (seed: Partial<IncidentContext>) =>
  createMachine<IncidentContext, IncidentEvents>({
    id: `incident:${seed.id ?? 'new'}`,
    context: {
      id: seed.id ?? 'temp',
      jobId: seed.jobId ?? '',
      tenantId: seed.tenantId,   // â† NEW
      type: (seed.type ?? 'Other') as IncidentType,
      status: (seed.status ?? 'Logged') as IncidentStatus,
    },
    initial: (seed.status as any) ?? 'Logged',
    states: {
      Logged: {
        entry: [
          // Parent signal (unchanged)
          sendParent({ type: 'INCIDENT_LOGGED' }),
          // Canonical domain event
          (ctx) => {
            if (!ctx.tenantId) return;
            void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
              { type: 'IncidentLogged', payload: { incidentId: ctx.id, type: ctx.type } },
            ]);
          },
        ],
        on: {
          INVESTIGATE: {
            target: 'Investigating',
            actions: (ctx) => {
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'IncidentInvestigating', payload: { incidentId: ctx.id } },
              ]);
            },
          },
        },
      },

      Investigating: {
        on: {
          RESOLVE: {
            target: 'Resolved',
            actions: [
              // Parent signal (unchanged)
              sendParent({ type: 'INCIDENT_RESOLVED' }),
              // Canonical domain event
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'IncidentResolved', payload: { incidentId: ctx.id } },
                ]);
              },
            ],
          },
        },
      },

      Resolved: { type: 'final' },
    },
  });
