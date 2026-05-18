import { describe, expect, it } from 'vitest';
import { buildUsedGearWorkflowTimeline } from '@/services/usedGearWorkflowTimeline';

describe('buildUsedGearWorkflowTimeline', () => {
  it('returns completed and pending workflow timeline entries in stage order', () => {
    const timeline = buildUsedGearWorkflowTimeline({
      id: 'rec-1',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Accepted At': '2026-05-08T01:00:00.000Z',
        'Accepted By': 'Taylor Reviewer',
        'Processing Signed At': '2026-05-08T02:00:00.000Z',
        'Processing Signed By': 'Jordan Processor',
      },
    });

    expect(timeline.map((entry) => entry.label)).toEqual([
      'Intake Accepted',
      'Processing Completed',
      'Testing Signed',
      'Photography Signed',
      'Pre-Listing',
      'Approved For Publish',
      'Listed',
      'Sold Ready To Ship',
      'Shipped',
    ]);
    expect(timeline[0]).toMatchObject({ status: 'completed', actor: 'Taylor Reviewer' });
    expect(timeline[1]).toMatchObject({ status: 'completed', actor: 'Jordan Processor' });
    expect(timeline[2]).toMatchObject({ status: 'pending', actor: null });
    expect(timeline[4]).toMatchObject({ status: 'pending', actor: null });
  });

  it('keeps pre-listing as a single milestone completed by the reviewer signoff', () => {
    const timeline = buildUsedGearWorkflowTimeline({
      id: 'rec-2',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Accepted At': '2026-05-08T01:00:00.000Z',
        'Accepted By': 'Taylor Reviewer',
        'Awaiting Pre-Listing Review At': '2026-05-08T04:30:00.000Z',
        'Pre-Listing Reviewed At': '2026-05-08T05:00:00.000Z',
        'Pre-Listing Reviewed By': 'Jordan Reviewer',
      },
    });

    expect(timeline[4]).toMatchObject({
      id: 'pre-listing',
      label: 'Pre-Listing',
      status: 'completed',
      actor: 'Jordan Reviewer',
    });
  });
});