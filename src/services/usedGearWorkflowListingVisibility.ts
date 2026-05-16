import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import { getUsedGearWorkflowStatus, type UsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import type { AirtableRecord } from '@/types/airtable';

const LISTING_SURFACE_STATUSES = new Set<UsedGearWorkflowStatus>([
  'Awaiting Pre-Listing Review',
  'Approved for Publish',
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
]);

const LISTING_SKU_FIELD_CANDIDATES = [
  'SKU',
  'eBay Inventory SKU',
  'Shopify Variant 1 SKU',
  'Shopify SKU',
  'Variant SKU',
] as const;

function getTrimmedString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

export function getUsedGearWorkflowListingSku(record: AirtableRecord): string {
  for (const fieldName of LISTING_SKU_FIELD_CANDIDATES) {
    const value = getTrimmedString(record.fields[fieldName]);
    if (value) {
      return value;
    }
  }

  return '';
}

export function isUsedGearWorkflowListingSurfaceEligible(record: AirtableRecord): boolean {
  const status = getUsedGearWorkflowStatus(record.fields);
  if (!status || !LISTING_SURFACE_STATUSES.has(status)) {
    return false;
  }

  return getUsedGearWorkflowListingReadiness(record).missingRequirements.length === 0;
}

export function buildUsedGearWorkflowListingSkuSet(records: AirtableRecord[]): Set<string> {
  const skuSet = new Set<string>();

  records.forEach((record) => {
    if (!isUsedGearWorkflowListingSurfaceEligible(record)) {
      return;
    }

    const sku = getUsedGearWorkflowListingSku(record);
    if (sku) {
      skuSet.add(sku);
    }
  });

  return skuSet;
}