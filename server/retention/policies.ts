export interface RetentionPolicy {
  archiveAfterDays: number;
  purgeAfterDays: number;
}

const defaults: RetentionPolicy = { archiveAfterDays: 365, purgeAfterDays: 1825 };

export function policyForTenant(_tenantId: string): RetentionPolicy {
  return defaults;
}
