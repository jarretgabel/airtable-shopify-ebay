import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';

function hasSignedUser(fields: Record<string, unknown>, fieldName: string): boolean {
  return typeof fields[fieldName] === 'string' && fields[fieldName].trim().length > 0;
}

export function resolveUsedGearOperationalPath(recordId: string, fields: Record<string, unknown>): string {
  const encodedRecordId = encodeURIComponent(recordId);
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
    return `/incoming-gear/${encodedRecordId}`;
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