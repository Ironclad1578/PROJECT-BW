// PATH: src/machines/rateCardPolicyMachine.ts
import { createMachine, assign, sendParent } from 'xstate';

export interface Line {
  id: string;
  description: string;
  qty: number;
  rate: number;
  taxRate?: number; // 0..1 (e.g., 0.2 for 20%)
}

interface Ctx {
  jobId: string;
  lines: Line[];
  defaultTaxRate: number; // 0..1
}

type Ev =
  | { type: 'SET_LINES'; lines: Line[] }
  | { type: 'ADD_LINE'; line: Line }
  | { type: 'REMOVE_LINE'; id: string }
  | { type: 'CLEAR' }
  | { type: 'SET_TAX_RATE'; defaultTaxRate: number }
  | { type: 'RECALC' };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const computeTotals = (lines: Line[], defaultTaxRate: number) => {
  const net = sum(lines.map((l) => l.qty * l.rate));
  const tax = sum(lines.map((l) => l.qty * l.rate * (l.taxRate ?? defaultTaxRate)));
  return { net, tax, gross: net + tax };
};

export const rateCardPolicyMachine = (opts: { jobId: string; defaultTaxRate?: number }) =>
  createMachine<Ctx, Ev>({
    id: 'rateCardPolicy',
    initial: 'Idle',
    context: {
      jobId: opts.jobId,
      lines: [],
      defaultTaxRate: opts.defaultTaxRate ?? 0.2,
    },
    states: {
      Idle: {
        on: {
          SET_LINES:   { actions: assign((_ctx, e: any) => ({ lines: e.lines })) },
          ADD_LINE:    { actions: assign((ctx, e: any) => ({ lines: [...ctx.lines, e.line] })) },
          REMOVE_LINE: { actions: assign((ctx, e: any) => ({ lines: ctx.lines.filter((l) => l.id !== e.id) })) },
          CLEAR:       { actions: assign({ lines: (_: Ctx) => [] }) },
          SET_TAX_RATE:{ actions: assign((_ctx, e: any) => ({ defaultTaxRate: e.defaultTaxRate })) },
          RECALC: {
            actions: sendParent((ctx) => ({
              type: 'RATES_UPDATED',
              totals: computeTotals(ctx.lines, ctx.defaultTaxRate),
            }) as any),
          },
        },
      },
    },
  });
