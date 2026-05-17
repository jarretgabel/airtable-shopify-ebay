import { describe, expect, it } from 'vitest';
import { buildDashboardInsights } from '@/hooks/dashboard/insights';

describe('buildDashboardInsights', () => {
  it('adds used-gear post-publish insights with focused inventory buckets', () => {
    const insights = buildDashboardInsights({
      recentSubs: [],
      priorRecentSubs: [],
      draftProducts: [],
      activeProducts: [],
      recentArchivedProducts: [],
      priorArchivedProducts: [],
      airtableBrandSummary: [],
      nonEmptyListings: [],
      workflowStaleListingCount: 2,
      workflowStaleListingUnassignedCount: 2,
      workflowSoldReadyCount: 1,
      workflowSoldReadyUnassignedCount: 1,
      now: Date.now(),
    });

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'used-gear-sold-ready', inventoryPostPublishBucket: 'sold-ready', targetTab: 'post-publish' }),
      expect.objectContaining({ id: 'used-gear-stale-listings', inventoryPostPublishBucket: 'stale-listing', targetTab: 'post-publish' }),
    ]));
  });
});