// PATH: src/machines/notificationMachine.ts
import { createMachine, assign } from 'xstate';
import { fakeApi } from '@/api/fakeApi';

interface Ctx {
  jobId: string;
  recipients: { client?: string[]; contractor?: string[]; internal?: string[] };
  _pendingName?: string;
  _pendingPayload?: any;
}

type Ev =
  | { type: 'EVENT'; name: string; payload?: any }
  | { type: 'DIGEST_DUE' };

export const notificationMachine = (seed: Ctx) =>
  createMachine<Ctx, Ev>({
    id: `notify:${seed.jobId}`,
    context: seed,
    initial: 'ready',
    states: {
      ready: {
        on: {
          EVENT: {
            target: 'sending',
            actions: assign((_ctx, e: any) => ({
              _pendingName: e.name,
              _pendingPayload: e.payload,
            })),
          },
          DIGEST_DUE: { target: 'digesting' },
        },
      },

      sending: {
        invoke: {
          id: 'sendNotification',
          src: (ctx) =>
            fakeApi.notifications.send({
              jobId: ctx.jobId,
              event: ctx._pendingName,
              payload: ctx._pendingPayload,
            }),
          onDone: {
            target: 'ready',
            actions: assign({ _pendingName: (_: Ctx) => undefined, _pendingPayload: (_: Ctx) => undefined }),
          },
          onError: {
            target: 'ready', // swallow for now; could add retries/backoff here
            actions: assign({ _pendingName: (_: Ctx) => undefined, _pendingPayload: (_: Ctx) => undefined }),
          },
        },
      },

      digesting: {
        invoke: {
          id: 'runDigest',
          src: (ctx) => fakeApi.notifications.digest({ jobId: ctx.jobId }),
          onDone: { target: 'ready' },
          onError: { target: 'ready' },
        },
      },
    },
  });
