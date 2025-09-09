export function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const clone: any = Array.isArray(obj) ? [] : {};
  for (const [k,v] of Object.entries(obj as Record<string, unknown>)) {
    if (/password|secret|token|apiKey/i.test(k)) clone[k] = '***';
    else clone[k] = v;
  }
  return clone;
}
