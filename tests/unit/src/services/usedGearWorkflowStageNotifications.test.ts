import { describe, expect, it } from 'vitest';
import {
  buildUsedGearStageHandoffNotification,
  type UsedGearCompletedStage,
} from '@/services/usedGearWorkflowStageNotifications';
import type { AppUser } from '@/stores/auth/authTypes';
import type { AirtableRecord } from '@/types/airtable';

function makeUser(overrides?: Partial<AppUser>): AppUser {
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
        testing: false,
        photography: false,
        preListingReview: false,
        approvedForPublish: false,
      },
    },
    ...overrides,
  };
}

function makeRecord(fields: Record<string, unknown>): AirtableRecord {
  return {
    id: 'rec-stage-1',
    createdTime: '2026-05-08T00:00:00.000Z',
    fields: {
      SKU: 'UG-100',
      Make: 'McIntosh',
      Model: 'MC275',
      ...fields,
    },
  };
}

function buildNotification(
  completedStage: UsedGearCompletedStage,
  record: AirtableRecord,
  user: AppUser,
) {
  return buildUsedGearStageHandoffNotification({
    completedStage,
    currentUser: user,
    record,
  });
}

describe('buildUsedGearStageHandoffNotification', () => {
  it('notifies when processing hands off to concurrent testing and photography', () => {
    const user = makeUser({
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
          photography: false,
          preListingReview: false,
          approvedForPublish: false,
        },
      },
    });

    const notification = buildNotification('processing', makeRecord({
      'Workflow Status': 'Testing and Photography In Progress',
    }), user);

    expect(notification).toEqual({
      key: 'used-gear-stage-handoff:rec-stage-1:processing',
      digestKey: 'used-gear-stage-handoff:testing-photography',
      tone: 'info',
      title: 'Processing complete: testing and photography next',
      message: 'UG-100 (McIntosh MC275) is ready for concurrent testing and photography work.',
    });
  });

  it('routes testing completion to photography when photography is still unsigned', () => {
    const user = makeUser({
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
          testing: false,
          photography: true,
          preListingReview: false,
          approvedForPublish: false,
        },
      },
    });

    const notification = buildNotification('testing', makeRecord({
      'Workflow Status': 'Testing and Photography In Progress',
      'Testing Signed By': 'Taylor Reviewer',
      'Testing Signed At': '2026-05-08T01:00:00.000Z',
    }), user);

    expect(notification).toEqual({
      key: 'used-gear-stage-handoff:rec-stage-1:testing',
      digestKey: 'used-gear-stage-handoff:photography-only',
      tone: 'info',
      title: 'Testing complete: photography next',
      message: 'UG-100 (McIntosh MC275) is now waiting only on photography completion.',
    });
  });

  it('routes the final concurrent signoff to pre-listing review', () => {
    const user = makeUser({
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
          testing: false,
          photography: false,
          preListingReview: true,
          approvedForPublish: false,
        },
      },
    });

    const notification = buildNotification('photography', makeRecord({
      'Workflow Status': 'Awaiting Pre-Listing Review',
      'Testing Signed By': 'Taylor Reviewer',
      'Testing Signed At': '2026-05-08T01:00:00.000Z',
      'Photography Signed By': 'Sam Photographer',
      'Photography Signed At': '2026-05-08T02:00:00.000Z',
    }), user);

    expect(notification).toEqual({
      key: 'used-gear-stage-handoff:rec-stage-1:photography',
      digestKey: 'used-gear-stage-handoff:pre-listing-review',
      tone: 'warning',
      title: 'Stage handoff complete: pre-listing review next',
      message: 'UG-100 (McIntosh MC275) cleared testing and photography and is ready for pre-listing review.',
    });
  });

  it('suppresses notifications when the relevant workflow event is disabled', () => {
    const user = makeUser();

    const notification = buildNotification('testing', makeRecord({
      'Workflow Status': 'Testing and Photography In Progress',
      'Testing Signed By': 'Taylor Reviewer',
      'Testing Signed At': '2026-05-08T01:00:00.000Z',
    }), user);

    expect(notification).toBeNull();
  });
});