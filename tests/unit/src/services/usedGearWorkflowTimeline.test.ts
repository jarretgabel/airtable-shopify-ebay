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
      'Owner Assigned',
      'Processing Completed',
      'Testing Signed',
      'Photography Signed',
      'Awaiting Pre-Listing Review',
      'Pre-Listing Review Completed',
      'Approved For Publish',
      'Listed',
      'Marked Stale',
      'Relisted',
      'Sold Ready To Ship',
      'Shipped',
    ]);
    expect(timeline[0]).toMatchObject({ status: 'completed', actor: 'Taylor Reviewer' });
    expect(timeline[1]).toMatchObject({ status: 'pending', actor: null });
    expect(timeline[2]).toMatchObject({ status: 'completed', actor: 'Jordan Processor' });
    expect(timeline[3]).toMatchObject({ status: 'pending', actor: null });
  });

  it('includes the owner-assigned milestone when a workflow owner timestamp exists', () => {
    const timeline = buildUsedGearWorkflowTimeline({
      id: 'rec-2',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Accepted At': '2026-05-08T01:00:00.000Z',
        'Accepted By': 'Taylor Reviewer',
        'Workflow Owner': 'Jordan Processor',
        'Workflow Owner Assigned At': '2026-05-08T01:30:00.000Z',
      },
    });

    expect(timeline[1]).toMatchObject({
      id: 'owner-assigned',
      label: 'Owner Assigned',
      status: 'completed',
      actor: 'Jordan Processor',
    });
  });
});