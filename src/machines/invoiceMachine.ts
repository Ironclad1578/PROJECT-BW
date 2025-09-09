// PATH: src/machines/invoiceMachine.ts
import { createMachine, assign, sendParent } from 'xstate';
import { fakeApi } from '@/api/fakeApi';
import type { InvoiceStatus } from '@/constants/codes';

interface InvoiceContext {
  id: string;
  jobId: string;
  tenantId?: string;          // â† NEW: enables server event appends
  status: InvoiceStatus;
  dueAt?: string;
  paidAmount?: number;
}

type InvoiceEvents =
  | { type: 'ISSUE'; dueAt: string }
  | { type: 'PAY_PART'; amount: number }
  | { type: 'PAY_FULL' }
  | { type: 'MARK_OVERDUE' }
  | { type: 'DISPUTE' }
  | { type: 'RESOLVE' };

export const invoiceMachine = (seed: Partial<InvoiceContext>) =>
  createMachine<InvoiceContext, InvoiceEvents>({
    id: `invoice:${seed.id ?? 'new'}`,
    context: {
      id: seed.id ?? 'temp',
      jobId: seed.jobId ?? '',
      tenantId: seed.tenantId,                // â† NEW
      status: (seed.status ?? 'Draft') as InvoiceStatus,
      dueAt: seed.dueAt,
      paidAmount: seed.paidAmount ?? 0,
    },
    initial: (seed.status as any) ?? 'Draft',
    states: {
      Draft: {
        on: {
          ISSUE: {
            target: 'Issued',
            actions: [
              assign((_c, e) => ({ dueAt: (e as any).dueAt })),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'InvoiceIssued', payload: { invoiceId: ctx.id, dueAt: ctx.dueAt } },
                ]);
              },
            ],
          },
        },
      },

      Issued: {
        on: {
          PAY_PART: {
            target: 'PartPaid',
            actions: [
              assign((c, e) => ({ paidAmount: (c.paidAmount ?? 0) + (e as any).amount })),
              (ctx, e: any) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'InvoicePartPaid',
                    payload: { invoiceId: ctx.id, amount: e.amount, totalPaid: ctx.paidAmount },
                  },
                ]);
              },
            ],
          },
          PAY_FULL: {
            target: 'Paid',
            actions: (ctx) => {
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'InvoicePaid', payload: { invoiceId: ctx.id } },
              ]);
            },
          },
          MARK_OVERDUE: {
            target: 'Overdue',
            actions: (ctx) => {
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'InvoiceOverdue', payload: { invoiceId: ctx.id } },
              ]);
            },
          },
          DISPUTE: {
            target: 'Disputed',
            actions: [
              sendParent({ type: 'INVOICE_DISPUTED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'InvoiceDisputed', payload: { invoiceId: ctx.id } },
                ]);
              },
            ],
          },
        },
      },

      PartPaid: {
        on: {
          PAY_PART: {
            actions: [
              assign((c, e) => ({ paidAmount: (c.paidAmount ?? 0) + (e as any).amount })),
              (ctx, e: any) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  {
                    type: 'InvoicePartPaid',
                    payload: { invoiceId: ctx.id, amount: e.amount, totalPaid: ctx.paidAmount },
                  },
                ]);
              },
            ],
          },
          PAY_FULL: {
            target: 'Paid',
            actions: (ctx) => {
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'InvoicePaid', payload: { invoiceId: ctx.id } },
              ]);
            },
          },
          MARK_OVERDUE: {
            target: 'Overdue',
            actions: (ctx) => {
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'InvoiceOverdue', payload: { invoiceId: ctx.id } },
              ]);
            },
          },
          DISPUTE: {
            target: 'Disputed',
            actions: [
              sendParent({ type: 'INVOICE_DISPUTED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'InvoiceDisputed', payload: { invoiceId: ctx.id } },
                ]);
              },
            ],
          },
        },
      },

      Paid: { type: 'final' },

      Overdue: {
        on: {
          PAY_PART: {
            target: 'PartPaid',
            actions: (ctx, e: any) => {
              // Assign before event to include new total in event if you want; here we keep it simple
              // If desired, mirror PartPaid logic with assign + append.
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'InvoicePartPaid', payload: { invoiceId: ctx.id, amount: e.amount } },
              ]);
            },
          },
          PAY_FULL: {
            target: 'Paid',
            actions: (ctx) => {
              if (!ctx.tenantId) return;
              void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                { type: 'InvoicePaid', payload: { invoiceId: ctx.id } },
              ]);
            },
          },
          DISPUTE: {
            target: 'Disputed',
            actions: [
              sendParent({ type: 'INVOICE_DISPUTED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'InvoiceDisputed', payload: { invoiceId: ctx.id } },
                ]);
              },
            ],
          },
        },
      },

      Disputed: {
        on: {
          RESOLVE: {
            target: 'Resolved',
            actions: [
              sendParent({ type: 'INVOICE_RESOLVED' }),
              (ctx) => {
                if (!ctx.tenantId) return;
                void fakeApi.events.append(ctx.tenantId, ctx.jobId, [
                  { type: 'InvoiceResolved', payload: { invoiceId: ctx.id } },
                ]);
              },
            ],
          },
        },
      },

      Resolved: {},
    },
  });
