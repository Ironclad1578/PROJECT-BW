// Pure computations that propose timers given job state/policy
export interface SLAPolicy {
  respondBy?: number; // epoch ms
  dueBy?: number;
  respondImminentMs: number;
  dueImminentMs: number;
}

export function computeSLATimers(now: number, pol: SLAPolicy) {
  const out: { kind: string; fireAt: number }[] = [];
  if (pol.respondBy) {
    out.push({ kind: 'SLA_RESPOND_IMMINENT', fireAt: pol.respondBy - pol.respondImminentMs });
    out.push({ kind: 'SLA_RESPOND_BREACHED', fireAt: pol.respondBy });
  }
  if (pol.dueBy) {
    out.push({ kind: 'SLA_DUE_IMMINENT', fireAt: pol.dueBy - pol.dueImminentMs });
    out.push({ kind: 'SLA_DUE_BREACHED', fireAt: pol.dueBy });
  }
  return out.filter(t => t.fireAt >= now);
}

export function computeCertTimers(now: number, expiresAt: number, warnBeforeMs: number) {
  return [
    { kind: 'CERT_IMMINENT', fireAt: expiresAt - warnBeforeMs },
    { kind: 'CERT_EXPIRED',  fireAt: expiresAt },
  ].filter(t => t.fireAt >= now);
}
