// PATH: src/machines/retentionMachine.ts
import { createMachine, assign, sendParent } from 'xstate';

interface Ctx { jobId: string; legalHold?: boolean; archiveAtDays: number; purgeAtDays: number; }
type Ev =
  | { type: 'LEGAL_HOLD_ON' }
  | { type: 'LEGAL_HOLD_OFF' }
  | { type: 'ARCHIVE' }
  | { type: 'PURGE' };

export const retentionMachine = (seed: Partial<Ctx>) =>
  createMachine<Ctx, Ev>({
    id: `retention:${seed.jobId ?? 'job'}`,
    context: { jobId: seed.jobId ?? '', archiveAtDays: seed.archiveAtDays ?? 365, purgeAtDays: seed.purgeAtDays ?? 1825 },
    initial: 'Active',
    states: {
      Active: {
        on: { ARCHIVE: { target: 'Archived', actions: sendParent({ type: 'RETENTION_ARCHIVED' }) } },
      },
      Archived: {
        on: {
          LEGAL_HOLD_ON:  { actions: assign({ legalHold: (_)=>true }) },
          LEGAL_HOLD_OFF: { actions: assign({ legalHold: (_)=>false }) },
          PURGE: [
            { cond: (c)=> !!c.legalHold, actions: (_)=>{} }, // blocked
            { target: 'Purged', actions: sendParent({ type: 'RETENTION_PURGED' }) },
          ],
        },
      },
      Purged: { type: 'final' },
    },
  });
