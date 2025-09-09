import { auditLog } from '../observability/auditLog';

export async function exportAuditCSV(tenantId: string, jobId?: string) {
  const rows = await auditLog.list(tenantId, jobId);
  const header = ['at','tenantId','jobId','type','message','payload'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.at,
      csv(r.tenantId),
      csv(r.jobId),
      csv(r.type),
      csv(r.message),
      csv(JSON.stringify(r.payload ?? '')),
    ].join(','));
  }
  return lines.join('\n');
}

function csv(s: string) {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g,'""')}"`;
  }
  return s;
}
