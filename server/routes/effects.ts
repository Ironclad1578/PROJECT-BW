import express from 'express';
import { outbox } from '../outbox/outboxStore';
import { tickDispatcher } from '../outbox/dispatcher';

export const effectsRouter = express.Router();

effectsRouter.post('/outbox/push', (req, res) => {
  const id = outbox.add(req.body);
  res.json({ id });
});

effectsRouter.post('/outbox/dispatch', async (_req, res) => {
  const n = await tickDispatcher();
  res.json({ processed: n });
});
