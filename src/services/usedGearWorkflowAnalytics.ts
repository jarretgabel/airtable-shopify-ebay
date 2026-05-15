import { getConfiguredRecords } from '@/services/app-api/airtable';
import {
  buildPendingReviewQueueAgingSummary,
  buildPostPublishQueueAgingSummary,
  buildWorkflowProgressQueueAgingSummary,
} from '@/services/usedGearWorkflowAging';
import {
  getUsedGearWorkflowStatus,
  USED_GEAR_WORKFLOW_STATUSES,
  type UsedGearWorkflowStatus,
} from '@/services/usedGearWorkflow';
import { getUsedGearWorkflowPostPublishSnapshot } from '@/services/usedGearWorkflowLifecycle';
import type { AirtableRecord } from '@/types/airtable';

const USED_GEAR_WORKFLOW_ANALYTICS_FIELDS = [
  'Workflow Status',
  'Workflow Owner',
  'Trash Status',
  'Accepted At',
  'Processing Signed At',
  'Awaiting Pre-Listing Review At',
  'Approved For Publish At',
  'Listed At',
  'Stale Listing At',
  'Sold Ready To Ship At',
  'Shipped At',
] as const;

const PROGRESS_STATUSES = new Set<UsedGearWorkflowStatus>([
  'Accepted - Awaiting Arrival',
  'Accepted - Arrived, Awaiting SKU',
  'Accepted - Arrived, Awaiting Missing Item',
  'Testing and Photography In Progress',
  'Awaiting Pre-Listing Review',
  'Approved for Publish',
]);

const POST_PUBLISH_STATUSES = new Set<UsedGearWorkflowStatus>([
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
  'Sold - Ready to Ship',
  'Shipped',
]);

export interface UsedGearWorkflowMarketplaceCounts {
  shopifyLiveCount: number;
  shopifyStaleCount: number;
  ebayLiveCount: number;
  ebayStaleCount: number;
  soldReadyCount: number;
  shippedCount: number;
}

export interface UsedGearWorkflowAnalyticsAgeSummary {
  pendingReviewAlertCount: number;
  oldestPendingReviewAgeDays: number | null;
  progressAlertCount: number;
  oldestProgressAgeDays: number | null;
  activeNearStaleCount: number;
  staleFollowUpCount: number;
  oldestListedAgeDays: number | null;
  oldestStaleAgeDays: number | null;
}

export interface UsedGearWorkflowAnalyticsLifecycleSummary {
  averageDaysToSell: number | null;
  averageDaysToShip: number | null;
  soldReadyAwaitingShipmentCount: number;
  oldestSoldReadyAgeDays: number | null;
}

export interface UsedGearWorkflowAnalyticsOwnershipSummary {
  pendingReviewMineCount: number;
  pendingReviewUnassignedCount: number;
  progressMineCount: number;
  progressUnassignedCount: number;
}

export interface UsedGearWorkflowAnalyticsSnapshot {
  totalCount: number;
  pendingReviewCount: number;
  trashCount: number;
  progressCount: number;
  postPublishCount: number;
  statusCounts: Record<UsedGearWorkflowStatus, number>;
  marketplace: UsedGearWorkflowMarketplaceCounts;
  age: UsedGearWorkflowAnalyticsAgeSummary;
  lifecycle: UsedGearWorkflowAnalyticsLifecycleSummary;
  ownership: UsedGearWorkflowAnalyticsOwnershipSummary;
}

function roundLifecycleDays(value: number): number {
  return Math.round(value * 10) / 10;
}

function createEmptyStatusCounts(): Record<UsedGearWorkflowStatus, number> {
  return Object.fromEntries(USED_GEAR_WORKFLOW_STATUSES.map((status) => [status, 0])) as Record<UsedGearWorkflowStatus, number>;
}

function createEmptyMarketplaceCounts(): UsedGearWorkflowMarketplaceCounts {
  return {
    shopifyLiveCount: 0,
    shopifyStaleCount: 0,
    ebayLiveCount: 0,
    ebayStaleCount: 0,
    soldReadyCount: 0,
    shippedCount: 0,
  };
}

