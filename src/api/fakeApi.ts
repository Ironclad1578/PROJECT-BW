// PATH: src/api/fakeApi.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

//
// Thin client to your server routes (events, timers, outbox, dashboards, exports)
// while keeping backward compatibility with existing app calls.
//
// Kept working:
// - fakeApi.jobs.update(tenantId, jobId, { status })
// - fakeApi.activities.append({ tenantId, jobId, type, message, meta })
// - fakeApi.notifications.send({ jobId, event, payload })
// - fakeApi.notifications.digest({ jobId })
//
// New:
// - fakeApi.events.append(tenantId, jobId, events[])
// - fakeApi.timers.schedule({ tenantId, jobId, kind, fireAt, payload })
// - fakeApi.timers.scheduleMany([...])
// - fakeApi.timers.cancel({ tenantId, jobId, kind })
// - fakeApi.effects.enqueue(...)
// - fakeApi.effects.dispatch()
// - fakeApi.dashboards.compliance(tenantId, jobId?)
// - fakeApi.dashboards.sla(tenantId, jobId?)
// - fakeApi.exports.auditCSV(...)
//

type Json = Record<string, any> | any[] | string | number | boolean | null;

export interface DomainEvent<T extends string = string, P = any> {
  type: T;
  at?: number;          // epoch ms; server will default to now if omitted
  payload?: P;
}

export interface OutboxEnqueueItem {
  kind: 'activity' | 'notification';
  tenantId?: string;
  jobId?: string;
  payload: Record<string, any>;
}

export type TimerKind =
  | 'SLA_RESPOND_IMMINENT' | 'SLA_RESPOND_BREACHED'
  | 'SLA_DUE_IMMINENT'     | 'SLA_DUE_BREACHED'
  | 'CERT_IMMINENT'        | 'CERT_EXPIRED';

export interface ScheduleTimerInput {
  tenantId: string;
  jobId: string;
  kind: TimerKind;
  fireAt: number; // epoch ms
  payload?: Record<string, any>;
}

export interface CancelTimerInput {
  tenantId: string;
  jobId: string;
  kind: TimerKind;
}

export interface AuditCsvParams {
  tenantId: string;
  from?: string; // ISO
  to?: string;   // ISO
  jobId?: string;
}

const DEFAULT_BASE =
  (typeof window !== 'undefined' && (window as any).__SERVER_BASE_URL__) ||
  (typeof process !== 'undefined' ? (process as any).env?.SERVER_BASE_URL : undefined) ||
  'http://localhost:3000';

