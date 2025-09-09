export type Role = 'Admin'|'Employee'|'ClientOwner'|'ClientAgent'|'Contractor'|'Engineer'|'Tenant';

export function canViewJob(role: Role) {
  return ['Admin','Employee','ClientOwner','ClientAgent'].includes(role);
}
export function canMutateJob(role: Role) {
  return ['Admin','Employee'].includes(role);
}
export function canExportAudit(role: Role) {
  return ['Admin'].includes(role);
}
