// PATH: src/machines/jobMachine.ts
import { createMachine, assign, spawn, actions } from 'xstate';
const { send } = actions;
import { fakeApi } from '@/api/fakeApi';
import type {
  JobStatus, JobIntent, Role, HoldReason, CancelReason,
} from '@/constants/codes';

import { workItemMachine } from './workItemMachine';
import { worksOrderMachine } from './worksOrderMachine';
import { permitMachine } from './permitMachine';
import { materialsMachine } from './materialsMachine';
import { invoiceMachine } from './invoiceMachine';
import { incidentMachine } from './incidentMachine';

// Assistants (previous)
import { slaWatchdogMachine } from './slaWatchdogMachine';
import { documentSetMachine } from './documentSetMachine';
import { eligibilityMachine } from './eligibilityMachine';
import { schedulerMachine } from './schedulerMachine';
import { INTENT_POLICIES } from '@/policy/policies';

// NEW: pro layers
import { qaReviewMachine } from './qaReviewMachine';
import { certificateMonitorMachine } from './certificateMonitorMachine';
import { rateCardPolicyMachine } from './rateCardPolicyMachine';
import { retentionMachine } from './retentionMachine';

// NEW: notifications
import { notificationMachine } from './notificationMachine';

/** Context */
export interface JobContext {
  tenantId?: string;
  jobId?: string;
  role?: Role;

  status: JobStatus;
  intent?: JobIntent;

  // SLA clocks
  respondBy?: string;        // ISO target
  dueBy?: string;            // ISO target
  slaPaused?: boolean;
  slaStartedAt?: number;     // epoch ms
  slaPausedAt?: number;      // epoch ms
  slaPauseTotalMs?: number;

  // Static requirement flags
  ramsRequired?: boolean;
  permitsRequired?: boolean;

  // Dynamic gates
  hasAssignee?: boolean;
  hasVisitTime?: boolean;

  hasApprovedRAMS?: boolean;
  hasActivePTW?: boolean;

  hasControllingCommercial?: boolean;
  hasApprovedCommercial?: boolean;
  withinAuthority?: boolean;

  hasReport?: boolean;
  hasPhotos?: boolean;
  hasClientSignoff?: boolean;

  invoicesOk?: boolean;

  // QA
  qaRequired?: boolean;      // configurable (FLAGS) or per-client policy
  hasQAPassed?: boolean;

  // Hold/Cancel
  holdReason?: HoldReason;
  cancelReason?: CancelReason;
  holdReturnTo?: Exclude<JobStatus,'OnHold'|'Cancelled'>;

  // Child actor registries
  commercials: Record<string, any>;
  worksOrders: Record<string, any>;
  permits:    Record<string, any>;
  materials:  Record<string, any>;
  invoices:   Record<string, any>;
  incidents:  Record<string, any>;

  // Helper actors
  _watchdog?: any;   // SLA watchdog
  _docset?: any;     // evidence completeness
  _elig?: any;       // engineer eligibility
  _sched?: any;      // scheduler

  // NEW helper actors
  _qa?: any;         // QA review
  _certMon?: any;    // certificate monitor
  _rates?: any;      // rate card policy
  _retention?: any;  // retention manager
  _notify?: any;     // notifications
}

