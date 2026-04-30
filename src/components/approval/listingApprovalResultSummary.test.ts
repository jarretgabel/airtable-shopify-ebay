import { describe, expect, it } from 'vitest';
import {
  buildListingApprovalPublishErrorNotification,
  buildListingApprovalPublishResultNotification,
  buildListingApprovalSaveResultNotification,
} from '@/components/approval/listingApprovalResultSummary';
import type { AirtableRecord } from '@/types/airtable';

const record: AirtableRecord = {
  id: 'rec-summary-1',
  createdTime: '2026-04-29T00:00:00.000Z',
  fields: {
    Name: 'McIntosh MA6900',
  },
};

describe('listingApprovalResultSummary', () => {
  it('builds a save success summary with record and field counts', () => {
    const result = buildListingApprovalSaveResultNotification({
      record,
      approvalChannel: 'combined',
      changedFieldCount: 3,
      succeeded: true,
    });

    expect(result).toMatchObject({
      key: 'approval-save-result:rec-summary-1',
      tone: 'success',
      title: 'Listing changes saved',
    });
    expect(result.message).toContain('McIntosh MA6900');
    expect(result.message).toContain('Combined approval flow');
    expect(result.message).toContain('3 fields updated');
  });

  it('builds a publish warning summary for partial success with warnings and failures', () => {
    const result = buildListingApprovalPublishResultNotification({
      record,
      target: 'both',
      result: {
        target: 'both',
        shopify: {
          productId: '44',
          mode: 'created',
          warnings: ['Collection fallback was used'],
          wroteProductId: true,
          staleProductIdCleared: false,
        },
        failures: [{ target: 'ebay', message: 'Offer creation failed' }],
      },
    });

    expect(result).toMatchObject({
      key: 'approval-publish-result:rec-summary-1',
      tone: 'warning',
      title: 'Publish completed with issues',
    });
    expect(result.message).toContain('Shopify and eBay');
    expect(result.message).toContain('Shopify product #44 was created');
    expect(result.message).toContain('1 Shopify warning returned during publish');
    expect(result.message).toContain('eBay: Offer creation failed');
  });

  it('builds a publish error summary from an exception message', () => {
    const result = buildListingApprovalPublishErrorNotification(record, 'shopify', 'Network timeout');

    expect(result).toMatchObject({
      key: 'approval-publish-result:rec-summary-1',
      tone: 'error',
      title: 'Publish failed',
    });
    expect(result.message).toContain('McIntosh MA6900');
    expect(result.message).toContain('Shopify');
    expect(result.message).toContain('Network timeout');
  });
});