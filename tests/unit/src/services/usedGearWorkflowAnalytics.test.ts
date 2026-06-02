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
          'Workflow Owner': 'Taylor Reviewer',
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
          'Workflow Owner': 'Taylor Reviewer',
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
          'Post-Sale Outcome': 'Refunded',
          'Post-Sale Outcome At': '2026-05-07T00:00:00.000Z',
          'Refund Amount': 125.5,
          'Refund Reason': 'Buyer issue',
        },
      }),
      buildRecord({
        id: 'rec-workflow-7',
        fields: {
          'Workflow Status': 'Sold - Ready to Ship',
          'Listed At': '2026-03-05T00:00:00.000Z',
          'Sold Ready To Ship At': '2026-05-05T00:00:00.000Z',
          'Post-Sale Outcome': 'Returned',
          'Post-Sale Outcome At': '2026-05-06T00:00:00.000Z',
          'Return Received At': '2026-05-07T00:00:00.000Z',
          'Restock Disposition': 'Needs Re-Intake',
        },
      }),
      buildRecord({
        id: 'rec-workflow-8',
        fields: {
          'Workflow Status': 'Shipped',
          'Sold Ready To Ship At': '2026-05-05T00:00:00.000Z',
          'Shipped At': '2026-05-06T00:00:00.000Z',
          'Post-Sale Outcome': 'Partial Refund',
          'Post-Sale Outcome At': '2026-05-07T00:00:00.000Z',
          'Post-Sale Notes': 'Refunded shipping difference',
          'Refund Amount': 20,
          'Restock Disposition': 'Archive Only',
        },
      }),
    ], Date.parse('2026-05-08T00:00:00.000Z'), 'Taylor Reviewer');

    expect(snapshot.totalCount).toBe(8);
    expect(snapshot.pendingReviewCount).toBe(1);
    expect(snapshot.trashCount).toBe(1);
    expect(snapshot.progressCount).toBe(1);
    expect(snapshot.postPublishCount).toBe(4);
    expect(snapshot.ownership.pendingReviewMineCount).toBe(1);
    expect(snapshot.ownership.pendingReviewUnassignedCount).toBe(0);
    expect(snapshot.ownership.progressMineCount).toBe(0);
    expect(snapshot.ownership.progressUnassignedCount).toBe(1);
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
    expect(snapshot.postSale.exceptionCount).toBe(3);
    expect(snapshot.postSale.unresolvedExceptionCount).toBe(1);
    expect(snapshot.postSale.resolvedExceptionCount).toBe(2);
    expect(snapshot.postSale.refundedCount).toBe(1);
    expect(snapshot.postSale.returnedCount).toBe(1);
    expect(snapshot.postSale.partialRefundCount).toBe(1);
    expect(snapshot.postSale.cancelledCount).toBe(0);
    expect(snapshot.postSale.returnReceivedCount).toBe(1);
    expect(snapshot.postSale.refundExposure).toBe(145.5);
    expect(snapshot.postSale.missingDispositionCount).toBe(1);
  });
});