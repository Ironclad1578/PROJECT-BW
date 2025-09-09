// PATH: src/machines/eligibilityMachine.ts
import { createMachine, sendParent, assign } from 'xstate';

interface Ctx {
  engineerId?: string;
  trade?: string;
  certsOk?: boolean;
  insuranceOk?: boolean;
  dbsOk?: boolean;
  blockedReasons?: string[];
}

type Ev =
  | { type: 'SET'; engineerId: string; trade: string }
  | { type: 'CHECK'; certsOk: boolean; insuranceOk: boolean; dbsOk: boolean; reasons?: string[] };

export const eligibilityMachine = createMachine<Ctx, Ev>({
  id: 'eligibility',
  initial: 'idle',
  context: {},
  states: {
    idle: {
      on: {
        SET: {
          target: 'checking',
          actions: assign((_c, e) => ({ engineerId: e.engineerId, trade: e.trade })),
        },
      },
    },
    checking: {
      on: {
        CHECK: [
          {
            cond: (_c, e: any) => e.certsOk && e.insuranceOk && e.dbsOk,
            target: 'eligible',
            actions: sendParent({ type: 'ELIGIBILITY_OK' }),
          },
          {
            target: 'ineligible',
            actions: [
              assign((_c, e: any) => ({
                certsOk: e.certsOk,
                insuranceOk: e.insuranceOk,
                dbsOk: e.dbsOk,
                blockedReasons: e.reasons ?? [],
              })),
              sendParent({ type: 'ELIGIBILITY_FAIL' }),
            ],
          },
        ],
      },
    },
    eligible: { type: 'final' },
    ineligible: { type: 'final' },
  },
});