/** Events */
type Events =
  | { type: 'JOB_CREATED'; intent?: JobIntent; respondBy?: string; dueBy?: string }
  | { type: 'ASSIGNED' }
  | { type: 'SCHEDULED' }
  | { type: 'ARRIVED_ONSITE' }
  | { type: 'WORKS_FINISHED' }
  | { type: 'REPORT_SAVED' }
  | { type: 'APPROVED_TO_START' }
  | { type: 'WORKS_COMPLETED' }
  | { type: 'CLOSED' }
  | { type: 'HOLD'; reason: HoldReason }
  | { type: 'RESUME' }
  | { type: 'CANCEL'; reason: CancelReason }

  // hydration/flags
  | { type: 'SYNC'; status: JobStatus; [k: string]: any }
  | { type: 'FLAGS'; flags: Partial<JobContext> }

  // commercial child → parent
  | { type: 'COMMERCIAL_SUBMITTED'; kind: 'Quote'|'Variation'|'Uplift' }
  | { type: 'COMMERCIAL_APPROVED';  kind: 'Quote'|'Variation'|'Uplift' }
  | { type: 'COMMERCIAL_REJECTED';  kind: 'Quote'|'Variation'|'Uplift' }
  | { type: 'COMMERCIAL_QUERIED';   kind: 'Quote'|'Variation'|'Uplift' }
  | { type: 'COMMERCIAL_RESUBMITTED'; kind: 'Quote'|'Variation'|'Uplift' }
  | { type: 'WORKS_ORDER_ISSUED' }

  // works order / visit / permit / materials / invoice / incident signals
  | { type: 'WO_VERIFIED' }
  | { type: 'WO_VISIT_NO_ACCESS' }
  | { type: 'PTW_APPROVED' } | { type: 'PTW_REJECTED' } | { type: 'PTW_EXPIRED' }
  | { type: 'MATERIALS_RECEIVED' }
  | { type: 'INVOICE_DISPUTED' } | { type: 'INVOICE_RESOLVED' }
  | { type: 'INCIDENT_LOGGED' } | { type: 'INCIDENT_RESOLVED' }

  // SLA watchdog signals
  | { type: 'SLA_RESPOND_IMMINENT' } | { type: 'SLA_RESPOND_BREACHED' }
  | { type: 'SLA_DUE_IMMINENT' }     | { type: 'SLA_DUE_BREACHED' }

  // Docset
  | { type: 'DOCS_COMPLETE' }

  // Eligibility
  | { type: 'ELIGIBILITY_OK' } | { type: 'ELIGIBILITY_FAIL' }

  // Scheduler
  | { type: 'SCHEDULE_CONFLICT' } | { type: 'SCHEDULE_CONFIRMED' } | { type: 'SCHEDULE_REJECTED' }
  | { type: 'SCHEDULE_PROPOSE'; start: string; end: string; clashes?: number }
  | { type: 'SCHEDULE_CONFIRM_TENANT' }
  | { type: 'SCHEDULE_REJECT_SLOT'; reason?: string }

  // Pro-layer signals
  | { type: 'QA_REVIEW_PASSED' } | { type: 'QA_REVIEW_REWORK'; notes?: string }
  | { type: 'CERT_IMMINENT'; name: string }  // surface on dashboards only
  | { type: 'CERT_EXPIRED'; name: string }   // triggers auto-hold
  | { type: 'RATES_UPDATED'; totals: { net:number; tax:number; gross:number } }
  | { type: 'RETENTION_ARCHIVED' } | { type: 'RETENTION_PURGED' }

  // commands to spawn children
  | { type: 'ADD_WORK_ITEM'; id: string; payload: any }
  | { type: 'ADD_WORK_ORDER'; id: string; payload: any }
  | { type: 'ADD_PERMIT'; id: string; payload: any }
  | { type: 'ADD_MATERIALS'; id: string; payload: any }
  | { type: 'ADD_INVOICE'; id: string; payload: any }
  | { type: 'ADD_INCIDENT'; id: string; payload: any };

/** Helpers */
const isAdmin = (ctx: JobContext) => ctx.role === 'Admin';
const now = () => Date.now();

function emitEvent(ctx: JobContext, ev: any) {
  if (!ctx.tenantId || !ctx.jobId) return;
  void fakeApi.events?.append?.(ctx.tenantId, ctx.jobId, [ev]);
}

function persist(ctx: JobContext, next: JobStatus, auditType: string, meta: Record<string, any> = {}) {
  if (!ctx.tenantId || !ctx.jobId) return;
  void fakeApi.jobs.update(ctx.tenantId, ctx.jobId, { status: next });
  void fakeApi.activities.append({
    tenantId: ctx.tenantId,
    jobId: ctx.jobId,
    type: 'JobStatusChanged',
    message: `Status changed: ${ctx.status} → ${next}`,
    meta: { event: auditType, from: ctx.status, to: next, ...meta },
  });
  // Canonical domain event + optional notifier
  emitEvent(ctx, { type: 'JobStatusChanged', from: ctx.status, to: next, meta });
  ctx._notify?.send({ type: 'EVENT', name: auditType, payload: meta });
}

