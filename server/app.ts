import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { jobsRouter } from './routes/jobs';
import { effectsRouter } from './routes/effects';
import { timersRouter } from './routes/timers';
import { dashboardsRouter } from './routes/dashboards';
import { exportsRouter } from './routes/exports';
import { healthRouter } from './routes/health';
import { tenantsRouter } from './routes/tenants';
import { startOTel } from './observability/otel';

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(morgan('dev'));

// routes
app.use('/jobs', jobsRouter);
app.use('/effects', effectsRouter);
app.use('/timers', timersRouter);
app.use('/dashboards', dashboardsRouter);
app.use('/exports', exportsRouter);
app.use('/', healthRouter);
app.use('/tenants', tenantsRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
// 500
app.use((err: any, _req: any, res: any, _next: any) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const otel = startOTel();
const port = process.env.PORT ? Number(process.env.PORT) : 3100;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on :${port}`);
});

process.on('SIGTERM', async () => { await otel.shutdown(); process.exit(0); });

export default app;
