import { describe, expect, it } from 'vitest';
import { buildUsedGearWorkflowDashboardTargets } from '@/services/usedGearWorkflowDashboardTargets';
import type { AirtableRecord } from '@/types/airtable';

function buildRecord(overrides: Partial<AirtableRecord>): AirtableRecord {
  return {
    id: 'rec-workflow-1',
    createdTime: '2026-05-01T00:00:00.000Z',
    fields: {},
    ...overrides,
  };
}

describe('usedGearWorkflowDashboardTargets', () => {
  it('selects the oldest pending review and progress groups by created time', () => {
    const targets = buildUsedGearWorkflowDashboardTargets(
      [
        buildRecord({
          id: 'rec-pending-1',
          createdTime: '2026-05-03T00:00:00.000Z',
          fields: {
            'Workflow Status': 'Pending Review',
            'Pick Up ID': 'pickup-b',
          },
        }),
        buildRecord({
          id: 'rec-pending-2',
          createdTime: '2026-05-01T00:00:00.000Z',
          fields: {
            'Workflow Status': 'Pending Review',
            'Pick Up ID': 'pickup-a',
          },
        }),
      ],
      [
        buildRecord({
          id: 'rec-progress-1',
          createdTime: '2026-05-04T00:00:00.000Z',
          fields: {
            'Workflow Status': 'Testing In Progress',
            'Pick Up ID': 'submission-b',
          },
        }),
        buildRecord({
          id: 'rec-progress-2',
          createdTime: '2026-05-02T00:00:00.000Z',
          fields: {
            'Workflow Status': 'Accepted - Awaiting Arrival',
            'Pick Up ID': 'submission-a',
          },
        }),
      ],
    );

    expect(targets.pendingReviewOldestGroup).toEqual({
      id: 'pickup-a',
      label: 'pickup-a',
    });
    expect(targets.progressOldestGroup).toEqual({
      id: 'submission-a',
      label: 'submission-a',
    });
  });
});