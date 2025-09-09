import express from 'express';
import { complianceForJob } from '../views/dashboards/compliance';
import { slaSignals } from '../views/dashboards/sla';

export const dashboardsRouter = express.Router();

dashboardsRouter.get('/compliance/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const result = await complianceForJob(jobId);
  res.json(result);
});

dashboardsRouter.get('/sla/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const result = await slaSignals(jobId);
  res.json(result);
});
