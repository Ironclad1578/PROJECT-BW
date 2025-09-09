import express from 'express';
import { exportAuditCSV } from '../exports/auditCsv';

export const exportsRouter = express.Router();

exportsRouter.get('/audit.csv', async (req, res) => {
  const tenantId = String(req.query.tenantId ?? 'default');
  const jobId = req.query.jobId ? String(req.query.jobId) : undefined;
  const csv = await exportAuditCSV(tenantId, jobId);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});
