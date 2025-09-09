// Consistent hash sharding (skeleton)
export function shardKey(tenantId: string, jobId: string, shards = 16) {
  const key = `${tenantId}:${jobId}`;
  let h = 2166136261;
  for (let i=0;i<key.length;i++) h = (h ^ key.charCodeAt(i)) * 16777619;
  return Math.abs(h) % shards;
}
