type Row = {
  tenantId: string;
  jobId: string;
  type: string;
  message: string;
  payload?: unknown;
  at: string;
};

class InMemoryAudit {
  private rows: Row[] = [];
  async append(row: Row) { this.rows.push(row); }
  async list(tenantId: string, jobId?: string) {
    return this.rows.filter(r => r.tenantId===tenantId && (!jobId || r.jobId===jobId));
  }
}

export const auditLog = new InMemoryAudit();
