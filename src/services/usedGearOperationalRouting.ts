import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';

function encodeRecordId(recordId: string): string {
  return encodeURIComponent(recordId);
}

export function buildUsedGearTrashReviewPath(recordId: string): string {
  return `/trash-review/review/${encodeRecordId(recordId)}`;
}

export function buildUsedGearPendingReviewPath(recordId: string): string {
  return `/parking-lot/${encodeRecordId(recordId)}`;
}

export function buildUsedGearParkingLotArrivalReviewPath(recordId: string): string {
  return `/parking-lot/arrival/${encodeRecordId(recordId)}`;
}

export function buildUsedGearManualIntakePath(recordId: string): string {
  return `/manual-intake/${encodeRecordId(recordId)}`;
}

export function buildUsedGearTestingPath(recordId: string): string {
  return `/testing/${encodeRecordId(recordId)}`;
}

export function buildUsedGearPhotosPath(recordId: string): string {
  return `/photography/${encodeRecordId(recordId)}`;
}

export function shouldShowOperationalAction(
  recordId: string,
  fields: Record<string, unknown>,
  coveredPaths: string[],
): boolean {
  return !coveredPaths.includes(resolveUsedGearOperationalPath(recordId, fields));
}

export function resolveUsedGearOperationalPath(recordId: string, fields: Record<string, unknown>): string {
  const encodedRecordId = encodeRecordId(recordId);
  const status = getUsedGearWorkflowStatus(fields);
  const trashStatus = typeof fields['Trash Status'] === 'string' ? fields['Trash Status'].trim() : '';

  if (trashStatus.length > 0 || status === 'Unqualified') {
    return `/trash-review/review/${encodedRecordId}`;
  }

  if (status === 'Pending Review') {
    return `/parking-lot/${encodedRecordId}`;
  }

  if (
    status === 'Accepted - Awaiting Arrival'
    || status === 'Accepted - Arrived, Awaiting SKU'
    || status === 'Accepted - Arrived, Awaiting Missing Item'
  ) {
    return `/parking-lot/arrival/${encodedRecordId}`;
  }

  if (status === 'Testing In Progress') {
    return `/testing/${encodedRecordId}`;
  }

  if (status === 'Photography In Progress') {
    return `/photography/${encodedRecordId}`;
  }

  if (
    status === 'Awaiting Pre-Listing Review'
    || status === 'Approved for Publish'
    || status === 'Listed, Shopify'
    || status === 'Listed, eBay'
    || status === 'Stale Listing, Shopify'
    || status === 'Stale Listing, eBay'
  ) {
    return `/listings/${encodedRecordId}`;
  }

  if (status === 'Sold - Ready to Ship' || status === 'Shipped') {
    return `/sold-ready/${encodedRecordId}`;
  }

  return `/workflow-hub/${encodedRecordId}`;
}