import client from 'prom-client';

client.collectDefaultMetrics();

export const counters = {
  outbox_delivered: new client.Counter({
    name: 'outbox_delivered_total',
    help: 'Outbox deliveries by type',
    labelNames: ['type','name'] as const,
  }),
  events_appended: new client.Counter({
    name: 'events_appended_total',
    help: 'Domain events appended',
    labelNames: ['type'] as const,
  }),
};

export function metricsText() {
  return client.register.metrics();
}
