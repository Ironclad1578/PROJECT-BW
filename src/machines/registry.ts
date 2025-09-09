// PATH: src/machines/registry.ts
import { spawn } from 'xstate';

export function spawnOnce<TCtx>(
  ctx: Record<string, any>,
  bucketKey: keyof TCtx & string,
  id: string,
  actorFactoryOrMachine: any,
  namePrefix: string
) {
  const bucket = (ctx as any)[bucketKey] ?? {};
  if (!bucket[id]) {
    const toSpawn =
      typeof actorFactoryOrMachine === 'function'
        ? actorFactoryOrMachine()
        : actorFactoryOrMachine;
    bucket[id] = spawn(toSpawn, { name: `${namePrefix}:${id}` });
    (ctx as any)[bucketKey] = bucket;
  }
  return bucket[id];
}
