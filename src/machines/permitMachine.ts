// PATH: src/machines/permitMachine.ts
import { createMachine, sendParent } from 'xstate';
import { fakeApi } from '@/api/fakeApi';
import type { PermitStatus } from '@/constants/codes';

interface PermitContext {
  id: string;
  jobId: string;
  tenantId?: string;     // ← NEW: to emit server events when available
  status: PermitStatus;
  expiresAt?: string;    // ISO (optional)
}

type PermitEvents =
  | { type: 'SUBMIT' }
  | { type: 'APPROVE' }
  | { type: 'REJECT' }
  | { type: 'EXPIRE' };

export const permitMachine = (seed: Partial<PermitContext>) =>
  createMachine<PermitContext, PermitEvents>({
    id: `permit:${seed.id ?? 'new'}`,
    context: {
      id: seed.id ?? 'temp',
      jobId: seed.jobId ?? '',
      tenantId: seed.tenantId,                // ← NEW
      status: (seed.status ?? 'Draft') as PermitStatus,
      expiresAt: seed.expiresAt,
    },
    initial: (seed.status as any) ?? 'Draft',
    states: {
      Draft: {
        on: {
          SUBMIT: {
            target: 'Submitted',
            actions: (ctx) => {
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'PermitSubmitted', payload: { permitId: ctx.id } },
              ]);
            },
          },
        },
      },
      Submitted: {
        on: {
          APPROVE: {
            target: 'Approved',
            actions: [
              sendParent({ type: 'PTW_APPROVED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'PermitApproved', payload: { permitId: ctx.id } },
                ]);
              },
            ],
          },
          REJECT: {
            target: 'Rejected',
            actions: [
              sendParent({ type: 'PTW_REJECTED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'PermitRejected', payload: { permitId: ctx.id } },
                ]);
              },
            ],
          },
        },
      },
      Approved: {
        on: {
          EXPIRE: {
            target: 'Expired',
            actions: [
              sendParent({ type: 'PTW_EXPIRED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'PermitExpired', payload: { permitId: ctx.id, expiresAt: ctx.expiresAt } },
                ]);
              },
            ],
          },
        },
      },
      Rejected: { },
      Expired:  { },
    },
  });
