import type { AirtableRecord } from '@/types/airtable';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { getUsedGearWorkflowPostPublishSnapshot } from '@/services/usedGearWorkflowLifecycle';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const USED_GEAR_PENDING_REVIEW_ALERT_DAYS = 3;
export const USED_GEAR_PROGRESS_ALERT_DAYS = 5;
export const USED_GEAR_ACTIVE_LISTING_WARNING_DAYS = 30;
export const USED_GEAR_STALE_FOLLOW_UP_ALERT_DAYS = 14;

export interface UsedGearQueueAgingSummary {
  alertCount: number;
  oldestAgeDays: number | null;
}

export interface UsedGearPostPublishAgingSummary {
  activeNearStaleCount: number;
  staleFollowUpCount: number;
  oldestListedAgeDays: number | null;
  oldestStaleAgeDays: number | null;
}

function getAgeDaysFromTimestamp(value: string | null | undefined, nowMs: number): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.floor((nowMs - parsed) / MS_PER_DAY));
}

function getOldestAgeDays(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => value !== null);
  if (validValues.length === 0) {
    return null;
  }

  return Math.max(...validValues);
}

export function formatUsedGearAgeDays(days: number | null, pendingLabel = 'Pending'): string {
  if (days === null) {
    return pendingLabel;
  }

  return `${days}d`;
}

export function getPendingReviewAgeDays(record: AirtableRecord, nowMs = Date.now()): number | null {
  return getAgeDaysFromTimestamp(record.createdTime, nowMs);
}

export function buildPendingReviewQueueAgingSummary(records: AirtableRecord[], nowMs = Date.now()): UsedGearQueueAgingSummary {
  const ageDays = records.map((record) => getPendingReviewAgeDays(record, nowMs));
  return {
    alertCount: ageDays.filter((days) => days !== null && days >= USED_GEAR_PENDING_REVIEW_ALERT_DAYS).length,
    oldestAgeDays: getOldestAgeDays(ageDays),
  };
}

function getProgressStageStartedAt(record: AirtableRecord): string | null {
  const status = getUsedGearWorkflowStatus(record.fields);

  if (status === 'Accepted - Awaiting Arrival'
    || status === 'Accepted - Arrived, Awaiting SKU'
    || status === 'Accepted - Arrived, Awaiting Missing Item') {
    return typeof record.fields['Accepted At'] === 'string' ? record.fields['Accepted At'] : record.createdTime;
  }

  if (status === 'Testing and Photography In Progress') {
    return typeof record.fields['Processing Signed At'] === 'string' ? record.fields['Processing Signed At'] : record.createdTime;
  }

  if (status === 'Awaiting Pre-Listing Review') {
    return typeof record.fields['Awaiting Pre-Listing Review At'] === 'string' ? record.fields['Awaiting Pre-Listing Review At'] : record.createdTime;
  }

  if (status === 'Approved for Publish') {
    return typeof record.fields['Approved For Publish At'] === 'string' ? record.fields['Approved For Publish At'] : record.createdTime;
  }

  return record.createdTime;
}

export function getWorkflowProgressAgeDays(record: AirtableRecord, nowMs = Date.now()): number | null {
  return getAgeDaysFromTimestamp(getProgressStageStartedAt(record), nowMs);
}

export function buildWorkflowProgressQueueAgingSummary(records: AirtableRecord[], nowMs = Date.now()): UsedGearQueueAgingSummary {
  const ageDays = records.map((record) => getWorkflowProgressAgeDays(record, nowMs));
  return {
    alertCount: ageDays.filter((days) => days !== null && days >= USED_GEAR_PROGRESS_ALERT_DAYS).length,
    oldestAgeDays: getOldestAgeDays(ageDays),
  };
}

export function buildPostPublishQueueAgingSummary(records: AirtableRecord[], nowMs = Date.now()): UsedGearPostPublishAgingSummary {
  const snapshots = records
    .map((record) => getUsedGearWorkflowPostPublishSnapshot(record, nowMs))
    .filter((snapshot): snapshot is NonNullable<ReturnType<typeof getUsedGearWorkflowPostPublishSnapshot>> => snapshot !== null);

  const activeListedDays = snapshots
    .filter((snapshot) => snapshot.bucket === 'active-listing')
    .map((snapshot) => snapshot.daysSinceListed);
  const staleAgeDays = snapshots
    .filter((snapshot) => snapshot.bucket === 'stale-listing')
    .map((snapshot) => getAgeDaysFromTimestamp(snapshot.staleListingAt ?? snapshot.listedAt, nowMs));

  return {
    activeNearStaleCount: activeListedDays.filter((days) => days !== null && days >= USED_GEAR_ACTIVE_LISTING_WARNING_DAYS).length,
    staleFollowUpCount: staleAgeDays.filter((days) => days !== null && days >= USED_GEAR_STALE_FOLLOW_UP_ALERT_DAYS).length,
    oldestListedAgeDays: getOldestAgeDays(activeListedDays),
    oldestStaleAgeDays: getOldestAgeDays(staleAgeDays),
  };
}