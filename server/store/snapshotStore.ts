import type { JobSnapshot } from '../schemas/state.zod';

export interface SnapshotStore {
  save(jobId: string, snapshot: JobSnapshot, version: number): Promise<void>;
  loadLatest(jobId: string): Promise<{ version: number; snapshot: JobSnapshot } | null>;
}

export class InMemorySnapshotStore implements SnapshotStore {
  private map = new Map<string, { version: number; snapshot: JobSnapshot }>();

  async save(jobId: string, snapshot: JobSnapshot, version: number) {
    this.map.set(jobId, { version, snapshot });
  }

  async loadLatest(jobId: string) {
    return this.map.get(jobId) ?? null;
  }
}

export const snapshotStore: SnapshotStore = new InMemorySnapshotStore();
