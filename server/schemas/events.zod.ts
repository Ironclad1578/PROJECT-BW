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

const JobStatusChangedSchema = BaseEventSchema.extend({
  type: z.literal('JobStatusChanged'),
  payload: z.object({
    from: z.string().optional(),
    to: z.string(),
    reason: z.string().optional(),
    intent: z.string().optional(),
  }),
});

const CertImminentSchema = BaseEventSchema.extend({
  type: z.literal('CERT_IMMINENT'),
  payload: z.object({ name: z.string(), expiresAt: ISO }),
});
const CertExpiredSchema = BaseEventSchema.extend({
  type: z.literal('CERT_EXPIRED'),
  payload: z.object({ name: z.string(), expiresAt: ISO }),
});

const SLAEventSchemas = [
  BaseEventSchema.extend({ type: z.literal('SLA_RESPOND_IMMINENT'), payload: z.object({ at: ISO }) }),
  BaseEventSchema.extend({ type: z.literal('SLA_RESPOND_BREACHED'), payload: z.object({ at: ISO }) }),
  BaseEventSchema.extend({ type: z.literal('SLA_DUE_IMMINENT'),     payload: z.object({ at: ISO }) }),
  BaseEventSchema.extend({ type: z.literal('SLA_DUE_BREACHED'),     payload: z.object({ at: ISO }) }),
];

export const EventUnionSchema = z.discriminatedUnion('type', [
  JobStatusChangedSchema,
  CertImminentSchema,
  CertExpiredSchema,
  ...SLAEventSchemas,
]);
export type ValidatedEvent = z.infer<typeof EventUnionSchema>;
