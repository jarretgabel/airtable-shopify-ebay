import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListingApprovalPublishActions } from '@/components/approval/useListingApprovalPublishActions';
import { useListingApprovalSaveActions } from '@/components/approval/useListingApprovalSaveActions';
import { useNotificationStore } from '@/stores/notificationStore';
import type { AirtableRecord } from '@/types/airtable';

const {
  publishApprovalRecordMock,
  trackWorkflowEventMock,
  updateConfiguredRecordMock,
  loadRecordsMock,
  uploadImageUrlToEbayHostedPicturesMock,
} = vi.hoisted(() => ({
  publishApprovalRecordMock: vi.fn(),
  trackWorkflowEventMock: vi.fn(),
  updateConfiguredRecordMock: vi.fn(),
  loadRecordsMock: vi.fn(),
  uploadImageUrlToEbayHostedPicturesMock: vi.fn(),
}));

vi.mock('@/services/app-api/approval', () => ({
  publishApprovalRecord: publishApprovalRecordMock,
}));

vi.mock('@/services/workflowAnalytics', () => ({
  trackWorkflowEvent: trackWorkflowEventMock,
}));

vi.mock('@/services/app-api/airtable', () => ({
  updateConfiguredRecord: updateConfiguredRecordMock,
}));

vi.mock('@/services/app-api/ebay', () => ({
  uploadImageUrlToEbayHostedPictures: uploadImageUrlToEbayHostedPicturesMock,
}));

vi.mock('@/stores/approvalStore', () => ({
  useApprovalStore: {
    getState: () => ({
      loadRecords: loadRecordsMock,
      formValues: {},
      initialFormValues: {},
    }),
  },
  toFormValue: (value: unknown) => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  },
}));

const record: AirtableRecord = {
  id: 'rec-notify-1',
  createdTime: '2026-04-29T00:00:00.000Z',
  fields: {
    Name: 'McIntosh MA6900',
    'Workflow Status': 'Approved for Publish',
    'Shopify REST Product ID': '44',
  },
};

