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
  const events = (Array.isArray(req.body) ? req.body : [req.body]).map((e:any) => ({
    version: 1,
    occurredAt: e.occurredAt ?? new Date().toISOString(),
    id: e.id ?? uuid(),
    tenantId, jobId,
    type: e.type,
    payload: e.payload ?? {},
    meta: e.meta ?? {},
  }));
  const result = await eventStore.append(jobId, events as any);
  // fan-out to subscribers
  await Promise.all(events.map(handleEvent));
  res.json(result);
});

/** Full stream */
jobsRouter.get('/:jobId/stream', async (req, res) => {
  const { jobId } = req.params;
  const events = await eventStore.load(jobId);
  res.json(events);
});

/** Snapshot (reduced) */
jobsRouter.get('/:jobId/snapshot', async (req, res) => {
  const { jobId } = req.params;
  const tenantId = String(req.query.tenantId ?? 'default');
  const events = await eventStore.load(jobId);
  const snap = reduceToSnapshot(tenantId, jobId, events);
  res.json(snap);
});