async function request<T = any>(
  path: string,
  opts: RequestInit & { asBlob?: boolean } = {}
): Promise<T> {
  const url = `${DEFAULT_BASE}${path}`;
  const init: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    ...opts,
  };

  if (init.method === 'GET') {
    delete (init.headers as any)['Content-Type'];
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${path}: ${text}`);
  }
  if ((opts as any).asBlob) return (await res.blob()) as any;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as any;
}

function postJSON<T = any>(path: string, body: Json, init?: RequestInit) {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    ...(init || {}),
  });
}
function patchJSON<T = any>(path: string, body: Json, init?: RequestInit) {
  return request<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body ?? {}),
    ...(init || {}),
  });
}
function getJSON<T = any>(path: string, init?: RequestInit) {
  return request<T>(path, {
    method: 'GET',
    ...(init || {}),
  });
}

/** Back-compat activity payload shape used across the app */
interface ActivityAppendInput {
  tenantId: string;
  jobId: string;
  type: string;
  message: string;
  meta?: Record<string, any>;
}

/** Back-compat notification payloads */
interface NotificationSendInput {
  jobId: string;
  event: string;
  payload?: Record<string, any>;
}
interface NotificationDigestInput {
  jobId: string;
}

export const fakeApi = {
  // ---- Canonical event store ----
  events: {
    async append(
      tenantId: string,
      jobId: string,
      events: DomainEvent[]
    ): Promise<{ appended: number }> {
      return postJSON(`/jobs/${encodeURIComponent(jobId)}/events`, {
        tenantId,
        events,
      });
    },
  },

  // ---- Durable timers (SLA, certificates) ----
  timers: {
    async schedule(input: ScheduleTimerInput): Promise<{ id: string }> {
      return postJSON('/timers/schedule', input);
    },
    async scheduleMany(inputs: ScheduleTimerInput[]): Promise<{ ids: string[] }> {
      return postJSON('/timers/scheduleMany', { items: inputs });
    },
    async cancel(input: CancelTimerInput): Promise<{ ok: true }> {
      // Simple cancel by (tenantId, jobId, kind). Server can no-op if not found.
      return postJSON('/timers/cancel', input);
    },
  },

  // ---- Outbox / side-effects ----
  effects: {
    async enqueue(item: OutboxEnqueueItem): Promise<{ id: string }> {
      return postJSON('/effects/outbox/enqueue', item);
    },
    async dispatch(): Promise<{ dispatched: number }> {
      return postJSON('/effects/dispatch', {});
    },
  },

  // ---- Dashboards (server read models) ----
  dashboards: {
    async compliance(tenantId: string, jobId?: string) {
      const qp = new URLSearchParams({ tenantId, ...(jobId ? { jobId } : {}) });
      return getJSON(`/dashboards/compliance?${qp.toString()}`);
    },
    async sla(tenantId: string, jobId?: string) {
      const qp = new URLSearchParams({ tenantId, ...(jobId ? { jobId } : {}) });
      return getJSON(`/dashboards/sla?${qp.toString()}`);
    },
  },

  // ---- Exports (CSV) ----
  exports: {
    async auditCSV(params: AuditCsvParams): Promise<Blob> {
      const qp = new URLSearchParams({
        tenantId: params.tenantId,
        ...(params.jobId ? { jobId: params.jobId } : {}),
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
      });
      return request(`/exports/audit.csv?${qp.toString()}`, { method: 'GET', asBlob: true });
    },
  },

  // ============================================================================
  // Backward-compatible surface (re-implemented via events + outbox)
  // ============================================================================

  jobs: {
    /**
     * Back-compat: update job status, but implement as an event append + activity.
     * Callers historically passed: patch = { status: JobStatus }
     */
    async update(
      tenantId: string,
      jobId: string,
      patch: Partial<{ status: string; [k: string]: any }>
    ) {
      const events: DomainEvent[] = [];

      if (patch.status) {
        events.push({
          type: 'JobStatusChanged',
          payload: { next: patch.status },
        });
      }

      if (events.length > 0) {
        await fakeApi.events.append(tenantId, jobId, events);
      }

      // Also enqueue an activity to keep the UI timeline populated (server delivers).
      if (patch.status) {
        await fakeApi.effects.enqueue({
          kind: 'activity',
          tenantId,
          jobId,
          payload: {
            type: 'JobStatusChanged',
            message: `Status set to ${patch.status}`,
            meta: { to: patch.status },
          },
        });
      }

      return { ok: true };
    },
  },

  activities: {
    /**
     * Back-compat: previously wrote directly; now we enqueue an outbox "activity".
     */
    async append(input: ActivityAppendInput) {
      await fakeApi.effects.enqueue({
        kind: 'activity',
        tenantId: input.tenantId,
        jobId: input.jobId,
        payload: {
          type: input.type,
          message: input.message,
          meta: input.meta ?? {},
        },
      });
      return { ok: true };
    },
  },

  notifications: {
    /**
     * Back-compat: enqueue a notification via outbox; server will deliver.
     */
    async send(input: NotificationSendInput) {
      await fakeApi.effects.enqueue({
        kind: 'notification',
        jobId: input.jobId,
        payload: {
          channel: 'event',
          event: input.event,
          payload: input.payload ?? {},
        },
      });
      return { ok: true };
    },

    async digest(input: NotificationDigestInput) {
      await fakeApi.effects.enqueue({
        kind: 'notification',
        jobId: input.jobId,
        payload: {
          channel: 'digest',
        },
      });
      return { ok: true };
    },
  },
};

export default fakeApi;
