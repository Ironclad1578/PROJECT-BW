// PATH: src/selectors/jobSelectors.ts
import type { JobStatus } from '@/constants/codes';
// If this import ever causes a cycle in your build, copy the type below locally.
// import type { JobContext } from '@/machines/jobMachine';
export interface JobContext {
  status: JobStatus;
  dueBy?: string;
  slaPaused?: boolean;
  slaPausedAt?: number;
  slaPauseTotalMs?: number;

  // dynamic flags referenced here
  hasAssignee?: boolean;
  hasVisitTime?: boolean;
  permitsRequired?: boolean;
  hasActivePTW?: boolean;
  hasControllingCommercial?: boolean;
  hasApprovedCommercial?: boolean;
  withinAuthority?: boolean;
  hasReport?: boolean;
  hasPhotos?: boolean;
  hasClientSignoff?: boolean;
  invoicesOk?: boolean;
  hasApprovedRAMS?: boolean;
}

export function slaRemainingMs(c: JobContext) {
  if (!c.dueBy) return Infinity;
  const target = new Date(c.dueBy).getTime();
  const pausedAcc = c.slaPaused && c.slaPausedAt ? (Date.now() - c.slaPausedAt) : 0;
  return target - (Date.now() + (c.slaPauseTotalMs ?? 0) + pausedAcc);
}

export function nextActions(c: JobContext): string[] {
  const a: string[] = [];
  switch (c.status) {
    case 'Draft': a.push('JOB_CREATED'); break;
    case 'Triage':
      a.push('ASSIGNED');
      if (c.hasControllingCommercial) a.push('APPROVED_TO_START');
      break;
    case 'Assigned':
      if (c.hasAssignee && c.hasVisitTime) a.push('SCHEDULED');
      break;
    case 'Scheduled':
      if (!c.permitsRequired || c.hasActivePTW) a.push('ARRIVED_ONSITE');
      break;
    case 'OnSite':
      a.push('WORKS_FINISHED');
      break;
    case 'AwaitingReport':
      a.push('REPORT_SAVED');
      break;
    case 'AwaitingApproval':
      if (c.withinAuthority || (c.hasControllingCommercial && c.hasApprovedCommercial)) a.push('APPROVED_TO_START');
      break;
    case 'InProgress':
      a.push('WORKS_COMPLETED');
      break;
    case 'Complete':
      if (c.hasReport && c.hasPhotos && c.hasApprovedRAMS && c.hasClientSignoff && c.invoicesOk) a.push('CLOSED');
      break;
  }
  if (c.status !== 'Closed' && c.status !== 'Cancelled') a.push('HOLD', 'CANCEL');
  return a;
}

export function definitionOfDoneGaps(c: JobContext) {
  const gaps: string[] = [];
  if (c.status === 'Scheduled' && c.permitsRequired && !c.hasActivePTW) gaps.push('Permit to Work not active');
  if (c.status === 'AwaitingApproval' && !(c.withinAuthority || (c.hasApprovedCommercial && c.hasControllingCommercial))) gaps.push('No authority or approved commercial');
  if (c.status === 'Complete') {
    if (!c.hasReport) gaps.push('Report missing');
    if (!c.hasPhotos) gaps.push('Evidence photos missing');
    if (!c.hasClientSignoff) gaps.push('Client sign-off missing');
    if (!c.invoicesOk) gaps.push('Invoice status not OK');
  }
  return gaps;
}

export function jobHealthScore(c: JobContext) {
  // toy heuristic: higher is better
  let score = 100;
  if (c.slaPaused) score -= 5;
  if (c.status === 'AwaitingApproval' && !c.hasApprovedCommercial) score -= 15;
  if (c.status === 'Scheduled' && c.permitsRequired && !c.hasActivePTW) score -= 20;
  if (c.status === 'InProgress' && !c.hasApprovedRAMS) score -= 25;
  if (!c.invoicesOk) score -= 10;
  return Math.max(0, score);
}
