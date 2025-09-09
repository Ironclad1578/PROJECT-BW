import { z } from 'zod';

export const JobSnapshotSchema = z.object({
  jobId: z.string(),
  tenantId: z.string(),
  status: z.string(),
  intent: z.string().optional(),
  updatedAt: z.string().datetime(),
  data: z.record(z.unknown()).optional(), // arbitrary extra state
});
export type JobSnapshot = z.infer<typeof JobSnapshotSchema>;
