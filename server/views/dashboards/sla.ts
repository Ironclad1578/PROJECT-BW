import { eventStore } from '../../store/eventStore';

export async function slaSignals(jobId: string) {
  const events = await eventStore.load(jobId);
  const timeline = events.filter(e => e.type.startsWith('SLA_'))
    .map(e => ({ type: e.type, at: e.occurredAt }));
  const breached = timeline.some(t => t.type.endsWith('BREACHED'));
  return { jobId, breached, timeline };
}
