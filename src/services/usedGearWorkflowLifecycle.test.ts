import { describe, expect, it } from 'vitest';
import {
  getUsedGearWorkflowPostPublishSnapshot,
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
