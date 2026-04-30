import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListingApprovalPublishActions } from '@/components/approval/useListingApprovalPublishActions';
import { useListingApprovalSaveActions } from '@/components/approval/useListingApprovalSaveActions';
import { useNotificationStore } from '@/stores/notificationStore';
import type { AirtableRecord } from '@/types/airtable';

const {
  publishApprovalRecordMock,
  trackWorkflowEventMock,
  updateRecordFromResolvedSourceMock,
} = vi.hoisted(() => ({
  publishApprovalRecordMock: vi.fn(),
  trackWorkflowEventMock: vi.fn(),
  updateRecordFromResolvedSourceMock: vi.fn(),
}));

vi.mock('@/services/app-api/approval', () => ({
  publishApprovalRecord: publishApprovalRecordMock,
}));

vi.mock('@/services/workflowAnalytics', () => ({
  trackWorkflowEvent: trackWorkflowEventMock,
}));

vi.mock('@/services/app-api/airtable', () => ({
  updateRecordFromResolvedSource: updateRecordFromResolvedSourceMock,
}));

const record: AirtableRecord = {
  id: 'rec-notify-1',
  createdTime: '2026-04-29T00:00:00.000Z',
  fields: {
    Name: 'McIntosh MA6900',
    'Shopify REST Product ID': '44',
  },
};

