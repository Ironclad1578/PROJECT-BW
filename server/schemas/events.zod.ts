import { z } from 'zod';

export const UUID = z.string().min(8);
export const ISO = z.string().datetime();

export const BaseEventSchema = z.object({
  id: UUID,
  type: z.string(),
  occurredAt: ISO,
  tenantId: z.string(),
  jobId: z.string(),
  version: z.literal(1),
  payload: z.unknown(),
  meta: z.record(z.unknown()).optional(),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

/** Narrowers for key events (extend as needed) */
export const CertImminentSchema = BaseEventSchema.extend({
  type: z.literal('CERT_IMMINENT'),
  payload: z.object({ name: z.string() }),
});
export const CertExpiredSchema = BaseEventSchema.extend({
  type: z.literal('CERT_EXPIRED'),
  payload: z.object({ name: z.string() }),
});

export const JobStatusChangedSchema = BaseEventSchema.extend({
  type: z.literal('JobStatusChanged'),
  payload: z.object({
    from: z.string().optional(),
    to: z.string(),
    reason: z.string().optional(),
    intent: z.string().optional(),
  }),
});

export const EventUnionSchema = z.discriminatedUnion('type', [
  CertImminentSchema,
  CertExpiredSchema,
  JobStatusChangedSchema,
  // keep extending here as you add strict schemas
]);
export type ValidatedEvent = z.infer<typeof EventUnionSchema>;
