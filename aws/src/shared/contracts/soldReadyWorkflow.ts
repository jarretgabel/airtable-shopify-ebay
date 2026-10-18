const LISTED_STATUSES = new Set([
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
]);

export const SOLD_READY_TO_SHIP_STATUS = 'Sold - Ready to Ship';

// Mirrors the manual "Mark Sold - Ready to Ship" guard: only listed/stale rows advance, and an existing
// sold timestamp is never overwritten, so the manual button and webhooks stay idempotent with each other.
export function buildSoldReadyFields(
  currentFields: Record<string, unknown>,
  soldAt: string,
): Record<string, unknown> {
  const status = typeof currentFields['Workflow Status'] === 'string' ? currentFields['Workflow Status'].trim() : '';
  if (!LISTED_STATUSES.has(status)) {
    return {};
  }

  const existingSoldAt = typeof currentFields['Sold Ready To Ship At'] === 'string'
    ? currentFields['Sold Ready To Ship At'].trim()
    : '';

  return {
    'Workflow Status': SOLD_READY_TO_SHIP_STATUS,
    'Sold Ready To Ship At': existingSoldAt || soldAt,
  };
}
