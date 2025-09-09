export interface Limits { maxOpenJobs: number; maxEventsPerMinute: number; }
const defaults: Limits = { maxOpenJobs: 50_000, maxEventsPerMinute: 10_000 };

const byTenant = new Map<string, Limits>();

export function getLimits(tenantId: string): Limits {
  return byTenant.get(tenantId) ?? defaults;
}

export function setLimits(tenantId: string, limits: Partial<Limits>) {
  const current = getLimits(tenantId);
  byTenant.set(tenantId, { ...current, ...limits });
}
