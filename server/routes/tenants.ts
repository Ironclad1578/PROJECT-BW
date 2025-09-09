import express from 'express';
import { listDLQ } from '../runtime/dlq';
import { getLimits, setLimits } from '../runtime/limits';

export const tenantsRouter = express.Router();

tenantsRouter.get('/:tenantId/limits', (req, res) => {
  res.json(getLimits(req.params.tenantId));
});

tenantsRouter.post('/:tenantId/limits', (req, res) => {
  setLimits(req.params.tenantId, req.body ?? {});
  res.json(getLimits(req.params.tenantId));
});

tenantsRouter.get('/:tenantId/dlq', (req, res) => {
  res.json(listDLQ(req.params.tenantId));
});