describe('approval action notifications', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
    window.localStorage.clear();
    publishApprovalRecordMock.mockReset();
    trackWorkflowEventMock.mockReset();
    updateConfiguredRecordMock.mockReset();
    loadRecordsMock.mockReset();
    uploadImageUrlToEbayHostedPicturesMock.mockReset();
    loadRecordsMock.mockResolvedValue(undefined);
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
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: { Name: 'McIntosh MA6900' },
      ebayGeneratedBodyHtml: '<p>Generated eBay description</p>',
      workflowPublishSummary: {
        workflowStatus: 'Approved for Publish',
        readiness: {
          title: 'McIntosh MA6900',
          titleFieldName: 'Name',
          description: 'Freshly serviced and ready to publish.',
          descriptionFieldName: 'Description',
          price: '3499.99',
          priceFieldName: 'Price',
          blockers: [],
          missingRequirements: [],
        },
      },
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('shopify');
    });

    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(requestConfirmation).toHaveBeenCalledWith(expect.objectContaining({
      bullets: expect.arrayContaining([
        'Workflow status: Approved for Publish',
        'Resolved title: McIntosh MA6900',
        'Resolved price: 3499.99',
      ]),
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
    expect(updateConfiguredRecordMock).toHaveBeenCalledWith(
      'approval-shopify',
      'rec-notify-1',
      expect.objectContaining({
        'Workflow Status': 'Listed, Shopify',
        'Listed At': expect.any(String),
        'Shopify REST Published At': expect.any(String),
        'Shopify REST Published Scope': 'web',
        'Shopify REST Product ID': '88',
      }),
      { typecast: true },
    );
    expect(setFormValue).toHaveBeenCalledWith('Shopify REST Product ID', '88');
    expect(setFormValue).toHaveBeenCalledWith('Workflow Status', 'Listed, Shopify');
    expect(loadRecordsMock).toHaveBeenCalledWith('appApproval/viwApproval', 'Approval', true);
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
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: { Name: 'McIntosh MA6900' },
      ebayGeneratedBodyHtml: '<p>Generated eBay description</p>',
      workflowPublishSummary: null,
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
    expect(updateConfiguredRecordMock).not.toHaveBeenCalled();
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
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: {
        Name: 'McIntosh MA6900',
        'Workflow Image Metadata JSON': JSON.stringify([{
          url: 'https://i.ebayimg.com/image-1.jpg',
          filename: 'image-1.jpg',
          alt: 'McIntosh MA6900',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        }]),
      },
      ebayGeneratedBodyHtml: '<p>Generated eBay description</p>',
      workflowPublishSummary: {
        workflowStatus: 'Approved for Publish',
        readiness: {
          title: 'McIntosh MA6900',
          titleFieldName: 'Name',
          description: 'Freshly serviced and ready to publish.',
          descriptionFieldName: 'Description',
          price: '3499.99',
          priceFieldName: 'Price',
          blockers: [],
          missingRequirements: [],
        },
      },
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('both');
    });

    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(requestConfirmation).toHaveBeenCalledWith(expect.objectContaining({
      bullets: expect.arrayContaining([
        'Workflow status: Approved for Publish',
        'Resolved title: McIntosh MA6900',
        'Resolved price: 3499.99',
      ]),
      typedConfirmation: {
        expectedValue: 'PUBLISH BOTH',
        inputLabel: 'Type the publish command to confirm',
        helperText: 'Publishing can create or update live channel listings. Type the command exactly to continue.',
        placeholder: 'PUBLISH BOTH',
      },
    }));
    expect(setFormValue).toHaveBeenCalledWith('Shopify REST Product ID', '88');
    expect(updateConfiguredRecordMock).toHaveBeenCalledWith(
      'approval-shopify',
      'rec-notify-1',
      expect.objectContaining({
        'Workflow Status': 'Listed, Shopify',
        'Listed At': expect.any(String),
        'Shopify REST Published At': expect.any(String),
      }),
      { typecast: true },
    );
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'warning',
      'Shopify publish warning',
      'Collection fallback was used',
    );
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'error',
      'eBay publish failed',
      'Offer creation failed',
      { id: 'ebay-publish-progress' },
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

  it('writes approved eBay publish metadata back to the operational row', async () => {
    publishApprovalRecordMock.mockResolvedValue({
      target: 'ebay',
      ebay: {
        sku: 'MCINTOSH-MA6900',
        offerId: 'offer-9',
        listingId: 'listing-9',
        wasExistingOffer: false,
        mode: 'created',
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
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: {
        Name: 'McIntosh MA6900',
        'Workflow Image Metadata JSON': JSON.stringify([{
          url: 'https://i.ebayimg.com/image-1.jpg',
          filename: 'image-1.jpg',
          alt: 'McIntosh MA6900',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        }]),
      },
      ebayGeneratedBodyHtml: '<p>Generated eBay description</p>',
      workflowPublishSummary: null,
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('ebay');
    });

    expect(updateConfiguredRecordMock).toHaveBeenCalledWith(
      'approval-shopify',
      'rec-notify-1',
      expect.objectContaining({
        'Workflow Status': 'Listed, eBay',
        'Listed At': expect.any(String),
        'eBay Published At': expect.any(String),
        'eBay Offer ID': 'offer-9',
        'eBay Listing ID': 'listing-9',
      }),
      { typecast: true },
    );
    expect(setFormValue).toHaveBeenCalledWith('Workflow Status', 'Listed, eBay');
    expect(setFormValue).toHaveBeenCalledWith('eBay Published At', expect.any(String));
    expect(setFormValue).toHaveBeenCalledWith('eBay Offer ID', 'offer-9');
    expect(setFormValue).toHaveBeenCalledWith('eBay Listing ID', 'listing-9');
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'success',
      'eBay listing published',
      'SKU MCINTOSH-MA6900 is live as listing listing-9 via offer offer-9.',
      { id: 'ebay-publish-progress' },
    );
  });

  it('advances image progress and retries a transient eBay upload failure', async () => {
    const imageUrls = Array.from({ length: 5 }, (_, index) => `https://drive.google.com/uc?export=view&id=image-${index + 1}`);
    imageUrls[4] = 'https://cdn.example.com/listing/image-5.jpg';
    const attemptsByIndex = new Map<number, number>();
    uploadImageUrlToEbayHostedPicturesMock.mockImplementation(async (_url: string, index: number) => {
      const attempt = (attemptsByIndex.get(index) ?? 0) + 1;
      attemptsByIndex.set(index, attempt);
      if (index === 1 && attempt === 1) {
        throw new Error('The operation was aborted due to timeout');
      }
      return { url: `https://i.ebayimg.com/image-${index + 1}.jpg` };
    });
    publishApprovalRecordMock.mockResolvedValue({
      target: 'ebay',
      ebay: {
        sku: 'MCINTOSH-MA6900',
        offerId: 'offer-9',
        listingId: 'listing-9',
        wasExistingOffer: true,
        mode: 'updated',
      },
      failures: [],
    });

    const pushInlineActionNotice = vi.fn();
    const { result } = renderHook(() => useListingApprovalPublishActions({
      selectedRecord: record,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: {
        SKU: 'MCINTOSH-MA6900',
        Description: 'Integrated amplifier with recent bench verification.',
        'Workflow Image Metadata JSON': JSON.stringify(imageUrls.map((url, index) => ({
          url,
          filename: `image-${index + 1}.jpg`,
          alt: `McIntosh MA6900 image ${index + 1}`,
          sortOrder: index + 1,
          sourceStage: 'photos',
          includedInListing: true,
        }))),
      },
      ebayGeneratedBodyHtml: '<p>Generated eBay description</p>',
      workflowPublishSummary: null,
      setFormValue: vi.fn(),
      pushInlineActionNotice,
      requestConfirmation: vi.fn(async () => true),
    }));

    await act(async () => {
      await result.current.runCombinedPush('ebay');
    });

    expect(uploadImageUrlToEbayHostedPicturesMock).toHaveBeenCalledTimes(6);
    expect(attemptsByIndex.get(1)).toBe(2);
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'info',
      'Uploading eBay images',
      'Uploading approved images to eBay (0/5).',
      { id: 'ebay-publish-progress', persistent: true },
    );
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'info',
      'Uploading eBay images',
      'Uploading approved images to eBay (1/5).',
      { id: 'ebay-publish-progress', persistent: true },
    );
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'info',
      'Uploading eBay images',
      'Uploading approved images to eBay (4/5).',
      { id: 'ebay-publish-progress', persistent: true },
    );
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'info',
      'Uploading eBay images',
      'Uploading approved images to eBay (5/5).',
      { id: 'ebay-publish-progress', persistent: true },
    );
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'info',
      'Publishing eBay listing',
      'Images are ready. Creating or updating the eBay offer and publishing the listing.',
      { id: 'ebay-publish-progress', persistent: true },
    );
    expect(publishApprovalRecordMock).toHaveBeenCalledWith(
      'approval-shopify',
      'rec-notify-1',
      'ebay',
      expect.objectContaining({
        fields: expect.objectContaining({
          Description: 'Integrated amplifier with recent bench verification.',
          'Ebay Body (HTML)': '<p>Generated eBay description</p>',
          'eBay Inventory Product Image URLs JSON': JSON.stringify(
            imageUrls.map((_, index) => `https://i.ebayimg.com/image-${index + 1}.jpg`),
          ),
        }),
      }),
    );
  });

  it('stops before eBay publish when the listing has no source images', async () => {
    const pushInlineActionNotice = vi.fn();
    const { result } = renderHook(() => useListingApprovalPublishActions({
      selectedRecord: record,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: {
        SKU: 'MCINTOSH-MA6900',
        Description: 'Integrated amplifier with recent bench verification.',
      },
      ebayGeneratedBodyHtml: '<p>Generated eBay description</p>',
      workflowPublishSummary: null,
      setFormValue: vi.fn(),
      pushInlineActionNotice,
      requestConfirmation: vi.fn(async () => true),
    }));

    await act(async () => {
      await result.current.runCombinedPush('ebay');
    });

    expect(uploadImageUrlToEbayHostedPicturesMock).not.toHaveBeenCalled();
    expect(publishApprovalRecordMock).not.toHaveBeenCalled();
    expect(pushInlineActionNotice).toHaveBeenCalledWith(
      'error',
      'Publish failed',
      'No approved listing images were found. Restore or select listing images before publishing to eBay; eBay image upload did not run.',
      { id: 'ebay-publish-progress' },
    );
  });

  it('retries writeback without unknown Airtable fields when publish metadata includes unsupported keys', async () => {
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

    updateConfiguredRecordMock
      .mockRejectedValueOnce(new Error('Unknown field name: "Shopify REST Published Scope"'))
      .mockResolvedValueOnce({
        id: 'rec-notify-1',
        fields: {
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2026-04-29T00:00:00.000Z',
          'Shopify REST Published At': '2026-04-29T00:00:00.000Z',
          'Shopify REST Product ID': '88',
        },
      });

    const requestConfirmation = vi.fn(async () => true);
    const pushInlineActionNotice = vi.fn();
    const setFormValue = vi.fn();

    const { result } = renderHook(() => useListingApprovalPublishActions({
      selectedRecord: record,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: { Name: 'McIntosh MA6900' },
      workflowPublishSummary: null,
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('shopify');
    });

    expect(updateConfiguredRecordMock).toHaveBeenCalledTimes(2);
    expect(updateConfiguredRecordMock).toHaveBeenNthCalledWith(
      1,
      'approval-shopify',
      'rec-notify-1',
      expect.objectContaining({
        'Shopify REST Published Scope': 'web',
      }),
      { typecast: true },
    );
    expect(updateConfiguredRecordMock).toHaveBeenNthCalledWith(
      2,
      'approval-shopify',
      'rec-notify-1',
      expect.not.objectContaining({
        'Shopify REST Published Scope': 'web',
      }),
      { typecast: true },
    );
    expect(pushInlineActionNotice).not.toHaveBeenCalledWith(
      'warning',
      'Workflow lifecycle writeback failed',
      expect.any(String),
    );
  });

  it('forces Shopify publish to use included workflow images from metadata over stale Shopify image JSON', async () => {
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
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: {
        Name: 'McIntosh MA6900',
        Description: 'Listing detail description should win.',
        'Shopify REST Images JSON': JSON.stringify([
          { src: 'https://legacy.example/1.jpg', alt: '', position: 1 },
          { src: 'https://legacy.example/2.jpg', alt: '', position: 2 },
          { src: 'https://legacy.example/3.jpg', alt: '', position: 3 },
          { src: 'https://legacy.example/4.jpg', alt: '', position: 4 },
          { src: 'https://legacy.example/5.jpg', alt: '', position: 5 },
          { src: 'https://legacy.example/6.jpg', alt: '', position: 6 },
        ]),
        'Workflow Image Metadata JSON': JSON.stringify([
          { url: 'https://approved.example/a.jpg', alt: 'A', sortOrder: 1, includedInListing: true },
          { url: 'https://approved.example/b.jpg', alt: 'B', sortOrder: 2, includedInListing: true },
          { url: 'https://approved.example/c.jpg', alt: 'C', sortOrder: 3, includedInListing: true },
          { url: 'https://approved.example/d.jpg', alt: 'D', sortOrder: 4, includedInListing: false },
        ]),
      },
      workflowPublishSummary: null,
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('shopify');
    });

    const publishCall = publishApprovalRecordMock.mock.calls[0];
    const publishOptions = publishCall?.[3] as { fields?: Record<string, unknown> } | undefined;
    const imageJsonRaw = publishOptions?.fields?.['Shopify REST Images JSON'];
    const imageRows = typeof imageJsonRaw === 'string' ? JSON.parse(imageJsonRaw) as Array<{ src: string }> : [];

    expect(imageRows.map((row) => row.src)).toEqual([
      'https://approved.example/a.jpg',
      'https://approved.example/b.jpg',
      'https://approved.example/c.jpg',
    ]);
  });

  it('forces Shopify body description writeback source to listing Description when present', async () => {
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
      isShopifyPublishBlockedByAuctionFormat: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      mergedDraftSourceFields: {
        Name: 'McIntosh MA6900',
        Description: 'Primary listing detail description.',
        'Item Description': 'Stale fallback description.',
      },
      workflowPublishSummary: null,
      setFormValue,
      pushInlineActionNotice,
      requestConfirmation,
    }));

    await act(async () => {
      await result.current.runCombinedPush('shopify');
    });

    const publishCall = publishApprovalRecordMock.mock.calls[0];
    const publishOptions = publishCall?.[3] as { fields?: Record<string, unknown> } | undefined;

    expect(publishOptions?.fields?.['Shopify REST Body Description']).toBe('Primary listing detail description.');
    expect(publishOptions?.fields?.['Shopify Body Description']).toBe('Primary listing detail description.');
  });
});