/** SLA pause/resume reducers */
const pauseSLA = assign<JobContext, Events>((ctx) => {
  if (ctx.slaPaused) return {};
  ctx._watchdog?.send({ type: 'PAUSE' });
  return { slaPaused: true, slaPausedAt: now() };
});
const resumeSLA = assign<JobContext, Events>((ctx) => {
  if (!ctx.slaPaused) return {};
  ctx._watchdog?.send({ type: 'RESUME' });
  const add = ctx.slaPausedAt ? now() - ctx.slaPausedAt : 0;
  return { slaPaused: false, slaPausedAt: undefined, slaPauseTotalMs: (ctx.slaPauseTotalMs ?? 0) + add };
});

/** Guards */
const canSchedule = (ctx: JobContext) =>
  isAdmin(ctx) || !!(ctx.hasAssignee && ctx.hasVisitTime);

const canArriveOnSite = (ctx: JobContext) =>
  isAdmin(ctx) || !ctx.permitsRequired || !!ctx.hasActivePTW;

const canStartWorks = (ctx: JobContext) => {
  if (isAdmin(ctx)) return true;
  const ramsOk = !ctx.ramsRequired || !!ctx.hasApprovedRAMS;
  const ptwOk  = !ctx.permitsRequired || !!ctx.hasActivePTW;
  const authorityOk = !!ctx.withinAuthority || (!!ctx.hasControllingCommercial && !!ctx.hasApprovedCommercial);
  return ramsOk && ptwOk && authorityOk;
};

// Close now respects QA if required
const canClose = (ctx: JobContext) =>
  isAdmin(ctx) || !!(
    ctx.hasApprovedRAMS &&
    ctx.hasReport &&
    ctx.hasPhotos &&
    ctx.hasClientSignoff &&
    ctx.invoicesOk &&
    (ctx.qaRequired ? ctx.hasQAPassed : true)
  );

