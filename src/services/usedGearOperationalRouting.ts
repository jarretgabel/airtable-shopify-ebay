import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';

function hasSignedUser(fields: Record<string, unknown>, fieldName: string): boolean {
  return typeof fields[fieldName] === 'string' && fields[fieldName].trim().length > 0;
}

function encodeRecordId(recordId: string): string {
  return encodeURIComponent(recordId);
}

export function buildUsedGearTrashReviewPath(recordId: string): string {
  return `/trash-review/review/${encodeRecordId(recordId)}`;
}

export function buildUsedGearPendingReviewPath(recordId: string): string {
  return `/parking-lot-1/review-record/${encodeRecordId(recordId)}`;
}

export function buildUsedGearManualIntakePath(recordId: string): string {
  return `/inventory/manual-intake/${encodeRecordId(recordId)}`;
}

export function buildUsedGearTestingPath(recordId: string): string {
  return `/testing/${encodeRecordId(recordId)}`;
}

export function buildUsedGearPhotosPath(recordId: string): string {
  return `/photos/${encodeRecordId(recordId)}`;
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
    return `/parking-lot-1/review-record/${encodedRecordId}`;
  }

  if (
    status === 'Accepted - Awaiting Arrival'
    || status === 'Accepted - Arrived, Awaiting SKU'
    || status === 'Accepted - Arrived, Awaiting Missing Item'
  ) {
    return `/inventory/manual-intake/${encodedRecordId}`;
  }

  if (status === 'Testing and Photography In Progress') {
    if (!hasSignedUser(fields, 'Testing Signed By')) {
      return `/testing/${encodedRecordId}`;
    }

    if (!hasSignedUser(fields, 'Photography Signed By')) {
      return `/photos/${encodedRecordId}`;
    }

    return `/listings/${encodedRecordId}`;
  }

  if (
    status === 'Awaiting Pre-Listing Review'
    || status === 'Approved for Publish'
    || status === 'Listed, Shopify'
    || status === 'Listed, eBay'
    || status === 'Stale Listing, Shopify'
    || status === 'Stale Listing, eBay'
    || status === 'Sold - Ready to Ship'
    || status === 'Shipped'
  ) {
    return `/listings/${encodedRecordId}`;
  }

  return `/inventory/${encodedRecordId}`;
}