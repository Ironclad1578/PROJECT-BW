import express from 'express';
import { eventStore } from '../store/eventStore';
import { reduceToSnapshot } from '../replay/reconstitute';
import { handleEvent } from '../subscribers/index';
import { v4 as uuid } from 'uuid';

export const jobsRouter = express.Router();

/** Append events (idempotent by event.id per job) */
jobsRouter.post('/:jobId/events', async (req, res) => {
  const { jobId } = req.params;
  const tenantId = String(req.query.tenantId ?? 'default');
  const list = Array.isArray(req.body) ? req.body : [req.body];

  const events = list.map((e:any) => ({
    version: 1 as const,
    occurredAt: e.occurredAt ?? new Date().toISOString(),
    id: e.id ?? uuid(),
    type: e.type,
    tenantId,
    jobId,
    payload: e.payload ?? {},
    meta: e.meta ?? {},
  }));

  const result = await eventStore.append(jobId, events);
  // fan-out subscribers for newly appended only
  const appendedIds = new Set(events.map((e:any) => e.id));
  if (result.appended) {
    for (const ev of events) {
      if (appendedIds.has(ev.id)) await handleEvent(ev as any);
    }
  }
  res.json(result);
});

jobsRouter.get('/:jobId/stream', async (req, res) => {
  const { jobId } = req.params;
  const events = await eventStore.load(jobId);
  res.json(events);
});

jobsRouter.get('/:jobId/snapshot', async (req, res) => {
  const { jobId } = req.params;
  const tenantId = String(req.query.tenantId ?? 'default');
  const events = await eventStore.load(jobId);
  const snap = reduceToSnapshot(tenantId, jobId, events);
  res.json(snap);
});