/** Machine */
export const jobMachine = createMachine<JobContext, Events>({
  id: 'job',
  initial: 'Draft',
  context: {
    status: 'Draft',
    commercials: {},
    worksOrders: {},
    permits: {},
    materials: {},
    invoices: {},
    incidents: {},
    qaRequired: false,
  },
  on: {
    /* ---------- CHILD SPAWNERS ---------- */
    ADD_WORK_ITEM: {
      actions: assign((ctx, e) => {
        const id = (e as any).id;
        if (!ctx.commercials[id]) {
          const actor = spawn(
  workItemMachine({ id, jobId: ctx.jobId, tenantId: ctx.tenantId, ...(e as any).payload }),
  { name: `wi:${id}` }
);
          return { commercials: { ...ctx.commercials, [id]: actor } };
        }
        return ctx;
      }),
    },
    ADD_WORK_ORDER: {
      actions: assign((ctx, e) => {
        const id = (e as any).id;
        if (!ctx.worksOrders[id]) {
          const actor = spawn(
            worksOrderMachine({ id, jobId: ctx.jobId, ...(e as any).payload }),
            { name: `wo:${id}` }
          );
          return { worksOrders: { ...ctx.worksOrders, [id]: actor } };
        }
        return ctx;
      }),
    },
    ADD_PERMIT: {
      actions: assign((ctx, e) => {
        const id = (e as any).id;
        if (!ctx.permits[id]) {
          const actor = spawn(
            permitMachine({ id, jobId: ctx.jobId, ...(e as any).payload }),
            { name: `ptw:${id}` }
          );
          return { permits: { ...ctx.permits, [id]: actor } };
        }
        return ctx;
      }),
    },
    ADD_MATERIALS: {
      actions: assign((ctx, e) => {
        const id = (e as any).id;
        if (!ctx.materials[id]) {
          const actor = spawn(
            materialsMachine({ id, jobId: ctx.jobId, ...(e as any).payload }),
            { name: `mat:${id}` }
          );
          return { materials: { ...ctx.materials, [id]: actor } };
        }
        return ctx;
      }),
    },
    ADD_INVOICE: {
      actions: assign((ctx, e) => {
        const id = (e as any).id;
        if (!ctx.invoices[id]) {
          const actor = spawn(
            invoiceMachine({ id, jobId: ctx.jobId, ...(e as any).payload }),
            { name: `inv:${id}` }
          );
          return { invoices: { ...ctx.invoices, [id]: actor } };
        }
        return ctx;
      }),
    },
    ADD_INCIDENT: {
      actions: assign((ctx, e) => {
        const id = (e as any).id;
        if (!ctx.incidents[id]) {
          const actor = spawn(
            incidentMachine({ id, jobId: ctx.jobId, ...(e as any).payload }),
            { name: `inc:${id}` }
          );
          return { incidents: { ...ctx.incidents, [id]: actor } };
        }
        return ctx;
      }),
    },

    /* ---------- GLOBAL FLOW CONTROL ---------- */
    HOLD: {
      target: 'OnHold',
      actions: [
        pauseSLA,
        assign((ctx, e) => {
          persist(ctx, 'OnHold', 'HOLD', { reason: (e as any).reason, from: ctx.status });
          return { status: 'OnHold', holdReason: (e as any).reason, holdReturnTo: ctx.status as any };
        }),
      ],
    },
    CANCEL: {
      target: 'Cancelled',
      actions: assign((ctx, e) => {
        persist(ctx, 'Cancelled', 'CANCEL', { reason: (e as any).reason });
        return { status: 'Cancelled', cancelReason: (e as any).reason };
      }),
    },

    /* ---------- HYDRATION ---------- */
    SYNC: {
      actions: assign((_ctx, e) => {
        if (e.type !== 'SYNC') return {};
        const { type: _ignored, ...rest } = e as any;
        return rest;
      }),
    },
    FLAGS: { actions: assign((ctx, e) => (e.type === 'FLAGS' ? { ...ctx, ...e.flags } : ctx)) },

    /* ---------- SLA SIGNALS (log + canonical events for dashboards) ---------- */
    SLA_RESPOND_IMMINENT: {
      actions: (ctx) => {
        emitEvent(ctx, { type: 'SLA_RESPOND_IMMINENT' });
        fakeApi.activities.append({
          tenantId: ctx.tenantId!,
          jobId: ctx.jobId!,
          type: 'SLA',
          message: 'Respond SLA approaching',
        });
      },
    },
    SLA_RESPOND_BREACHED: {
      actions: (ctx) => {
        emitEvent(ctx, { type: 'SLA_RESPOND_BREACHED' });
        fakeApi.activities.append({
          tenantId: ctx.tenantId!,
          jobId: ctx.jobId!,
          type: 'SLA',
          message: 'Respond SLA breached',
        });
      },
    },
    SLA_DUE_IMMINENT: {
      actions: (ctx) => {
        emitEvent(ctx, { type: 'SLA_DUE_IMMINENT' });
        fakeApi.activities.append({
          tenantId: ctx.tenantId!,
          jobId: ctx.jobId!,
          type: 'SLA',
          message: 'Due SLA approaching',
        });
      },
    },
    SLA_DUE_BREACHED: {
      actions: (ctx) => {
        emitEvent(ctx, { type: 'SLA_DUE_BREACHED' });
        fakeApi.activities.append({
          tenantId: ctx.tenantId!,
          jobId: ctx.jobId!,
          type: 'SLA',
          message: 'Due SLA breached',
        });
      },
    },

    /* ---------- ELIGIBILITY & DOCS & SCHEDULER ---------- */
    ELIGIBILITY_OK:   { actions: (ctx) => fakeApi.activities.append({ tenantId: ctx.tenantId!, jobId: ctx.jobId!, type: 'Eligibility', message: 'Assignee eligible' }) },
    ELIGIBILITY_FAIL: { actions: (ctx) => fakeApi.activities.append({ tenantId: ctx.tenantId!, jobId: ctx.jobId!, type: 'Eligibility', message: 'Assignee ineligible' }) },
    DOCS_COMPLETE:    { actions: assign((_ctx) => ({ hasPhotos: true, hasClientSignoff: true })) },

    SCHEDULE_CONFLICT:  { actions: (ctx) => fakeApi.activities.append({ tenantId: ctx.tenantId!, jobId: ctx.jobId!, type: 'Schedule', message: 'Scheduling conflict detected' }) },
    SCHEDULE_CONFIRMED: { actions: (ctx) => fakeApi.activities.append({ tenantId: ctx.tenantId!, jobId: ctx.jobId!, type: 'Schedule', message: 'Tenant confirmed slot' }) },
    SCHEDULE_REJECTED:  { actions: (ctx) => fakeApi.activities.append({ tenantId: ctx.tenantId!, jobId: ctx.jobId!, type: 'Schedule', message: 'Proposed slot rejected' }) },

    // pass-through to scheduler
    SCHEDULE_PROPOSE:        { actions: assign((ctx, e:any) => { ctx._sched ??= spawn(schedulerMachine, { name: `sched:${ctx.jobId}` }); ctx._sched.send({ type:'PROPOSE', start: e.start, end: e.end, clashes: e.clashes }); return ctx; }) },
    SCHEDULE_CONFIRM_TENANT: { actions: (ctx) => ctx._sched?.send({ type:'CONFIRM_TENANT' }) },
    SCHEDULE_REJECT_SLOT:    { actions: (ctx, e:any) => ctx._sched?.send({ type:'REJECT_SLOT', reason: e.reason }) },

    /* ---------- PRO-LAYER SIGNALS ---------- */
    CERT_IMMINENT: {
      actions: (ctx, e:any) => {
        emitEvent(ctx, { type: 'CERT_IMMINENT', name: e.name });
        fakeApi.activities.append({
          tenantId: ctx.tenantId!,
          jobId: ctx.jobId!,
          type: 'Compliance',
          message: `Certificate near expiry: ${e.name}`,
          meta: { severity: 'imminent', cert: e.name },
        });
      },
    },
    CERT_EXPIRED: {
      actions: [
        (ctx, e:any) => {
          emitEvent(ctx, { type: 'CERT_EXPIRED', name: e.name });
          fakeApi.activities.append({
            tenantId: ctx.tenantId!,
            jobId: ctx.jobId!,
            type:'Compliance',
            message:`Certificate expired: ${e.name}`,
            meta: { severity: 'expired', cert: e.name },
          });
        },
        // Auto-HOLD for compliance failure (policy-driven reason "Compliance")
        send((_ctx) => ({
          type: 'HOLD',
          reason: ('Compliance' as HoldReason),
        })),
      ],
    },
    RATES_UPDATED: {
      actions: (ctx, e:any) => {
        emitEvent(ctx, { type: 'RATES_UPDATED', totals: e.totals });
        fakeApi.activities.append({
          tenantId: ctx.tenantId!,
          jobId: ctx.jobId!,
          type:'Rates',
          message:'Totals updated',
          meta: e.totals,
        });
      },
    },
    RETENTION_ARCHIVED: { actions: (ctx)=> fakeApi.activities.append({ tenantId: ctx.tenantId!, jobId: ctx.jobId!, type:'Retention', message:'Archived' }) },
    RETENTION_PURGED:   { actions: (ctx)=> fakeApi.activities.append({ tenantId: ctx.tenantId!, jobId: ctx.jobId!, type:'Retention', message:'Purged' }) },
  },

  states: {
    /* History state used to resume to the last active state before HOLD */
    ReturnHistory: {
      type: 'history',
      history: 'shallow',
      target: 'Triage',
    },

    Draft: {
      entry: assign<JobContext>(() => ({ slaStartedAt: now() })),
      on: {
        JOB_CREATED: {
          target: 'Triage',
          actions: assign((ctx, e:any) => {
            // Persist + canonical event
            persist(ctx, 'Triage', 'JOB_CREATED', { intent: e.intent });

            // SLA watchdog
            const pol = INTENT_POLICIES[(e.intent ?? ctx.intent) ?? 'Reactive'];
            const wd = spawn(slaWatchdogMachine, { name: `sla:${ctx.jobId}` });
            wd.send({
              type: 'SET',
              respondBy: e.respondBy ? new Date(e.respondBy).getTime() : undefined,
              dueBy: e.dueBy ? new Date(e.dueBy).getTime() : undefined,
              respondImminentMs: pol.sla.respondImminentMins * 60 * 1000,
              dueImminentMs: pol.sla.dueImminentMins * 60 * 1000,
            });

            // Certificate monitor
            const certMon = spawn(certificateMonitorMachine({ jobId: ctx.jobId! }), { name: `cert:${ctx.jobId}` });

            // Notifications
            const notifier = spawn(
              notificationMachine({ jobId: ctx.jobId!, recipients: { internal: [], client: [], contractor: [] } }),
              { name: `notify:${ctx.jobId}` }
            );

            return {
              status: 'Triage',
              intent: e.intent,
              respondBy: e.respondBy,
              dueBy: e.dueBy,
              qaRequired: pol.qaRequired,
              _watchdog: wd,
              _certMon: certMon,
              _notify: notifier,
            };
          }),
        },
      },
    },

    Triage: {
      on: {
        ASSIGNED: {
          target: 'Assigned',
          actions: assign((ctx) => {
            persist(ctx, 'Assigned', 'ASSIGNED');
            const elig = ctx._elig ?? spawn(eligibilityMachine, { name: `elig:${ctx.jobId}` });
            return { status: 'Assigned', hasAssignee: true, _elig: elig };
          }),
        },
        COMMERCIAL_SUBMITTED: {
          target: 'AwaitingApproval',
          actions: assign((ctx, e) => {
            persist(ctx, 'AwaitingApproval', 'COMMERCIAL_SUBMITTED', { kind: (e as any).kind });
            return { status: 'AwaitingApproval', hasControllingCommercial: true };
          }),
        },
      },
    },

    Assigned: {
      on: {
        SCHEDULED: {
          target: 'Scheduled',
          cond: canSchedule,
          actions: assign((ctx) => {
            persist(ctx, 'Scheduled', 'SCHEDULED');
            ctx._sched ??= spawn(schedulerMachine, { name: `sched:${ctx.jobId}` });
            return { status: 'Scheduled' };
          }),
        },
        COMMERCIAL_SUBMITTED: {
          target: 'AwaitingApproval',
          actions: assign((ctx, e) => {
            persist(ctx, 'AwaitingApproval', 'COMMERCIAL_SUBMITTED', { kind: (e as any).kind });
            return { status: 'AwaitingApproval', hasControllingCommercial: true };
          }),
        },
      },
    },

    Scheduled: {
      on: {
        ARRIVED_ONSITE: {
          target: 'OnSite',
          cond: canArriveOnSite,
          actions: assign((ctx) => {
            persist(ctx, 'OnSite', 'ARRIVED_ONSITE');
            return { status: 'OnSite' };
          }),
        },
        COMMERCIAL_SUBMITTED: {
          target: 'AwaitingApproval',
          actions: assign((ctx, e) => {
            persist(ctx, 'AwaitingApproval', 'COMMERCIAL_SUBMITTED', { kind: (e as any).kind });
            return { status: 'AwaitingApproval', hasControllingCommercial: true };
          }),
        },
      },
    },

    OnSite: {
      on: {
        WORKS_FINISHED: {
          target: 'AwaitingReport',
          actions: assign((ctx) => {
            persist(ctx, 'AwaitingReport', 'WORKS_FINISHED');
            return { status: 'AwaitingReport' };
          }),
        },
        COMMERCIAL_SUBMITTED: {
          target: 'AwaitingApproval',
          actions: assign((ctx, e) => {
            persist(ctx, 'AwaitingApproval', 'COMMERCIAL_SUBMITTED', { kind: (e as any).kind });
            return { status: 'AwaitingApproval', hasControllingCommercial: true };
          }),
        },
      },
    },

    AwaitingReport: {
      on: {
        REPORT_SAVED: {
          target: 'AwaitingApproval',
          actions: assign((ctx) => {
            persist(ctx, 'AwaitingApproval', 'REPORT_SAVED');
            return { status: 'AwaitingApproval', hasReport: true };
          }),
        },
        COMMERCIAL_SUBMITTED: {
          target: 'AwaitingApproval',
          actions: assign((ctx, e) => {
            persist(ctx, 'AwaitingApproval', 'COMMERCIAL_SUBMITTED', { kind: (e as any).kind });
            return { status: 'AwaitingApproval', hasControllingCommercial: true };
          }),
        },
      },
    },

    AwaitingApproval: {
      on: {
        COMMERCIAL_APPROVED: {
          actions: assign((ctx, e) => {
            persist(ctx, 'AwaitingApproval', 'COMMERCIAL_APPROVED', { kind: (e as any).kind });
            return { hasApprovedCommercial: true };
          }),
        },
        COMMERCIAL_REJECTED: {
          target: 'Triage',
          actions: assign((ctx, e) => {
            persist(ctx, 'Triage', 'COMMERCIAL_REJECTED', { kind: (e as any).kind });
            return { status: 'Triage', hasApprovedCommercial: false, hasControllingCommercial: false };
          }),
        },
        COMMERCIAL_QUERIED:     { actions: assign((ctx, e) => { persist(ctx, 'AwaitingApproval', 'COMMERCIAL_QUERIED', { kind: (e as any).kind }); return ctx; }) },
        COMMERCIAL_RESUBMITTED: { actions: assign((ctx, e) => { persist(ctx, 'AwaitingApproval', 'COMMERCIAL_RESUBMITTED', { kind: (e as any).kind }); return ctx; }) },

        APPROVED_TO_START: {
          target: 'InProgress',
          cond: canStartWorks,
          actions: assign((ctx) => {
            persist(ctx, 'InProgress', 'APPROVED_TO_START');

            // Evidence docset
            const ds = spawn(documentSetMachine, { name: `docs:${ctx.jobId}` });
            const pol = INTENT_POLICIES[ctx.intent ?? 'Reactive'];
            ds.send({
              type: 'CONFIG',
              minBefore: pol.evidence.minPhotosBefore,
              minAfter: pol.evidence.minPhotosAfter,
              needSignoff: pol.evidence.requireClientSignoff,
              requiredCerts: pol.evidence.requiredCertificates ?? [],
            });

            // Rate card (optional; UI feeds lines + RECALC)
            const rates = ctx._rates ?? spawn(rateCardPolicyMachine({ jobId: ctx.jobId! }), { name: `rate:${ctx.jobId}` });

            return { status: 'InProgress', _docset: ds, _rates: rates };
          }),
        },

        WORKS_ORDER_ISSUED: { actions: assign((ctx) => { persist(ctx, 'AwaitingApproval', 'WORKS_ORDER_ISSUED'); return ctx; }) },
      },
    },

    InProgress: {
      on: {
        WORKS_COMPLETED: {
          target: 'Complete',
          actions: assign((ctx) => {
            persist(ctx, 'Complete', 'WORKS_COMPLETED');
            return { status: 'Complete' };
          }),
        },
        COMMERCIAL_SUBMITTED: {
          target: 'AwaitingApproval',
          actions: assign((ctx, e) => {
            persist(ctx, 'AwaitingApproval', 'COMMERCIAL_SUBMITTED', { kind: (e as any).kind });
            return { status: 'AwaitingApproval', hasControllingCommercial: true };
          }),
        },
        WO_VISIT_NO_ACCESS: {
          actions: assign((ctx) => { persist(ctx, 'InProgress', 'NO_ACCESS'); return ctx; }),
        },
      },
    },

    Complete: {
      entry: assign((ctx) => {
        // Spawn QA review; qaRequired already set by policy at JOB_CREATED (can also be changed via FLAGS)
        const qa = spawn(qaReviewMachine({ id: `${ctx.jobId}-qa`, jobId: ctx.jobId! }), { name: `qa:${ctx.jobId}` });
        return { _qa: qa };
      }),
      on: {
        CLOSED: {
          target: 'Closed',
          cond: canClose,
          actions: assign((ctx) => {
            persist(ctx, 'Closed', 'CLOSED');
            return { status: 'Closed' };
          }),
        },
      },
    },

    OnHold: {
      on: {
        RESUME: {
          target: 'ReturnHistory',
          actions: [
            resumeSLA,
            assign((ctx) => {
              const target = ctx.holdReturnTo ?? 'Triage';
              persist(ctx, target, 'RESUME', { returnTo: target });
              return { status: target, holdReason: undefined, holdReturnTo: undefined };
            }),
          ],
        },
      },
    },

    Cancelled: { type: 'final' },

    Closed: {
      type: 'final',
      entry: assign((ctx) => {
        const ret = spawn(retentionMachine({ jobId: ctx.jobId!, archiveAtDays: 365, purgeAtDays: 1825 }), { name: `ret:${ctx.jobId}` });
        return { _retention: ret };
      }),
    },
  },
});
