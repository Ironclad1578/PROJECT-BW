// PATH: src/machines/certificateMonitorMachine.ts
import { createMachine, assign, sendParent, actions } from 'xstate';
const { pure } = actions;

export interface Certificate {
  name: string;
  expiresAt?: number;  // epoch ms
  uploadedAt?: number; // epoch ms
}

interface Ctx {
  jobId: string;
  certs: Record<string, Certificate>;
  warnBeforeMs: number; // pre-expiry warning window
  // de-dupe tracker: per cert name, whether we've already notified
  notified: Record<string, { imminent?: boolean; expired?: boolean }>;
}

type Ev =
  | { type: 'ADD'; cert: Certificate }
  | { type: 'REMOVE'; name: string }
  | { type: 'CONFIG'; warnBeforeMs: number }
  | { type: 'TICK'; now?: number };

const isExpired = (c: Certificate, now: number) =>
  !!c.expiresAt && c.expiresAt <= now;

const isImminent = (c: Certificate, now: number, warn: number) =>
  !!c.expiresAt && c.expiresAt > now && (c.expiresAt - now) <= warn;

export const certificateMonitorMachine = (opts: { jobId: string; warnBeforeDays?: number }) =>
  createMachine<Ctx, Ev>({
    id: 'certificateMonitor',
    initial: 'Monitoring',
    context: {
      jobId: opts.jobId,
      certs: {},
      warnBeforeMs: (opts.warnBeforeDays ?? 7) * 24 * 60 * 60 * 1000,
      notified: {}, // â† NEW
    },
    states: {
      Monitoring: {
        on: {
          ADD: {
            actions: [
              // store/merge the cert
              assign((ctx, e: any) => {
                const now = Date.now();
                const incoming: Certificate = {
                  ...e.cert,
                  uploadedAt: e.cert.uploadedAt ?? now,
                };
                return { certs: { ...ctx.certs, [incoming.name]: incoming } };
              }),
              // decide whether to notify (imminent/expired) and mark as notified (de-duped)
              pure((ctx, e: any) => {
                const now = Date.now();
                const c: Certificate = { ...e.cert };
                const rec = ctx.notified[c.name] ?? {};
                const actionsOut: any[] = [];

                if (isExpired(c, now) && !rec.expired) {
                  actionsOut.push(sendParent({ type: 'CERT_EXPIRED', name: c.name } as any));
                  actionsOut.push(assign((ctx2: Ctx) => ({
                    notified: { ...ctx2.notified, [c.name]: { ...rec, expired: true } },
                  })));
                } else if (isImminent(c, now, ctx.warnBeforeMs) && !rec.imminent && !rec.expired) {
                  actionsOut.push(sendParent({ type: 'CERT_IMMINENT', name: c.name } as any));
                  actionsOut.push(assign((ctx2: Ctx) => ({
                    notified: { ...ctx2.notified, [c.name]: { ...rec, imminent: true } },
                  })));
                }

                return actionsOut;
              }),
            ],
          },

          REMOVE: {
            actions: assign((ctx, e: any) => {
              const copyC = { ...ctx.certs };
              delete copyC[e.name];
              const copyN = { ...ctx.notified };
              delete copyN[e.name];
              return { certs: copyC, notified: copyN };
            }),
          },

          CONFIG: {
            actions: assign((_ctx, e: any) => ({
              warnBeforeMs: e.warnBeforeMs,
            })),
          },

          TICK: {
            // scan all certs and emit de-duped events; mark as notified
            actions: pure((ctx, e: any) => {
              const now = e.now ?? Date.now();
              const out: any[] = [];

              for (const c of Object.values(ctx.certs)) {
                const rec = ctx.notified[c.name] ?? {};
                if (isExpired(c, now) && !rec.expired) {
                  out.push(sendParent({ type: 'CERT_EXPIRED', name: c.name } as any));
                  out.push(assign((ctx2: Ctx) => ({
                    notified: { ...ctx2.notified, [c.name]: { ...rec, expired: true } },
                  })));
                } else if (isImminent(c, now, ctx.warnBeforeMs) && !rec.imminent && !rec.expired) {
                  out.push(sendParent({ type: 'CERT_IMMINENT', name: c.name } as any));
                  out.push(assign((ctx2: Ctx) => ({
                    notified: { ...ctx2.notified, [c.name]: { ...rec, imminent: true } },
                  })));
                }
              }

              return out;
            }),
          },
        },
      },
    },
  });
