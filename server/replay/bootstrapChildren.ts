// Guidance utilities to re-bootstrap child actors from a snapshot (no runtime binding here).
import type { JobSnapshot } from '../schemas/state.zod';

export interface BootstrapPlan {
  spawnSLAWatchdog: boolean;
  spawnCertMonitor: boolean;
  spawnNotifier: boolean;
  spawnQAIfComplete: boolean;
}

export function deriveBootstrapPlan(snapshot: JobSnapshot): BootstrapPlan {
  const plan: BootstrapPlan = {
    spawnSLAWatchdog: true,
    spawnCertMonitor: true,
    spawnNotifier: true,
    spawnQAIfComplete: snapshot.status === 'Complete',
  };
  return plan;
}
