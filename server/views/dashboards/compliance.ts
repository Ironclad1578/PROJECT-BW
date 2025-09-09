import { eventStore } from '../../store/eventStore';

export async function listCompliance(tenantId: string) {
  // naive scan across all jobs known in store (in prod, index by tenant)
  // here we reconstruct from in-memory store keys by peeking private field
  // For the skeleton, we require a jobId be provided from caller; otherwise, return empty.
  return {
    imminent: [] as { jobId: string; name: string }[],
    expired:  [] as { jobId: string; name: string }[],
  };
}

/** Helper for a single job (typical UI path) */
export async function complianceForJob(jobId: string) {
  const events = await eventStore.load(jobId);
  const imminent = new Set<string>();
  const expired  = new Set<string>();
  for (const e of events) {
    if (e.type === 'CERT_IMMINENT') imminent.add((e.payload as any).name);
    if (e.type === 'CERT_EXPIRED')  expired.add((e.payload as any).name);
  }
  return {
    jobId,
    imminent: [...imminent],
    expired:  [...expired],
  };
}