describe('approval action notifications', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
    window.localStorage.clear();
    publishApprovalRecordMock.mockReset();
    trackWorkflowEventMock.mockReset();
    updateRecordFromResolvedSourceMock.mockReset();
  });

  it('publishes a save result notification after a successful save', async () => {
    const requestConfirmation = vi.fn(async () => true);
    const pushInlineActionNotice = vi.fn();
    const saveRecord = vi.fn(async () => true);
    const setFormValue = vi.fn();
    const hydrateForm = vi.fn();

    const { result } = renderHook(() => useListingApprovalSaveActions({
      selectedRecord: record,
      approvalChannel: 'combined',
      allFieldNames: ['Name'],
      approvedFieldName: 'Approved',
      actualFieldNames: ['Name'],
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      formValues: { Name: 'McIntosh MA6900 MkII' },
      setFormValue,
      hydrateForm,
      saveRecord,
      bodyHtmlPreview: '',
      ebayBodyHtmlSaveFieldName: '',
      shouldForceEbayBodyHtmlSave: false,
      combinedSharedKeyFeaturesFieldName: undefined,
      combinedEbayTestingNotesFieldName: undefined,
      priceFieldName: '',
      pushInlineActionNotice,
      changedFieldNames: ['Name', 'Price'],
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.handleSaveUpdates();
    });

    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(saveRecord).toHaveBeenCalledTimes(1);
    expect(pushInlineActionNotice).toHaveBeenCalledWith('success', 'Listing updated', 'Listing changes were saved to Airtable.');

    await waitFor(() => {
      const notification = useNotificationStore.getState().notifications[0];
      expect(notification?.key).toBe('approval-save-result:rec-notify-1');
      expect(notification?.tone).toBe('success');
      expect(notification?.title).toBe('Listing changes saved');
      expect(notification?.message).toContain('McIntosh MA6900');
      expect(notification?.message).toContain('2 fields updated');
    });
  });

  it('publishes a result notification after a Shopify publish completes', async () => {
    publishApprovalRecordMock.mockResolvedValue({
      target: 'shopify',
      shopify: {
        productId: '88',
        mode: 'created',
        warnings: [],
        wroteProductId: true,
        staleProductIdCleared: false,
      },
      failures: [],
    });

    const requestConfirmation = vi.fn(async () => true);
    const pushInlineActionNotice = vi.fn();
    const setFormValue = vi.fn();

    const { result } = renderHook(() => useListingApprovalPublishActions({
      selectedRecord: record,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      mergedDraftSourceFields: { Name: 'McIntosh MA6900' },
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('shopify');
    });

    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(requestConfirmation).toHaveBeenCalledWith(expect.objectContaining({
      typedConfirmation: {
        expectedValue: 'PUBLISH SHOPIFY',
        inputLabel: 'Type the publish command to confirm',
        helperText: 'Publishing can create or update live channel listings. Type the command exactly to continue.',
        placeholder: 'PUBLISH SHOPIFY',
      },
    }));
    expect(publishApprovalRecordMock).toHaveBeenCalledWith(
      'approval-shopify',
      'rec-notify-1',
      'shopify',
      {
        productIdFieldName: 'Shopify REST Product ID',
        fields: { Name: 'McIntosh MA6900' },
      },
    );
    expect(setFormValue).toHaveBeenCalledWith('Shopify REST Product ID', '88');
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'success',
      'Shopify listing created',
      'Shopify product #88 was created.',
    );

    await waitFor(() => {
      const notification = useNotificationStore.getState().notifications[0];
      expect(notification?.key).toBe('approval-publish-result:rec-notify-1');
      expect(notification?.tone).toBe('success');
      expect(notification?.title).toBe('Published to Shopify');
      expect(notification?.message).toContain('McIntosh MA6900');
      expect(notification?.message).toContain('Shopify product #88 was created');
    });
  });

  it('publishes an error notification after a publish exception', async () => {
    publishApprovalRecordMock.mockRejectedValue(new Error('Network timeout'));

    const requestConfirmation = vi.fn(async () => true);
    const pushInlineActionNotice = vi.fn();
    const setFormValue = vi.fn();

    const { result } = renderHook(() => useListingApprovalPublishActions({
      selectedRecord: record,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      mergedDraftSourceFields: { Name: 'McIntosh MA6900' },
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('shopify');
    });

    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'error',
      'Publish failed',
      'Network timeout',
    );

    await waitFor(() => {
      const notification = useNotificationStore.getState().notifications[0];
      expect(notification?.key).toBe('approval-publish-result:rec-notify-1');
      expect(notification?.tone).toBe('error');
      expect(notification?.title).toBe('Publish failed');
      expect(notification?.message).toContain('McIntosh MA6900');
      expect(notification?.message).toContain('Network timeout');
    });
    expect(setFormValue).not.toHaveBeenCalled();
  });

  it('publishes a warning notification for mixed publish results', async () => {
    publishApprovalRecordMock.mockResolvedValue({
      target: 'both',
      shopify: {
        productId: '88',
        mode: 'created',
        warnings: ['Collection fallback was used'],
        wroteProductId: true,
        staleProductIdCleared: false,
      },
      failures: [{ target: 'ebay', message: 'Offer creation failed' }],
    });

    const requestConfirmation = vi.fn(async () => true);
    const pushInlineActionNotice = vi.fn();
    const setFormValue = vi.fn();

    const { result } = renderHook(() => useListingApprovalPublishActions({
      selectedRecord: record,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      mergedDraftSourceFields: { Name: 'McIntosh MA6900' },
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('both');
    });

    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(requestConfirmation).toHaveBeenCalledWith(expect.objectContaining({
      typedConfirmation: {
        expectedValue: 'PUBLISH BOTH',
        inputLabel: 'Type the publish command to confirm',
        helperText: 'Publishing can create or update live channel listings. Type the command exactly to continue.',
        placeholder: 'PUBLISH BOTH',
      },
    }));
    expect(setFormValue).toHaveBeenCalledWith('Shopify REST Product ID', '88');
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'warning',
      'Shopify publish warning',
      'Collection fallback was used',
    );
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'error',
      'eBay publish failed',
      'Offer creation failed',
    );

    await waitFor(() => {
      const notification = useNotificationStore.getState().notifications[0];
      expect(notification?.key).toBe('approval-publish-result:rec-notify-1');
      expect(notification?.tone).toBe('warning');
      expect(notification?.title).toBe('Publish completed with issues');
      expect(notification?.message).toContain('Shopify and eBay');
      expect(notification?.message).toContain('Shopify product #88 was created');
      expect(notification?.message).toContain('1 Shopify warning returned during publish');
      expect(notification?.message).toContain('eBay: Offer creation failed');
    });
  });
});