import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListingApprovalPublishingActions } from '@/components/approval/useListingApprovalPublishingActions';
import type { AirtableRecord } from '@/types/airtable';
import type { ShopifyProduct } from '@/types/shopify';

const {
  useListingApprovalApproveActionMock,
  useListingApprovalPublishActionsMock,
} = vi.hoisted(() => ({
  useListingApprovalApproveActionMock: vi.fn(),
  useListingApprovalPublishActionsMock: vi.fn(),
}));

vi.mock('@/components/approval/useListingApprovalApproveAction', () => ({
  useListingApprovalApproveAction: useListingApprovalApproveActionMock,
}));

vi.mock('@/components/approval/useListingApprovalPublishActions', () => ({
  useListingApprovalPublishActions: useListingApprovalPublishActionsMock,
}));

const record: AirtableRecord = {
  id: 'rec-wrapper-1',
  createdTime: '2026-04-29T00:00:00.000Z',
  fields: { Name: 'McIntosh MA6900' },
};

const product: ShopifyProduct = { id: 44, title: 'McIntosh MA6900' };

describe('useListingApprovalPublishingActions', () => {
  beforeEach(() => {
    useListingApprovalApproveActionMock.mockReset();
    useListingApprovalPublishActionsMock.mockReset();
  });

  it('wires publish and approve helpers together and exposes their actions', () => {
    const handlePrimaryAction = vi.fn();
    const runCombinedPush = vi.fn();

    useListingApprovalPublishActionsMock.mockReturnValue({
      pushingTarget: 'both',
      runCombinedPush,
    });
    useListingApprovalApproveActionMock.mockReturnValue({
      approving: true,
      handlePrimaryAction,
    });

    const params = {
      selectedRecord: record,
      approvalChannel: 'combined' as const,
      actualFieldNames: ['Name'],
      approvedFieldName: 'Approved',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      formValues: { Name: 'McIntosh MA6900' },
      setFormValue: vi.fn(),
      saveRecord: vi.fn(),
      createShopifyDraftOnApprove: false,
      shopifyApprovalPreview: {
        effectiveProduct: product,
        collectionIds: ['gid://shopify/Collection/1'],
        resolvedCategoryId: 'gid://shopify/TaxonomyCategory/1',
      },
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
      approvalPublishSource: 'approval-shopify' as const,
      mergedDraftSourceFields: { Name: 'McIntosh MA6900' },
      onBackToList: vi.fn(),
      pushInlineActionNotice: vi.fn(),
      requestConfirmation: vi.fn(),
    };

    const { result } = renderHook(() => useListingApprovalPublishingActions(params));

    expect(useListingApprovalPublishActionsMock).toHaveBeenCalledWith({
      selectedRecord: record,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      approvalPublishSource: 'approval-shopify',
      mergedDraftSourceFields: { Name: 'McIntosh MA6900' },
      setFormValue: params.setFormValue,
      pushInlineActionNotice: params.pushInlineActionNotice,
      requestConfirmation: params.requestConfirmation,
    });

    expect(useListingApprovalApproveActionMock).toHaveBeenCalledWith({
      selectedRecord: record,
      approvalChannel: 'combined',
      actualFieldNames: ['Name'],
      approvedFieldName: 'Approved',
      tableReference: 'appApproval/viwApproval',
      tableName: 'Approval',
      formValues: { Name: 'McIntosh MA6900' },
      setFormValue: params.setFormValue,
      saveRecord: params.saveRecord,
      createShopifyDraftOnApprove: false,
      shopifyApprovalPreview: params.shopifyApprovalPreview,
      loadShopifyApprovalPreviewNow: params.loadShopifyApprovalPreviewNow,
      syncExistingShopifyListing: params.syncExistingShopifyListing,
      describeShopifyCreateError: params.describeShopifyCreateError,
      resolveShopifyCategoryId: params.resolveShopifyCategoryId,
      upsertShopifyProductWithCollectionFallback: params.upsertShopifyProductWithCollectionFallback,
      canUpdateApprovedShopifyListing: false,
      hasMissingShopifyRequiredFields: false,
      hasMissingEbayRequiredFields: false,
      missingShopifyRequiredFieldLabels: [],
      missingEbayRequiredFieldLabels: [],
      onBackToList: params.onBackToList,
      pushInlineActionNotice: params.pushInlineActionNotice,
      requestConfirmation: params.requestConfirmation,
    });

    expect(result.current.approving).toBe(true);
    expect(result.current.pushingTarget).toBe('both');
    expect(result.current.handlePrimaryAction).toBe(handlePrimaryAction);
    expect(result.current.runCombinedPush).toBe(runCombinedPush);
  });
});