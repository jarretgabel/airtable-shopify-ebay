import type { AirtableRecord } from '@/types/airtable';
import { getUsedGearWorkflowStatus, type UsedGearWorkflowStatus } from '@/services/usedGearWorkflow';

export const USED_GEAR_STALE_THRESHOLD_DAYS = 45;
export const USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS = [
  'Needs Review',
  'Price Refresh',
  'Content Refresh',
  'Ready To Relist',
  'Do Not Relist',
] as const;
export const USED_GEAR_POST_SALE_OUTCOME_OPTIONS = [
  'Cancelled',
  'Refunded',
  'Returned',
  'Partial Refund',
] as const;
export const USED_GEAR_RESTOCK_DISPOSITION_OPTIONS = [
  'Relist Candidate',
  'Needs Re-Intake',
  'Parts / Damaged',
  'Archive Only',
] as const;

export type UsedGearWorkflowListingChannel = 'shopify' | 'ebay';
export type UsedGearWorkflowPostPublishBucket = 'active-listing' | 'stale-listing' | 'sold-ready' | 'shipped';
export type UsedGearWorkflowPostSaleOutcome = (typeof USED_GEAR_POST_SALE_OUTCOME_OPTIONS)[number];
export type UsedGearWorkflowRestockDisposition = (typeof USED_GEAR_RESTOCK_DISPOSITION_OPTIONS)[number];
export type UsedGearWorkflowStaleRecoveryStatus = (typeof USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS)[number];

export interface UsedGearWorkflowPostPublishSnapshot {
  bucket: UsedGearWorkflowPostPublishBucket;
  channel: UsedGearWorkflowListingChannel | null;
  status: UsedGearWorkflowStatus;
  listedAt: string | null;
  staleListingAt: string | null;
  staleRecoveryStatus: UsedGearWorkflowStaleRecoveryStatus | null;
  staleRecoveryNotes: string | null;
  staleRecoveryUpdatedAt: string | null;
  relistedAt: string | null;
  soldReadyToShipAt: string | null;
  shipmentFollowThroughNotes: string | null;
  shipmentFollowThroughUpdatedAt: string | null;
  shippedAt: string | null;
  postSaleOutcome: UsedGearWorkflowPostSaleOutcome | null;
  postSaleOutcomeAt: string | null;
  postSaleNotes: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  returnReceivedAt: string | null;
  restockDisposition: UsedGearWorkflowRestockDisposition | null;
  hasPostSaleException: boolean;
  isPostSaleResolved: boolean;
  daysSinceListed: number | null;
  staleThresholdDays: number;
  isPastStaleThreshold: boolean;
}

interface ResolveWorkflowStatusAfterPublishParams {
  requestedTarget: 'shopify' | 'ebay' | 'both';
  currentStatus: UsedGearWorkflowStatus | null;
  publishedToShopify: boolean;
  publishedToEbay: boolean;
}

function getTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getIsoTimestamp(value: unknown): string | null {
  const normalized = getTrimmedString(value);
  if (!normalized) return null;

  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

export function isUsedGearWorkflowStaleRecoveryStatus(value: string): value is UsedGearWorkflowStaleRecoveryStatus {
  return (USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS as readonly string[]).includes(value);
}

export function isUsedGearWorkflowPostSaleOutcome(value: string): value is UsedGearWorkflowPostSaleOutcome {
  return (USED_GEAR_POST_SALE_OUTCOME_OPTIONS as readonly string[]).includes(value);
}

export function isUsedGearWorkflowRestockDisposition(value: string): value is UsedGearWorkflowRestockDisposition {
  return (USED_GEAR_RESTOCK_DISPOSITION_OPTIONS as readonly string[]).includes(value);
}

export function getUsedGearWorkflowStaleRecoveryStatus(fields: Record<string, unknown>): UsedGearWorkflowStaleRecoveryStatus | null {
  const rawValue = getTrimmedString(fields['Stale Recovery Status']);
  return rawValue && isUsedGearWorkflowStaleRecoveryStatus(rawValue) ? rawValue : null;
}

export function getUsedGearWorkflowPostSaleOutcome(fields: Record<string, unknown>): UsedGearWorkflowPostSaleOutcome | null {
  const rawValue = getTrimmedString(fields['Post-Sale Outcome']);
  return rawValue && isUsedGearWorkflowPostSaleOutcome(rawValue) ? rawValue : null;
}

export function getUsedGearWorkflowRestockDisposition(fields: Record<string, unknown>): UsedGearWorkflowRestockDisposition | null {
  const rawValue = getTrimmedString(fields['Restock Disposition']);
  return rawValue && isUsedGearWorkflowRestockDisposition(rawValue) ? rawValue : null;
}

function getDaysBetween(nowMs: number, timestamp: string | null): number | null {
  if (!timestamp) return null;

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;

  return Math.max(0, Math.floor((nowMs - parsed) / (1000 * 60 * 60 * 24)));
}

export function getUsedGearWorkflowListingChannel(status: UsedGearWorkflowStatus): UsedGearWorkflowListingChannel | null {
  switch (status) {
    case 'Listed, Shopify':
    case 'Stale Listing, Shopify':
      return 'shopify';
    case 'Listed, eBay':
    case 'Stale Listing, eBay':
      return 'ebay';
    default:
      return null;
  }
}

export function getUsedGearWorkflowPostPublishSnapshot(
  record: AirtableRecord,
  nowMs = Date.now(),
  staleThresholdDays = USED_GEAR_STALE_THRESHOLD_DAYS,
): UsedGearWorkflowPostPublishSnapshot | null {
  const status = getUsedGearWorkflowStatus(record.fields);
  if (!status) {
    return null;
  }

  const listedAt = getIsoTimestamp(record.fields['Listed At']);
  const staleListingAt = getIsoTimestamp(record.fields['Stale Listing At']);
  const staleRecoveryStatus = getUsedGearWorkflowStaleRecoveryStatus(record.fields);
  const staleRecoveryNotes = getTrimmedString(record.fields['Stale Recovery Notes']);
  const staleRecoveryUpdatedAt = getIsoTimestamp(record.fields['Stale Recovery Updated At']);
  const relistedAt = getIsoTimestamp(record.fields['Relisted At']);
  const soldReadyToShipAt = getIsoTimestamp(record.fields['Sold Ready To Ship At']);
  const shipmentFollowThroughNotes = getTrimmedString(record.fields['Shipment Follow-Through Notes']);
  const shipmentFollowThroughUpdatedAt = getIsoTimestamp(record.fields['Shipment Follow-Through Updated At']);
  const shippedAt = getIsoTimestamp(record.fields['Shipped At']);
  const postSaleOutcome = getUsedGearWorkflowPostSaleOutcome(record.fields);
  const postSaleOutcomeAt = getIsoTimestamp(record.fields['Post-Sale Outcome At']);
  const postSaleNotes = getTrimmedString(record.fields['Post-Sale Notes']);
  const refundAmount = typeof record.fields['Refund Amount'] === 'number' && Number.isFinite(record.fields['Refund Amount'])
    ? Math.round(record.fields['Refund Amount'] * 100) / 100
    : null;
  const refundReason = getTrimmedString(record.fields['Refund Reason']);
  const returnReceivedAt = getIsoTimestamp(record.fields['Return Received At']);
  const restockDisposition = getUsedGearWorkflowRestockDisposition(record.fields);
  const daysSinceListed = getDaysBetween(nowMs, listedAt);
  const isPastStaleThreshold = daysSinceListed !== null && daysSinceListed >= staleThresholdDays;
  const hasPostSaleException = Boolean(
    postSaleOutcome
    || postSaleOutcomeAt
    || postSaleNotes
    || refundAmount !== null
    || refundReason
    || returnReceivedAt
    || restockDisposition
  );
  const isPostSaleResolved = Boolean(postSaleOutcome && restockDisposition);

  switch (status) {
    case 'Listed, Shopify':
    case 'Listed, eBay':
      return {
        bucket: isPastStaleThreshold ? 'stale-listing' : 'active-listing',
        channel: getUsedGearWorkflowListingChannel(status),
        status,
        listedAt,
        staleListingAt,
        staleRecoveryStatus,
        staleRecoveryNotes,
        staleRecoveryUpdatedAt,
        relistedAt,
        soldReadyToShipAt,
        shipmentFollowThroughNotes,
        shipmentFollowThroughUpdatedAt,
        shippedAt,
        postSaleOutcome,
        postSaleOutcomeAt,
        postSaleNotes,
        refundAmount,
        refundReason,
        returnReceivedAt,
        restockDisposition,
        hasPostSaleException,
        isPostSaleResolved,
        daysSinceListed,
        staleThresholdDays,
        isPastStaleThreshold,
      };
    case 'Stale Listing, Shopify':
    case 'Stale Listing, eBay':
      return {
        bucket: 'stale-listing',
        channel: getUsedGearWorkflowListingChannel(status),
        status,
        listedAt,
        staleListingAt,
        staleRecoveryStatus,
        staleRecoveryNotes,
        staleRecoveryUpdatedAt,
        relistedAt,
        soldReadyToShipAt,
        shipmentFollowThroughNotes,
        shipmentFollowThroughUpdatedAt,
        shippedAt,
        postSaleOutcome,
        postSaleOutcomeAt,
        postSaleNotes,
        refundAmount,
        refundReason,
        returnReceivedAt,
        restockDisposition,
        hasPostSaleException,
        isPostSaleResolved,
        daysSinceListed,
        staleThresholdDays,
        isPastStaleThreshold: true,
      };
    case 'Sold - Ready to Ship':
      return {
        bucket: 'sold-ready',
        channel: null,
        status,
        listedAt,
        staleListingAt,
        staleRecoveryStatus,
        staleRecoveryNotes,
        staleRecoveryUpdatedAt,
        relistedAt,
        soldReadyToShipAt,
        shipmentFollowThroughNotes,
        shipmentFollowThroughUpdatedAt,
        shippedAt,
        postSaleOutcome,
        postSaleOutcomeAt,
        postSaleNotes,
        refundAmount,
        refundReason,
        returnReceivedAt,
        restockDisposition,
        hasPostSaleException,
        isPostSaleResolved,
        daysSinceListed,
        staleThresholdDays,
        isPastStaleThreshold,
      };
    case 'Shipped':
      return {
        bucket: 'shipped',
        channel: null,
        status,
        listedAt,
        staleListingAt,
        staleRecoveryStatus,
        staleRecoveryNotes,
        staleRecoveryUpdatedAt,
        relistedAt,
        soldReadyToShipAt,
        shipmentFollowThroughNotes,
        shipmentFollowThroughUpdatedAt,
        shippedAt,
        postSaleOutcome,
        postSaleOutcomeAt,
        postSaleNotes,
        refundAmount,
        refundReason,
        returnReceivedAt,
        restockDisposition,
        hasPostSaleException,
        isPostSaleResolved,
        daysSinceListed,
        staleThresholdDays,
        isPastStaleThreshold,
      };
    default:
      return null;
  }
}

export function resolveWorkflowStatusAfterPublish({
  requestedTarget,
  currentStatus,
  publishedToShopify,
  publishedToEbay,
}: ResolveWorkflowStatusAfterPublishParams): UsedGearWorkflowStatus | null {
  if (!publishedToShopify && !publishedToEbay) {
    return null;
  }

  if (publishedToShopify && !publishedToEbay) {
    return 'Listed, Shopify';
  }

  if (!publishedToShopify && publishedToEbay) {
    return 'Listed, eBay';
  }

  if (requestedTarget === 'ebay') {
    return 'Listed, eBay';
  }

  if (requestedTarget === 'shopify') {
    return 'Listed, Shopify';
  }

  if (currentStatus === 'Listed, eBay' || currentStatus === 'Stale Listing, eBay') {
    return 'Listed, eBay';
  }

  return 'Listed, Shopify';
}