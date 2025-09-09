import { outbox, OutboxItem } from './outboxStore';
import * as activities from '../effects/activities';
import * as notifications from '../effects/notifications';
import * as metrics from '../effects/metrics';

async function handle(item: OutboxItem) {
  try {
    switch (item.type) {
      case 'activity':       await activities.write(item); break;
      case 'notification':   await notifications.deliver(item); break;
      case 'metrics':        await metrics.push(item); break;
      case 'webhook':        await notifications.webhook(item); break;
      default: throw new Error(`Unknown outbox type: ${item.type}`);
    }
    outbox.markSuccess(item.id);
  } catch (err) {
    outbox.markFailure(item.id);
  }
}

export async function tickDispatcher(limit = 50) {
  const items = outbox.claimDue(limit);
  await Promise.all(items.map(handle));
  return items.length;
}