function createEmptyOwnershipSummary(): UsedGearWorkflowAnalyticsOwnershipSummary {
  return {
    pendingReviewMineCount: 0,
    pendingReviewUnassignedCount: 0,
    progressMineCount: 0,
    progressUnassignedCount: 0,
  };
}

export function createEmptyUsedGearWorkflowAnalyticsSnapshot(): UsedGearWorkflowAnalyticsSnapshot {
  return {
    totalCount: 0,
    pendingReviewCount: 0,
    trashCount: 0,
    progressCount: 0,
    postPublishCount: 0,
    statusCounts: createEmptyStatusCounts(),
    marketplace: createEmptyMarketplaceCounts(),
    age: {
      pendingReviewAlertCount: 0,
      oldestPendingReviewAgeDays: null,
      progressAlertCount: 0,
      oldestProgressAgeDays: null,
      activeNearStaleCount: 0,
      staleFollowUpCount: 0,
      oldestListedAgeDays: null,
      oldestStaleAgeDays: null,
    },
    lifecycle: {
      averageDaysToSell: null,
      averageDaysToShip: null,
      soldReadyAwaitingShipmentCount: 0,
      oldestSoldReadyAgeDays: null,
    },
    ownership: createEmptyOwnershipSummary(),
  };
}

export function buildUsedGearWorkflowAnalyticsSnapshot(
  records: AirtableRecord[],
  nowMs = Date.now(),
  currentUserName = '',
): UsedGearWorkflowAnalyticsSnapshot {
  const snapshot = createEmptyUsedGearWorkflowAnalyticsSnapshot();
  const pendingReviewRecords: AirtableRecord[] = [];
  const progressRecords: AirtableRecord[] = [];
  const postPublishRecords: AirtableRecord[] = [];
  const normalizedCurrentUserName = currentUserName.trim().toLowerCase();

  records.forEach((record) => {
    const status = getUsedGearWorkflowStatus(record.fields);
    const workflowOwner = typeof record.fields['Workflow Owner'] === 'string' ? record.fields['Workflow Owner'].trim() : '';
    const ownerMatchesCurrentUser = Boolean(
      normalizedCurrentUserName.length > 0
      && workflowOwner.toLowerCase() === normalizedCurrentUserName,
    );
    if (!status) {
      return;
    }

    snapshot.totalCount += 1;
    snapshot.statusCounts[status] += 1;

    if (status === 'Pending Review') {
      pendingReviewRecords.push(record);
      snapshot.pendingReviewCount += 1;
      if (ownerMatchesCurrentUser) {
        snapshot.ownership.pendingReviewMineCount += 1;
      }
      if (!workflowOwner) {
        snapshot.ownership.pendingReviewUnassignedCount += 1;
      }
      return;
    }

    if (status === 'Unqualified' && record.fields['Trash Status'] === 'Active Trash') {
      snapshot.trashCount += 1;
      return;
    }

    if (PROGRESS_STATUSES.has(status)) {
      progressRecords.push(record);
      snapshot.progressCount += 1;
      if (ownerMatchesCurrentUser) {
        snapshot.ownership.progressMineCount += 1;
      }
      if (!workflowOwner) {
        snapshot.ownership.progressUnassignedCount += 1;
      }
      return;
    }

    if (POST_PUBLISH_STATUSES.has(status)) {
      postPublishRecords.push(record);
      snapshot.postPublishCount += 1;
    }
  });

  const pendingReviewAge = buildPendingReviewQueueAgingSummary(pendingReviewRecords, nowMs);
  const progressAge = buildWorkflowProgressQueueAgingSummary(progressRecords, nowMs);
  const postPublishAge = buildPostPublishQueueAgingSummary(postPublishRecords, nowMs);

  snapshot.age = {
    pendingReviewAlertCount: pendingReviewAge.alertCount,
    oldestPendingReviewAgeDays: pendingReviewAge.oldestAgeDays,
    progressAlertCount: progressAge.alertCount,
    oldestProgressAgeDays: progressAge.oldestAgeDays,
    activeNearStaleCount: postPublishAge.activeNearStaleCount,
    staleFollowUpCount: postPublishAge.staleFollowUpCount,
    oldestListedAgeDays: postPublishAge.oldestListedAgeDays,
    oldestStaleAgeDays: postPublishAge.oldestStaleAgeDays,
  };

  snapshot.marketplace = postPublishRecords.reduce<UsedGearWorkflowMarketplaceCounts>((counts, record) => {
    const postPublishSnapshot = getUsedGearWorkflowPostPublishSnapshot(record, nowMs);
    if (!postPublishSnapshot) {
      return counts;
    }

    switch (postPublishSnapshot.status) {
      case 'Listed, Shopify':
        counts.shopifyLiveCount += 1;
        return counts;
      case 'Stale Listing, Shopify':
        counts.shopifyStaleCount += 1;
        return counts;
      case 'Listed, eBay':
        counts.ebayLiveCount += 1;
        return counts;
      case 'Stale Listing, eBay':
        counts.ebayStaleCount += 1;
        return counts;
      case 'Sold - Ready to Ship':
        counts.soldReadyCount += 1;
        return counts;
      case 'Shipped':
        counts.shippedCount += 1;
        return counts;
      default:
        return counts;
    }
  }, createEmptyMarketplaceCounts());

  let sellDurationTotalDays = 0;
  let sellDurationCount = 0;
  let shipDurationTotalDays = 0;
  let shipDurationCount = 0;
  let soldReadyAwaitingShipmentCount = 0;
  let oldestSoldReadyAgeDays: number | null = null;

  postPublishRecords.forEach((record) => {
    const listedAtMs = Date.parse(String(record.fields['Listed At'] ?? ''));
    const soldReadyAtMs = Date.parse(String(record.fields['Sold Ready To Ship At'] ?? ''));
    const shippedAtMs = Date.parse(String(record.fields['Shipped At'] ?? ''));
    const status = getUsedGearWorkflowStatus(record.fields);

    if (Number.isFinite(listedAtMs) && Number.isFinite(soldReadyAtMs) && soldReadyAtMs >= listedAtMs) {
      sellDurationTotalDays += (soldReadyAtMs - listedAtMs) / 86_400_000;
      sellDurationCount += 1;
    }

    if (Number.isFinite(soldReadyAtMs) && Number.isFinite(shippedAtMs) && shippedAtMs >= soldReadyAtMs) {
      shipDurationTotalDays += (shippedAtMs - soldReadyAtMs) / 86_400_000;
      shipDurationCount += 1;
    }

    if (status === 'Sold - Ready to Ship' && Number.isFinite(soldReadyAtMs)) {
      const ageDays = (nowMs - soldReadyAtMs) / 86_400_000;
      soldReadyAwaitingShipmentCount += 1;
      oldestSoldReadyAgeDays = oldestSoldReadyAgeDays === null ? ageDays : Math.max(oldestSoldReadyAgeDays, ageDays);
    }
  });

  snapshot.lifecycle = {
    averageDaysToSell: sellDurationCount > 0 ? roundLifecycleDays(sellDurationTotalDays / sellDurationCount) : null,
    averageDaysToShip: shipDurationCount > 0 ? roundLifecycleDays(shipDurationTotalDays / shipDurationCount) : null,
    soldReadyAwaitingShipmentCount,
    oldestSoldReadyAgeDays: oldestSoldReadyAgeDays === null ? null : roundLifecycleDays(oldestSoldReadyAgeDays),
  };

  return snapshot;
}

export async function loadUsedGearWorkflowAnalyticsSnapshot(currentUserName = ''): Promise<UsedGearWorkflowAnalyticsSnapshot> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_ANALYTICS_FIELDS],
  });

  return buildUsedGearWorkflowAnalyticsSnapshot(records, Date.now(), currentUserName);
}