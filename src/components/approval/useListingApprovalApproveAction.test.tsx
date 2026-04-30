import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListingApprovalApproveAction } from '@/components/approval/useListingApprovalApproveAction';
import type { AirtableRecord } from '@/types/airtable';

const { trackWorkflowEventMock } = vi.hoisted(() => ({
  trackWorkflowEventMock: vi.fn(),
}));

vi.mock('@/services/workflowAnalytics', () => ({
  trackWorkflowEvent: trackWorkflowEventMock,
}));

const record: AirtableRecord = {
  id: 'rec-approve-1',
  createdTime: '2026-04-29T00:00:00.000Z',
  fields: {
    Name: 'McIntosh MA6900',
  },
};

describe('useListingApprovalApproveAction', () => {
  beforeEach(() => {
    trackWorkflowEventMock.mockReset();
  });

  it('blocks approval and shows a warning when required fields are missing', async () => {
    const requestConfirmation = vi.fn();
    const pushInlineActionNotice = vi.fn();
    const saveRecord = vi.fn();

    const { result } = renderHook(() => useListingApprovalApproveAction({
      selectedRecord: record,
      approvalChannel: 'shopify',
      actualFieldNames: ['Name'],
      approvedFieldName: 'Approved',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      formValues: {},
      setFormValue: vi.fn(),
      saveRecord,
      createShopifyDraftOnApprove: false,
      shopifyApprovalPreview: null,
      loadShopifyApprovalPreviewNow: vi.fn(),
      syncExistingShopifyListing: vi.fn(),
      describeShopifyCreateError: vi.fn(),
      resolveShopifyCategoryId: vi.fn(),
      upsertShopifyProductWithCollectionFallback: vi.fn(),
      canUpdateApprovedShopifyListing: false,
      hasMissingShopifyRequiredFields: true,
      hasMissingEbayRequiredFields: false,
      missingShopifyRequiredFieldLabels: ['Title'],
      missingEbayRequiredFieldLabels: [],
      onBackToList: vi.fn(),
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.handlePrimaryAction();
    });

    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'warning',
      'Required Shopify fields missing',
      'Complete required fields before approving: Title',
    );
    expect(requestConfirmation).not.toHaveBeenCalled();
    expect(saveRecord).not.toHaveBeenCalled();
  });

  it('confirms and saves approval when the record is ready', async () => {
    const requestConfirmation = vi.fn(async () => true);
    const pushInlineActionNotice = vi.fn();
    const onBackToList = vi.fn();
    const saveRecord = vi.fn(async (_forceApproved, _selectedRecord, _tableReference, _tableName, _actualFieldNames, _approvedFieldName, onSuccess) => {
      onSuccess();
      return true;
    });

    const { result } = renderHook(() => useListingApprovalApproveAction({
      selectedRecord: record,
      approvalChannel: 'shopify',
      actualFieldNames: ['Name'],
      approvedFieldName: 'Approved',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      formValues: {},
      setFormValue: vi.fn(),
      saveRecord,
      createShopifyDraftOnApprove: false,
      shopifyApprovalPreview: null,
      loadShopifyApprovalPreviewNow: vi.fn(),
      syncExistingShopifyListing: vi.fn(),
      describeShopifyCreateError: vi.fn(),
      resolveShopifyCategoryId: vi.fn(),
      upsertShopifyProductWithCollectionFallback: vi.fn(),
      canUpdateApprovedShopifyListing: false,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      onBackToList,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.handlePrimaryAction();
    });

    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(saveRecord).toHaveBeenCalledWith(
      true,
      record,
      'appApproval/viwApproval',
      'Approval',
      ['Name'],
      'Approved',
      onBackToList,
      'approve-only',
    );
    expect(onBackToList).toHaveBeenCalledTimes(1);
    expect(trackWorkflowEventMock).toHaveBeenCalledWith('approval_approved', {
      recordId: 'rec-approve-1',
      tableReference: 'appApproval/viwApproval',
    });
    expect(pushInlineActionNotice).not.toHaveBeenCalledWith('error', 'Approval failed', expect.any(String));
  });
});