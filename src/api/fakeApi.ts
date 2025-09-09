/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = (import.meta as any)?.env?.VITE_API_URL ?? process.env.API_URL ?? 'http://localhost:3100';

async function req<T>(path: string, opts: RequestInit & { asBlob?: boolean } = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    body: (opts as any).body ? JSON.stringify((opts as any).body) : undefined,
  };
  if (init.method === 'GET') delete (init.headers as any)['Content-Type'];

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${path}: ${text}`);
  }
  if ((opts as any).asBlob) return (await res.blob()) as any;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as any;
}

export const fakeApi = {
  events: {
    append: (tenantId: string, jobId: string, events: any[]) =>
      req(`/jobs/${encodeURIComponent(jobId)}/events?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'POST', body: events,
      }),
    stream: (jobId: string) => req(`/jobs/${encodeURIComponent(jobId)}/stream`),
    snapshot: (tenantId: string, jobId: string) =>
      req(`/jobs/${encodeURIComponent(jobId)}/snapshot?tenantId=${encodeURIComponent(tenantId)}`),
  },
  timers: {
    schedule: (t: any) => req('/timers/schedule', { method: 'POST', body: t }),
    tick: () => req('/timers/tick', { method: 'POST' }),
  },
  outbox: {
    push: (o: any) => req('/effects/outbox/push', { method: 'POST', body: o }),
    dispatch: () => req('/effects/outbox/dispatch', { method: 'POST' }),
  },
  dashboards: {
    sla: (jobId: string) => req(`/dashboards/sla/${encodeURIComponent(jobId)}`),
    compliance: (jobId: string) => req(`/dashboards/compliance/${encodeURIComponent(jobId)}`),
  },
  exports: {
    auditCsv: (tenantId: string, jobId?: string) =>
      req<string>(`/exports/audit.csv?tenantId=${encodeURIComponent(tenantId)}${jobId ? `&jobId=${encodeURIComponent(jobId)}`:''}`),
  },
  // Back-compat helpers the UI already used:
  activities: { append: (row: any) => req('/effects/outbox/push', { method: 'POST', body: { type:'activity', ...row } }) },
  notifications: {
    send: (row: any) => req('/effects/outbox/push', { method: 'POST', body: { type:'notification', ...row } }),
    digest: (_: any) => Promise.resolve(true),
  },
  jobs: {
    update: (tenantId: string, jobId: string, { status, intent, reason }: any) =>
      fakeApi.events.append(tenantId, jobId, [{
        type: 'JobStatusChanged',
        payload: { to: status, intent, reason },
      }]),
  },
};
