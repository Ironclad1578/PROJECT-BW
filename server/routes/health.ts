import express from 'express';
import { metricsText } from '../observability/metrics';

export const healthRouter = express.Router();

healthRouter.get('/healthz', (_req, res) => res.json({ ok: true }));
healthRouter.get('/readyz', (_req, res) => res.json({ ok: true }));
healthRouter.get('/metrics', async (_req, res) => {
  const text = await metricsText();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(text);
});
