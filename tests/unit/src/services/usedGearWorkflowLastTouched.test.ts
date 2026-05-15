import { describe, expect, it } from 'vitest';
import {
  buildPendingReviewLastTouchedSummary,
  buildPostPublishLastTouchedSummary,
  buildWorkflowProgressLastTouchedSummary,
} from '@/services/usedGearWorkflowLastTouched';

describe('usedGearWorkflowLastTouched', () => {
  it('prefers owner assignment updates in pending review', () => {
    const summary = buildPendingReviewLastTouchedSummary({
      id: 'rec-pending',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Workflow Owner': 'Taylor Reviewer',
        'Workflow Owner Assigned At': '2026-05-08T03:00:00.000Z',
      },
    });

    expect(summary.description).toBe('Owner assigned to Taylor Reviewer');
    expect(summary.timestamp).toContain('2026');
  });

  it('uses the latest workflow stage timestamp in progress', () => {
    const summary = buildWorkflowProgressLastTouchedSummary({
      id: 'rec-progress',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Accepted At': '2026-05-08T01:00:00.000Z',
        'Accepted By': 'Taylor Reviewer',
        'Processing Signed At': '2026-05-08T02:00:00.000Z',
        'Processing Signed By': 'Jordan Processor',
        'Testing Signed At': '2026-05-08T04:00:00.000Z',
        'Testing Signed By': 'Jamie Bench',
      },
    });

    expect(summary.description).toBe('Testing signed by Jamie Bench');
  });

  it('prefers stale recovery updates over older post-publish lifecycle timestamps', () => {
    const summary = buildPostPublishLastTouchedSummary({
      id: 'rec-post',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Stale Listing, eBay',
        'Listed At': '2026-03-01T00:00:00.000Z',
        'Stale Listing At': '2026-04-20T00:00:00.000Z',
        'Stale Recovery Status': 'Price Refresh',
        'Stale Recovery Updated At': '2026-05-08T05:00:00.000Z',
      },
    });

    expect(summary.description).toBe('Stale recovery updated: Price Refresh');
  });

  it('prefers shipment follow-through updates over older sold-ready timestamps', () => {
    const summary = buildPostPublishLastTouchedSummary({
      id: 'rec-shipment',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Sold - Ready to Ship',
        'Sold Ready To Ship At': '2026-05-08T02:00:00.000Z',
        'Shipment Follow-Through Notes': 'Carrier pickup booked.',
        'Shipment Follow-Through Updated At': '2026-05-08T05:00:00.000Z',
      },
    });

    expect(summary.description).toBe('Shipment follow-through updated');
  });
});