import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createConfiguredRecordMock,
  getConfiguredRecordsMock,
  updateConfiguredRecordMock,
} = vi.hoisted(() => ({
  createConfiguredRecordMock: vi.fn(),
  getConfiguredRecordsMock: vi.fn(),
  updateConfiguredRecordMock: vi.fn(),
}));

vi.mock('@/services/app-api/airtable', () => ({
  createConfiguredRecord: createConfiguredRecordMock,
  getConfiguredRecords: getConfiguredRecordsMock,
  updateConfiguredRecord: updateConfiguredRecordMock,
}));

import {
  createNotificationPreferencesForRole,
  createDefaultRoleWorkflowNotificationDefaults,
  loadRoleWorkflowNotificationDefaults,
  normalizeNotificationPreferencesForRole,
  setRoleWorkflowNotificationDefaults,
  syncRoleWorkflowNotificationDefaultsFromAirtable,
  updateStoredRoleWorkflowNotificationDefault,
} from '@/services/roleNotificationDefaults';

describe('roleNotificationDefaults', () => {
  beforeEach(() => {
    createConfiguredRecordMock.mockReset();
    getConfiguredRecordsMock.mockReset();
    updateConfiguredRecordMock.mockReset();
    setRoleWorkflowNotificationDefaults(createDefaultRoleWorkflowNotificationDefaults());
  });

  it('falls back to the built-in role defaults when storage is empty', () => {
    expect(loadRoleWorkflowNotificationDefaults()).toEqual(createDefaultRoleWorkflowNotificationDefaults());
  });

  it('includes owner defaults alongside the other roles', () => {
    expect(loadRoleWorkflowNotificationDefaults().owner).toEqual({
      pendingReview: true,
      processing: true,
      testing: true,
      photography: true,
      preListingReview: true,
      approvedForPublish: true,
    });
  });

  it('keeps processor defaults limited to processor-owned workflow stages', () => {
    expect(loadRoleWorkflowNotificationDefaults().processor).toEqual({
      pendingReview: true,
      processing: true,
      testing: false,
      photography: false,
      preListingReview: true,
      approvedForPublish: true,
    });
  });

  it('allows processor users to opt into testing and photography alerts without changing role defaults', () => {
    expect(normalizeNotificationPreferencesForRole('processor', {
      workflowEvents: {
        testing: true,
        photography: true,
      },
    }).workflowEvents).toEqual({
      pendingReview: true,
      processing: true,
      testing: true,
      photography: true,
      preListingReview: true,
      approvedForPublish: true,
    });
  });

  it('keeps developer workflow defaults disabled by default', () => {
    expect(loadRoleWorkflowNotificationDefaults().developer).toEqual({
      pendingReview: false,
      processing: false,
      testing: false,
      photography: false,
      preListingReview: false,
      approvedForPublish: false,
    });
  });

  it('loads per-role workflow alert defaults from Airtable-backed users config records', async () => {
    getConfiguredRecordsMock.mockResolvedValue([
      {
        id: 'rec-role-defaults-tester',
        fields: {
          'User Id': '__role-defaults__:tester',
          Notifications: JSON.stringify({
            workflowEvents: {
              testing: false,
              approvedForPublish: true,
            },
          }),
        },
      },
    ]);

    await syncRoleWorkflowNotificationDefaultsFromAirtable();

    expect(loadRoleWorkflowNotificationDefaults().tester).toEqual({
      pendingReview: false,
      processing: false,
      testing: false,
      photography: false,
      preListingReview: false,
      approvedForPublish: true,
    });
  });

  it('creates a shared Airtable-backed role defaults record when one does not exist', async () => {
    getConfiguredRecordsMock.mockResolvedValue([]);
    createConfiguredRecordMock.mockResolvedValue({ id: 'rec-role-defaults-photographer', fields: {} });

    await updateStoredRoleWorkflowNotificationDefault('photographer', 'photography', false);
    await updateStoredRoleWorkflowNotificationDefault('photographer', 'approvedForPublish', true);

    expect(createConfiguredRecordMock).toHaveBeenCalledTimes(2);
    expect(createConfiguredRecordMock).toHaveBeenLastCalledWith('users', expect.objectContaining({
      'User Id': '__role-defaults__:photographer',
      Email: 'role-defaults+photographer@internal.invalid',
      Notifications: JSON.stringify({
        workflowEvents: {
          pendingReview: false,
          processing: false,
          testing: false,
          photography: false,
          preListingReview: false,
          approvedForPublish: true,
        },
      }),
    }), { typecast: true });
  });

  it('builds role notification preferences from the cached shared defaults', () => {
    setRoleWorkflowNotificationDefaults({
      ...createDefaultRoleWorkflowNotificationDefaults(),
      developer: createDefaultRoleWorkflowNotificationDefaults().developer,
      owner: createDefaultRoleWorkflowNotificationDefaults().owner,
      photographer: {
        pendingReview: false,
        processing: false,
        testing: false,
        photography: false,
        preListingReview: false,
        approvedForPublish: true,
      },
    });

    expect(createNotificationPreferencesForRole('photographer').workflowEvents).toEqual({
      pendingReview: false,
      processing: false,
      testing: false,
      photography: false,
      preListingReview: false,
      approvedForPublish: true,
    });
  });

  it('merges stored role defaults with explicit per-user overrides', () => {
    setRoleWorkflowNotificationDefaults({
      ...createDefaultRoleWorkflowNotificationDefaults(),
      developer: createDefaultRoleWorkflowNotificationDefaults().developer,
      owner: createDefaultRoleWorkflowNotificationDefaults().owner,
      processor: {
        pendingReview: false,
        processing: false,
        testing: true,
        photography: true,
        preListingReview: true,
        approvedForPublish: true,
      },
    });

    expect(normalizeNotificationPreferencesForRole('processor', {
      workflowEvents: {
        processing: true,
      } as Partial<ReturnType<typeof createNotificationPreferencesForRole>['workflowEvents']>,
    }).workflowEvents).toEqual({
      pendingReview: false,
      processing: true,
      testing: true,
      photography: true,
      preListingReview: true,
      approvedForPublish: true,
    });
  });
});