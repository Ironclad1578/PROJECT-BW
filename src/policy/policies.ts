// PATH: src/policy/policies.ts
import type { JobIntent } from '@/constants/codes';

export type TradeKey =
  | 'Electrical' | 'Gas' | 'Plumbing' | 'Joinery' | 'Roofing' | 'Glazing' | 'General';

export interface SlaPolicy {
  respondImminentMins: number; // when to warn
  dueImminentMins: number;
}

export interface EvidencePolicy {
  minPhotosBefore: number;
  minPhotosAfter: number;
  requireClientSignoff: boolean;
  requiredCertificates?: ('GasSafe'|'EICR'|'PAT'|'FRA')[];
}

export interface AuthorityPolicy {
  defaultCapGBP: number; // NTE
  roleOverrides?: Partial<Record<'ClientOwner'|'ClientAgent'|'Employee'|'Admin', number>>;
}

/** Controls compliance behaviour like auto-HOLDs on certificate expiry */
export interface CompliancePolicy {
  autoHoldOnCertExpiry: boolean;
  /** Use a label that exists in HoldReason; e.g. 'Compliance' or 'PermitRejected' */
  holdReason: string;
}

export interface IntentPolicy {
  sla: SlaPolicy;
  evidence: EvidencePolicy;
  authority: AuthorityPolicy;
  /** If true, QA must pass before Close */
  qaRequired: boolean;
  /** Compliance behaviour; defaults vary per intent */
  compliance: CompliancePolicy;
}

const DEFAULT_POLICY: IntentPolicy = {
  sla: { respondImminentMins: 120, dueImminentMins: 240 },
  evidence: { minPhotosBefore: 1, minPhotosAfter: 2, requireClientSignoff: true },
  authority: { defaultCapGBP: 0 },
  qaRequired: true,
  compliance: { autoHoldOnCertExpiry: true, holdReason: 'Compliance' },
};

export const INTENT_POLICIES: Record<JobIntent, IntentPolicy> = {
  Emergency: {
    sla: { respondImminentMins: 30, dueImminentMins: 30 },
    evidence: { minPhotosBefore: 2, minPhotosAfter: 2, requireClientSignoff: true },
    authority: { defaultCapGBP: 250, roleOverrides: { ClientOwner: 500, Admin: 999999 } },
    qaRequired: true,
    compliance: { autoHoldOnCertExpiry: true, holdReason: 'Compliance' },
  },
  Reactive: {
    sla: { respondImminentMins: 120, dueImminentMins: 180 },
    evidence: { minPhotosBefore: 2, minPhotosAfter: 2, requireClientSignoff: true },
    authority: { defaultCapGBP: 200, roleOverrides: { ClientOwner: 400, Admin: 999999 } },
    qaRequired: true,
    compliance: { autoHoldOnCertExpiry: true, holdReason: 'Compliance' },
  },
  Planned: {
    sla: { respondImminentMins: 240, dueImminentMins: 360 },
    evidence: { minPhotosBefore: 1, minPhotosAfter: 2, requireClientSignoff: true },
    authority: { defaultCapGBP: 0, roleOverrides: { Admin: 999999 } },
    qaRequired: true,
    compliance: { autoHoldOnCertExpiry: true, holdReason: 'Compliance' },
  },
  Warranty: {
    sla: { respondImminentMins: 180, dueImminentMins: 240 },
    evidence: { minPhotosBefore: 1, minPhotosAfter: 2, requireClientSignoff: true, requiredCertificates: [] },
    authority: { defaultCapGBP: 0, roleOverrides: { Admin: 0 } },
    qaRequired: true,
    compliance: { autoHoldOnCertExpiry: true, holdReason: 'Compliance' },
  },
  New: {
    sla: { respondImminentMins: 240, dueImminentMins: 480 },
    evidence: { minPhotosBefore: 0, minPhotosAfter: 0, requireClientSignoff: false },
    authority: { defaultCapGBP: 0 },
    qaRequired: false,
    compliance: { autoHoldOnCertExpiry: false, holdReason: 'Compliance' },
  },
  FollowOn: {
    sla: { respondImminentMins: 120, dueImminentMins: 240 },
    evidence: { minPhotosBefore: 1, minPhotosAfter: 2, requireClientSignoff: true },
    authority: { defaultCapGBP: 150, roleOverrides: { ClientOwner: 300, Admin: 999999 } },
    qaRequired: true,
    compliance: { autoHoldOnCertExpiry: true, holdReason: 'Compliance' },
  },
  FollowOnWorks: {
    sla: { respondImminentMins: 120, dueImminentMins: 240 },
    evidence: { minPhotosBefore: 1, minPhotosAfter: 2, requireClientSignoff: true },
    authority: { defaultCapGBP: 150 },
    qaRequired: true,
    compliance: { autoHoldOnCertExpiry: true, holdReason: 'Compliance' },
  },
};

export const TRADE_REQUIRED_CERTS: Partial<Record<TradeKey, EvidencePolicy['requiredCertificates']>> = {
  Electrical: ['EICR', 'PAT'],
  Gas: ['GasSafe'],
};

export function authorityCapForRole(
  base: AuthorityPolicy,
  role: keyof NonNullable<AuthorityPolicy['roleOverrides']> | undefined
) {
  if (!role) return base.defaultCapGBP;
  const ov = base.roleOverrides?.[role];
  return ov ?? base.defaultCapGBP;
}

/** Helper: safe policy lookup with defaults */
export function intentPolicy(intent?: JobIntent): IntentPolicy {
  if (!intent) return DEFAULT_POLICY;
  return INTENT_POLICIES[intent] ?? DEFAULT_POLICY;
}
