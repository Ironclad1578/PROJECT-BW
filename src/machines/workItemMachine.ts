// PATH: src/machines/workItemMachine.ts
import { createMachine, assign, sendParent } from 'xstate';
import { fakeApi } from '@/api/fakeApi';
import type { WorkItemKind, WorkItemStatus } from '@/constants/codes';

interface WorkItemContext {
  id: string;
  jobId: string;
  tenantId?: string;           // â† NEW: so we can append domain events server-side
  kind: WorkItemKind;
  status: WorkItemStatus;
  version: number;
  approvalRoute?: 'BW' | 'Client' | 'Both';
  authorityCap?: number | null; // NTE limit
}

type WorkItemEvents =
  | { type: 'MAKE_REQUIRED' }
  | { type: 'DRAFT' }
  | { type: 'CONFIRM' }
  | { type: 'SUBMIT' }
  | { type: 'REQUEST_BW_APPROVAL' }
  | { type: 'REQUEST_CLIENT_APPROVAL' }
  | { type: 'BW_APPROVE' }
  | { type: 'CLIENT_APPROVE' }
  | { type: 'REJECT' }
  | { type: 'QUERY'; note?: string }
  | { type: 'RESUBMIT' }
  | { type: 'ISSUE' };

export const workItemMachine = (seed: Partial<WorkItemContext>) =>
  createMachine<WorkItemContext, WorkItemEvents>({
    id: `workItem:${seed.kind ?? 'Quote'}`,
    context: {
      id: seed.id ?? 'temp',
      jobId: seed.jobId ?? '',
      tenantId: seed.tenantId, // â† NEW (may be undefined; we guard appends)
      kind: (seed.kind ?? 'Quote') as WorkItemKind,
      status: (seed.status ?? 'Required') as WorkItemStatus,
      version: seed.version ?? 1,
      approvalRoute: seed.approvalRoute ?? 'Client',
      authorityCap: seed.authorityCap ?? null,
    },
    initial: (seed.status as any) ?? 'Required',
    states: {
      Required: { on: { DRAFT: 'Drafted' } },
      Drafted:  { on: { CONFIRM: 'Confirmed', SUBMIT: 'Submitted' } },
      Confirmed:{ on: { SUBMIT: 'Submitted' } },

      Submitted: {
        entry: [
          // existing parent signal
          sendParent((ctx) => ({ type: 'COMMERCIAL_SUBMITTED', kind: ctx.kind })),
          // NEW: append a domain event server-side
          (ctx) => {
            if (!ctx.tenantId) return;
            void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
              {
                type: 'CommercialSubmitted',
                payload: {
                  workItemId: ctx.id,
                  kind: ctx.kind,
                  version: ctx.version,
                  route: ctx.approvalRoute,
                },
              },
            ]);
          },
        ],
        always: [
          { target: 'AwaitingBWApproval',    cond: (ctx) => ctx.approvalRoute === 'BW' },
          { target: 'AwaitingClientApproval', cond: (ctx) => ctx.approvalRoute !== 'BW' },
        ],
      },

      AwaitingBWApproval: {
        on: {
          BW_APPROVE: {
            target: 'Approved',
            actions: [
              sendParent((ctx) => ({ type: 'COMMERCIAL_APPROVED', kind: ctx.kind })),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'CommercialApproved',
                    payload: { workItemId: ctx.id, by: 'BW', kind: ctx.kind, version: ctx.version },
                  },
                ]);
              },
            ],
          },
          REJECT: {
            target: 'Rejected',
            actions: [
              sendParent((ctx) => ({ type: 'COMMERCIAL_REJECTED', kind: ctx.kind })),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'CommercialRejected',
                    payload: { workItemId: ctx.id, atState: 'AwaitingBWApproval', kind: ctx.kind, version: ctx.version },
                  },
                ]);
              },
            ],
          },
          QUERY: {
            target: 'Queried',
            actions: [
              (ctx, e: any) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'CommercialQueried',
                    payload: { workItemId: ctx.id, kind: ctx.kind, version: ctx.version, note: e?.note },
                  },
                ]);
              },
            ],
          },
        },
      },

      AwaitingClientApproval: {
        on: {
          CLIENT_APPROVE: {
            target: 'Approved',
            actions: [
              sendParent((ctx) => ({ type: 'COMMERCIAL_APPROVED', kind: ctx.kind })),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'CommercialApproved',
                    payload: { workItemId: ctx.id, by: 'Client', kind: ctx.kind, version: ctx.version },
                  },
                ]);
              },
            ],
          },
          REJECT: {
            target: 'Rejected',
            actions: [
              sendParent((ctx) => ({ type: 'COMMERCIAL_REJECTED', kind: ctx.kind })),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'CommercialRejected',
                    payload: { workItemId: ctx.id, atState: 'AwaitingClientApproval', kind: ctx.kind, version: ctx.version },
                  },
                ]);
              },
            ],
          },
          QUERY: {
            target: 'Queried',
            actions: [
              (ctx, e: any) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'CommercialQueried',
                    payload: { workItemId: ctx.id, kind: ctx.kind, version: ctx.version, note: e?.note },
                  },
                ]);
              },
            ],
          },
        },
      },

      Queried: {
        entry: [
          sendParent((ctx) => ({ type: 'COMMERCIAL_QUERIED', kind: ctx.kind })),
          (ctx) => {
            if (!ctx.tenantId) return;
            // Entry without the note (already sent on transition). Still useful for state change.
            void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
              {
                type: 'CommercialStateEntered',
                payload: { state: 'Queried', workItemId: ctx.id, kind: ctx.kind, version: ctx.version },
              },
            ]);
          },
        ],
        on: {
          RESUBMIT: {
            target: 'Resubmitted',
            actions: assign((ctx) => ({ version: ctx.version + 1 })),
          },
        },
      },

      Resubmitted: {
        entry: [
          sendParent((ctx) => ({ type: 'COMMERCIAL_RESUBMITTED', kind: ctx.kind })),
          (ctx) => {
            if (!ctx.tenantId) return;
            void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
              {
                type: 'CommercialResubmitted',
                payload: { workItemId: ctx.id, kind: ctx.kind, version: ctx.version },
              },
            ]);
          },
        ],
        always: 'Submitted',
      },

      Approved: {
        on: {
          ISSUE: {
            target: 'Issued',
            actions: [
              sendParent({ type: 'WORKS_ORDER_ISSUED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'WorksOrderIssued',
                    payload: { workItemId: ctx.id, kind: ctx.kind, version: ctx.version },
                  },
                ]);
              },
            ],
          },
        },
      },

      Rejected: {
        type: 'final',
        entry: (ctx) => {
          if (!ctx.tenantId) return;
          void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
            { type: 'CommercialFinal', payload: { state: 'Rejected', workItemId: ctx.id, kind: ctx.kind, version: ctx.version } },
          ]);
        },
      },

      Issued: {
        type: 'final',
        entry: (ctx) => {
          if (!ctx.tenantId) return;
          void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
            { type: 'CommercialFinal', payload: { state: 'Issued', workItemId: ctx.id, kind: ctx.kind, version: ctx.version } },
          ]);
        },
      },
    },
  });

