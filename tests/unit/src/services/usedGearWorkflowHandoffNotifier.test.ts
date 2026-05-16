import { describe, expect, it, vi } from 'vitest';
import { publishUsedGearStageHandoffNotification } from '@/services/usedGearWorkflowHandoffNotifier';
import type { AppUser } from '@/stores/auth/authTypes';
import type { AirtableRecord } from '@/types/airtable';

function makeUser(): AppUser {
  return {
    id: 'user-1',
    name: 'Taylor Reviewer',
    email: 'taylor@example.com',
    role: 'admin',
    allowedPages: [],
    notificationPreferences: {
      infoEnabled: true,
      successEnabled: true,
      warningEnabled: true,
      errorEnabled: true,
      autoDismissMs: 5000,
      workflowAssignedAlertsEnabled: true,
      workflowUnassignedAlertsEnabled: true,
      workflowEvents: {
        pendingReview: false,
        processing: false,
        testing: true,
        photography: true,
        preListingReview: true,
        approvedForPublish: false,
      },
    },
  };
}

function makeRecord(id: string, fields: Record<string, unknown>): AirtableRecord {
  return {
    id,
    createdTime: '2026-05-08T00:00:00.000Z',
    fields: {
      SKU: `UG-${id}`,
      Make: 'McIntosh',
      Model: 'MC275',
      ...fields,
    },
  };
}

describe('publishUsedGearStageHandoffNotification', () => {
  it('uses a shared digest key for repeated same-route handoffs', () => {
    const upsertByKey = vi.fn();
    const onOpenOperationalRecord = vi.fn();

    publishUsedGearStageHandoffNotification({
      currentUser: makeUser(),
      completedStage: 'processing',
      record: makeRecord('1', { 'Workflow Status': 'Testing and Photography In Progress' }),
      onOpenOperationalRecord,
      upsertByKey,
    });

    publishUsedGearStageHandoffNotification({
      currentUser: makeUser(),
      completedStage: 'processing',
      record: makeRecord('2', { 'Workflow Status': 'Testing and Photography In Progress' }),
      onOpenOperationalRecord,
      upsertByKey,
    });

    expect(upsertByKey).toHaveBeenNthCalledWith(
      1,
      'used-gear-stage-handoff:testing-photography',
      expect.objectContaining({ actionLabel: 'Open Operational Record' }),
    );
    expect(upsertByKey).toHaveBeenNthCalledWith(
      2,
      'used-gear-stage-handoff:testing-photography',
      expect.objectContaining({
        message: expect.stringContaining('UG-2'),
      }),
    );

    const secondInput = upsertByKey.mock.calls[1]?.[1];
    secondInput?.onAction?.();
    expect(onOpenOperationalRecord).toHaveBeenCalledWith('2');
  });
});