import { describe, expect, it } from 'vitest';
import {
  getUsedGearWorkflowPostPublishSnapshot,
  getUsedGearWorkflowPostSaleOutcome,
  getUsedGearWorkflowRestockDisposition,
  getUsedGearWorkflowStaleRecoveryStatus,
  resolveWorkflowStatusAfterPublish,
  USED_GEAR_STALE_THRESHOLD_DAYS,
} from '@/services/usedGearWorkflowLifecycle';
import type { AirtableRecord } from '@/types/airtable';

describe('usedGearWorkflowLifecycle', () => {
  it('derives stale-listing queue membership once a listed row crosses the threshold', () => {
    const record: AirtableRecord = {
      id: 'rec-listed',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Listed, Shopify',
        'Listed At': '2026-03-01T00:00:00.000Z',
      },
    };

    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record, new Date('2026-05-07T00:00:00.000Z').getTime());

    expect(snapshot?.bucket).toBe('stale-listing');
    expect(snapshot?.channel).toBe('shopify');
    expect(snapshot?.isPastStaleThreshold).toBe(true);
    expect(snapshot?.staleThresholdDays).toBe(USED_GEAR_STALE_THRESHOLD_DAYS);
  });

  it('keeps sold-ready and shipped rows in their dedicated lifecycle buckets', () => {
    const soldReady: AirtableRecord = {
      id: 'rec-sold',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Sold - Ready to Ship',
        'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
      },
    };
    const shipped: AirtableRecord = {
      id: 'rec-shipped',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Shipped',
        'Shipped At': '2026-05-07T00:00:00.000Z',
      },
    };

    expect(getUsedGearWorkflowPostPublishSnapshot(soldReady)?.bucket).toBe('sold-ready');
    expect(getUsedGearWorkflowPostPublishSnapshot(shipped)?.bucket).toBe('shipped');
  });

  it('reads shipment follow-through fields from sold-ready rows', () => {
    const record: AirtableRecord = {
      id: 'rec-shipment-notes',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Sold - Ready to Ship',
        'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
        'Shipment Follow-Through Notes': 'Carrier pickup booked for tomorrow morning.',
        'Shipment Follow-Through Updated At': '2026-05-07T08:30:00.000Z',
      },
    };

    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);

    expect(snapshot?.shipmentFollowThroughNotes).toBe('Carrier pickup booked for tomorrow morning.');
    expect(snapshot?.shipmentFollowThroughUpdatedAt).toBe('2026-05-07T08:30:00.000Z');
  });

  it('reads stale recovery fields from the operational row', () => {
    const record: AirtableRecord = {
      id: 'rec-stale',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Stale Listing, Shopify',
        'Listed At': '2026-03-01T00:00:00.000Z',
        'Stale Listing At': '2026-04-20T00:00:00.000Z',
        'Stale Recovery Status': 'Price Refresh',
        'Stale Recovery Notes': 'Refresh title and pricing before relist.',
        'Stale Recovery Updated At': '2026-05-07T10:00:00.000Z',
        'Relisted At': '2026-05-07T12:00:00.000Z',
      },
    };

    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);

    expect(getUsedGearWorkflowStaleRecoveryStatus(record.fields)).toBe('Price Refresh');
    expect(snapshot?.staleRecoveryStatus).toBe('Price Refresh');
    expect(snapshot?.staleRecoveryNotes).toBe('Refresh title and pricing before relist.');
    expect(snapshot?.relistedAt).toBe('2026-05-07T12:00:00.000Z');
  });

  it('reads phase-1 post-sale fields from the operational row without changing workflow status', () => {
    const record: AirtableRecord = {
      id: 'rec-post-sale',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Shipped',
        'Shipped At': '2026-05-07T00:00:00.000Z',
        'Post-Sale Outcome': 'Returned',
        'Post-Sale Outcome At': '2026-05-08T09:00:00.000Z',
        'Post-Sale Notes': 'Customer returned the item after delivery.',
        'Refund Amount': 42.5,
        'Refund Reason': 'Transit damage',
        'Return Received At': '2026-05-09T14:15:00.000Z',
        'Restock Disposition': 'Needs Re-Intake',
      },
    };

    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);

    expect(getUsedGearWorkflowPostSaleOutcome(record.fields)).toBe('Returned');
    expect(getUsedGearWorkflowRestockDisposition(record.fields)).toBe('Needs Re-Intake');
    expect(snapshot?.status).toBe('Shipped');
    expect(snapshot?.postSaleOutcome).toBe('Returned');
    expect(snapshot?.postSaleOutcomeAt).toBe('2026-05-08T09:00:00.000Z');
    expect(snapshot?.postSaleNotes).toBe('Customer returned the item after delivery.');
    expect(snapshot?.refundAmount).toBe(42.5);
    expect(snapshot?.refundReason).toBe('Transit damage');
    expect(snapshot?.returnReceivedAt).toBe('2026-05-09T14:15:00.000Z');
    expect(snapshot?.restockDisposition).toBe('Needs Re-Intake');
    expect(snapshot?.hasPostSaleException).toBe(true);
  });

  it('marks isPostSaleResolved when both outcome and restock disposition are set', () => {
    const record: AirtableRecord = {
      id: 'rec-resolved',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Shipped',
        'Shipped At': '2026-05-07T00:00:00.000Z',
        'Post-Sale Outcome': 'Returned',
        'Return Received At': '2026-05-09T14:15:00.000Z',
        'Restock Disposition': 'Archive Only',
      },
    };

    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);

    expect(snapshot?.isPostSaleResolved).toBe(true);
  });

  it('does not mark isPostSaleResolved when outcome is set but disposition is missing', () => {
    const record: AirtableRecord = {
      id: 'rec-pending-disposition',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Shipped',
        'Shipped At': '2026-05-07T00:00:00.000Z',
        'Post-Sale Outcome': 'Refunded',
        'Refund Amount': 29.99,
      },
    };

    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);

    expect(snapshot?.isPostSaleResolved).toBe(false);
    expect(snapshot?.hasPostSaleException).toBe(true);
  });

  it('rejects unknown post-sale values', () => {
    const record: AirtableRecord = {
      id: 'rec-invalid-post-sale',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Sold - Ready to Ship',
        'Post-Sale Outcome': 'Not A Real Outcome',
        'Restock Disposition': 'Not A Real Disposition',
      },
    };

    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);

    expect(snapshot?.postSaleOutcome).toBeNull();
    expect(snapshot?.restockDisposition).toBeNull();
  });

  it('resolves publish writeback status for the combined publish path', () => {
    expect(resolveWorkflowStatusAfterPublish({
      requestedTarget: 'both',
      currentStatus: 'Approved for Publish',
      publishedToShopify: true,
      publishedToEbay: true,
    })).toBe('Listed, Shopify');

    expect(resolveWorkflowStatusAfterPublish({
      requestedTarget: 'both',
      currentStatus: 'Stale Listing, eBay',
      publishedToShopify: true,
      publishedToEbay: true,
    })).toBe('Listed, eBay');
  });
});
