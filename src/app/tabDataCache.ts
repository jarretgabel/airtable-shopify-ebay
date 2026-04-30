export const TAB_DATA_TTLS = {
  airtableListings: 90_000,
  approvalQueue: 60_000,
  approvalSummary: 60_000,
  ebayDashboard: 90_000,
  jotformSubmissions: 60_000,
  listingFormatOptions: 300_000,
  shopifyApprovalSummary: 60_000,
  shopifyProducts: 90_000,
} as const;

export function isTabDataStale(lastLoadedAt: number | null, ttlMs: number): boolean {
  if (lastLoadedAt === null) return true;
  return Date.now() - lastLoadedAt > ttlMs;
}

export function shouldReuseTabData(lastLoadedAt: number | null, ttlMs: number, hasRecoverableState = true): boolean {
  return hasRecoverableState && !isTabDataStale(lastLoadedAt, ttlMs);
}