import { describe, expect, it } from 'vitest';
import { getListingApprovalActiveTimelineEntry } from '@/components/approval/ListingApprovalWorkflowSummary';
import { buildUsedGearWorkflowTimeline } from '@/services/usedGearWorkflowTimeline';

describe('getListingApprovalActiveTimelineEntry', () => {
  it('keeps approved for publish as the active milestone while publish is still pending', () => {
    const timeline = buildUsedGearWorkflowTimeline({
      id: 'rec-approved',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Accepted At': '2026-05-08T01:00:00.000Z',
        'Accepted By': 'Taylor Reviewer',
        'Processing Signed At': '2026-05-08T02:00:00.000Z',
        'Processing Signed By': 'Jordan Processor',
        'Testing Signed At': '2026-05-08T03:00:00.000Z',
        'Testing Signed By': 'Sam Tester',
        'Photography Signed At': '2026-05-08T04:00:00.000Z',
        'Photography Signed By': 'Pat Photographer',
        'Pre-Listing Reviewed At': '2026-05-08T05:00:00.000Z',
        'Pre-Listing Reviewed By': 'Lee Lister',
        'Approved For Publish At': '2026-05-08T06:00:00.000Z',
      },
    });

    expect(getListingApprovalActiveTimelineEntry(timeline, 'Approved for Publish')).toMatchObject({
      id: 'approved',
      label: 'Approved For Publish',
      status: 'completed',
    });
  });
});