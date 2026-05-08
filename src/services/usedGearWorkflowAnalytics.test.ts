import { describe, expect, it } from 'vitest';
import { buildUsedGearWorkflowAnalyticsSnapshot } from '@/services/usedGearWorkflowAnalytics';
import type { AirtableRecord } from '@/types/airtable';

function buildRecord(overrides: Partial<AirtableRecord>): AirtableRecord {
  return {
    id: 'rec-workflow-1',
    createdTime: '2026-05-01T00:00:00.000Z',
    fields: {},
    ...overrides,
  };
}

describe('usedGearWorkflowAnalytics', () => {
  it('builds a workflow snapshot with status, age, and marketplace counts', () => {
    const snapshot = buildUsedGearWorkflowAnalyticsSnapshot([
      buildRecord({
        fields: {
          'Workflow Status': 'Pending Review',
        },
      }),
      buildRecord({
        id: 'rec-workflow-2',
        fields: {
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
        },
      }),
      buildRecord({
        id: 'rec-workflow-3',
        fields: {
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Accepted At': '2026-05-01T00:00:00.000Z',
        },
      }),
      buildRecord({
        id: 'rec-workflow-4',
        fields: {
          'Workflow Status': 'Approved for Publish',
          'Approved For Publish At': '2026-05-06T00:00:00.000Z',
        },
      }),
      buildRecord({
        id: 'rec-workflow-5',
        fields: {
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2026-04-05T00:00:00.000Z',
        },
      }),
      buildRecord({
        id: 'rec-workflow-6',
        fields: {
          'Workflow Status': 'Stale Listing, eBay',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-10T00:00:00.000Z',
        },
      }),
      buildRecord({
        id: 'rec-workflow-7',
        fields: {
          'Workflow Status': 'Sold - Ready to Ship',
          'Listed At': '2026-03-05T00:00:00.000Z',
          'Sold Ready To Ship At': '2026-05-05T00:00:00.000Z',
        },
      }),
      buildRecord({
        id: 'rec-workflow-8',
        fields: {
          'Workflow Status': 'Shipped',
          'Sold Ready To Ship At': '2026-05-05T00:00:00.000Z',
          'Shipped At': '2026-05-06T00:00:00.000Z',
        },
      }),
    ], Date.parse('2026-05-08T00:00:00.000Z'));

    expect(snapshot.totalCount).toBe(8);
    expect(snapshot.pendingReviewCount).toBe(1);
    expect(snapshot.trashCount).toBe(1);
    expect(snapshot.progressCount).toBe(2);
    expect(snapshot.postPublishCount).toBe(4);
    expect(snapshot.statusCounts['Approved for Publish']).toBe(1);
    expect(snapshot.marketplace.shopifyLiveCount).toBe(1);
    expect(snapshot.marketplace.ebayStaleCount).toBe(1);
    expect(snapshot.marketplace.soldReadyCount).toBe(1);
    expect(snapshot.marketplace.shippedCount).toBe(1);
    expect(snapshot.age.pendingReviewAlertCount).toBe(1);
    expect(snapshot.age.progressAlertCount).toBe(1);
    expect(snapshot.age.activeNearStaleCount).toBe(1);
    expect(snapshot.age.staleFollowUpCount).toBe(1);
    expect(snapshot.lifecycle.averageDaysToSell).toBe(61);
    expect(snapshot.lifecycle.averageDaysToShip).toBe(1);
    expect(snapshot.lifecycle.soldReadyAwaitingShipmentCount).toBe(1);
    expect(snapshot.lifecycle.oldestSoldReadyAgeDays).toBe(3);
  });
});