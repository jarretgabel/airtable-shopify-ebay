import type { AirtableRecord } from '@/types/airtable';
import { getUsedGearWorkflowStatus, type UsedGearWorkflowStatus } from '@/services/usedGearWorkflow';

export const USED_GEAR_STALE_THRESHOLD_DAYS = 45;

export type UsedGearWorkflowListingChannel = 'shopify' | 'ebay';
export type UsedGearWorkflowPostPublishBucket = 'active-listing' | 'stale-listing' | 'sold-ready' | 'shipped';

export interface UsedGearWorkflowPostPublishSnapshot {
  bucket: UsedGearWorkflowPostPublishBucket;
  channel: UsedGearWorkflowListingChannel | null;
  status: UsedGearWorkflowStatus;
  listedAt: string | null;
  staleListingAt: string | null;
  soldReadyToShipAt: string | null;
  shippedAt: string | null;
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
  const soldReadyToShipAt = getIsoTimestamp(record.fields['Sold Ready To Ship At']);
  const shippedAt = getIsoTimestamp(record.fields['Shipped At']);
  const daysSinceListed = getDaysBetween(nowMs, listedAt);
  const isPastStaleThreshold = daysSinceListed !== null && daysSinceListed >= staleThresholdDays;

  switch (status) {
    case 'Listed, Shopify':
    case 'Listed, eBay':
      return {
        bucket: isPastStaleThreshold ? 'stale-listing' : 'active-listing',
        channel: getUsedGearWorkflowListingChannel(status),
        status,
        listedAt,
        staleListingAt,
        soldReadyToShipAt,
        shippedAt,
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
        soldReadyToShipAt,
        shippedAt,
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
        soldReadyToShipAt,
        shippedAt,
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
        soldReadyToShipAt,
        shippedAt,
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