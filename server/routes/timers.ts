import express from 'express';
import { timerStore } from '../timers/timerStore';
import { tickTimers } from '../timers/scheduler';

export const timersRouter = express.Router();

timersRouter.post('/schedule', (req, res) => {
  const id = timerStore.schedule(req.body);
  res.json({ id });
});

timersRouter.post('/tick', async (_req, res) => {
  const n = await tickTimers();
  res.json({ fired: n });
});
