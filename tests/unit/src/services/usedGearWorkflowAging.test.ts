import { describe, expect, it } from 'vitest';
import {
  buildPendingReviewQueueAgingSummary,
  buildPostPublishQueueAgingSummary,
  buildWorkflowProgressQueueAgingSummary,
} from '@/services/usedGearWorkflowAging';
import type { AirtableRecord } from '@/types/airtable';

function buildRecord(overrides: Partial<AirtableRecord>): AirtableRecord {
  return {
    id: 'rec-aging-1',
    createdTime: '2026-05-01T00:00:00.000Z',
    fields: {},
    ...overrides,
  };
}

describe('usedGearWorkflowAging', () => {
  it('summarizes pending review rows that have been waiting too long', () => {
    const summary = buildPendingReviewQueueAgingSummary([
      buildRecord({ createdTime: '2026-05-01T00:00:00.000Z' }),
      buildRecord({ id: 'rec-aging-2', createdTime: '2026-05-07T00:00:00.000Z' }),
    ], Date.parse('2026-05-08T00:00:00.000Z'));

    expect(summary.alertCount).toBe(1);
    expect(summary.oldestAgeDays).toBe(7);
  });

  it('summarizes workflow progress rows by the current active stage timestamp', () => {
    const summary = buildWorkflowProgressQueueAgingSummary([
      buildRecord({
        fields: {
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Accepted At': '2026-05-01T00:00:00.000Z',
        },
      }),
      buildRecord({
        id: 'rec-aging-2',
        fields: {
          'Workflow Status': 'Testing In Progress',
          'Processing Signed At': '2026-05-06T00:00:00.000Z',
        },
      }),
    ], Date.parse('2026-05-08T00:00:00.000Z'));

    expect(summary.alertCount).toBe(1);
    expect(summary.oldestAgeDays).toBe(7);
  });

  it('summarizes post-publish rows nearing or exceeding stale follow-up thresholds', () => {
    const summary = buildPostPublishQueueAgingSummary([
      buildRecord({
        fields: {
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2026-04-05T00:00:00.000Z',
        },
      }),
      buildRecord({
        id: 'rec-aging-2',
        fields: {
          'Workflow Status': 'Stale Listing, eBay',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-10T00:00:00.000Z',
        },
      }),
    ], Date.parse('2026-05-08T00:00:00.000Z'));

    expect(summary.activeNearStaleCount).toBe(1);
    expect(summary.staleFollowUpCount).toBe(1);
    expect(summary.oldestStaleAgeDays).toBe(28);
  });
});