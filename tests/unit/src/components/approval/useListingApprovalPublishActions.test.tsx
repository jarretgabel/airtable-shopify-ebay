import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useListingApprovalPublishActions } from '@/components/approval/useListingApprovalPublishActions';

const { publishMock, getRecordMock, updateRecordMock, loadRecordsMock, notifyMock, uploadMock, formValuesMock } = vi.hoisted(() => ({
  publishMock: vi.fn(),
  getRecordMock: vi.fn(),
  updateRecordMock: vi.fn(),
  loadRecordsMock: vi.fn(),
  notifyMock: vi.fn(),
  uploadMock: vi.fn(),
  formValuesMock: vi.fn(),
}));
vi.mock('@/services/app-api/approval', () => ({ publishApprovalRecord: publishMock }));
vi.mock('@/services/app-api/airtable', () => ({ getConfiguredRecord: getRecordMock, updateConfiguredRecord: updateRecordMock }));
vi.mock('@/services/app-api/ebay', () => ({ uploadImageUrlToEbayHostedPictures: uploadMock }));
vi.mock('@/stores/approvalStore', () => ({ useApprovalStore: { getState: () => ({ loadRecords: loadRecordsMock, formValues: formValuesMock() }) } }));
vi.mock('@/stores/notificationStore', () => ({ useNotificationStore: { getState: () => ({ upsertByKey: notifyMock }) } }));

function createParams(): Parameters<typeof useListingApprovalPublishActions>[0] {
  return {
    selectedRecord: {
      id: 'rec-republish',
      createdTime: '2026-05-01T00:00:00.000Z',
      fields: {
        Name: 'Bel Canto Pre 1',
        'Workflow Status': 'Listed, Shopify',
        'Listed At': '2026-05-02T00:00:00.000Z',
        'Shopify REST Product ID': '12345',
      },
    },
    hasMissingShopifyRequiredFields: false,
    hasMissingEbayRequiredFields: false,
    isShopifyPublishBlockedByAuctionFormat: false,
    missingShopifyRequiredFieldLabels: [],
    missingEbayRequiredFieldLabels: [],
    approvalPublishSource: 'approval-combined',
    tableReference: 'approval-combined',
    tableName: 'Approval',
    mergedDraftSourceFields: undefined,
    setFormValue: vi.fn(),
    setDerivedFormValue: vi.fn(),
    pushInlineActionNotice: vi.fn(),
    requestConfirmation: vi.fn(async () => true),
  };
}

describe('publish lifecycle writeback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T23:00:00.000Z'));
    publishMock.mockReset().mockResolvedValue({
      target: 'shopify',
      shopify: { productId: 12345, mode: 'updated', warnings: [] },
      failures: [],
    });
    getRecordMock.mockReset().mockResolvedValue({
      id: 'rec-republish',
      fields: { 'Workflow Status': 'Approved for Publish' },
    });
    updateRecordMock.mockReset().mockResolvedValue({});
    loadRecordsMock.mockReset().mockResolvedValue(undefined);
    notifyMock.mockReset();
    uploadMock.mockReset();
    formValuesMock.mockReset().mockReturnValue({});
  });
  afterEach(() => vi.useRealTimers());

  it('restores Listed At after takedown even when the selected record still has the old date', async () => {
    const params = createParams();
    const { result } = renderHook(() => useListingApprovalPublishActions(params));
    await act(async () => result.current.runCombinedPush('shopify'));
    expect(getRecordMock).toHaveBeenCalledWith('approval-combined', 'rec-republish');
    expect(updateRecordMock).toHaveBeenCalledWith(
      'approval-combined', 'rec-republish',
      expect.objectContaining({ 'Workflow Status': 'Listed, Shopify', 'Listed At': '2026-10-13T23:00:00.000Z' }),
      { typecast: true },
    );
    expect(params.setDerivedFormValue).toHaveBeenCalledWith('Listed At', '2026-10-13T23:00:00.000Z');
  });

  it('preserves an existing saved date when updating a live listing', async () => {
    getRecordMock.mockResolvedValue({
      id: 'rec-republish', fields: { 'Workflow Status': 'Listed, Shopify', 'Listed At': '2026-10-12T12:00:00.000Z' },
    });
    const { result } = renderHook(() => useListingApprovalPublishActions(createParams()));
    await act(async () => result.current.runCombinedPush('shopify'));
    expect(updateRecordMock.mock.calls[0][2]).not.toHaveProperty('Listed At');
  });

  it('writes Listed At when only eBay succeeds in a combined publish', async () => {
    publishMock.mockResolvedValue({
      target: 'both',
      ebay: { sku: '11750', offerId: 'offer-1', listingId: 'listing-1', mode: 'updated', wasExistingOffer: true },
      failures: [{ target: 'shopify', message: 'Shopify publish failed' }],
    });
    const { result } = renderHook(() => useListingApprovalPublishActions(createParams()));
    await act(async () => result.current.runCombinedPush('both'));
    expect(updateRecordMock).toHaveBeenCalledWith(
      'approval-combined', 'rec-republish',
      expect.objectContaining({
        'Workflow Status': 'Listed, eBay',
        'Listed At': '2026-10-13T23:00:00.000Z',
        'eBay Listing ID': 'listing-1',
      }),
      { typecast: true },
    );
    expect(updateRecordMock.mock.calls[0][2]).not.toHaveProperty('Shopify REST Product ID');
  });

  it('does not write a listing date when publishing fails', async () => {
    publishMock.mockResolvedValue({ target: 'shopify', failures: [{ target: 'shopify', message: 'Publish failed' }] });
    const { result } = renderHook(() => useListingApprovalPublishActions(createParams()));
    await act(async () => result.current.runCombinedPush('shopify'));
    expect(getRecordMock).not.toHaveBeenCalled();
    expect(updateRecordMock).not.toHaveBeenCalled();
  });

  it('reports a rejected Listed At field rather than silently dropping it', async () => {
    updateRecordMock.mockRejectedValue(new Error('Unknown field name: "Listed At"'));
    const params = createParams();
    const { result } = renderHook(() => useListingApprovalPublishActions(params));
    await act(async () => result.current.runCombinedPush('shopify'));
    expect(updateRecordMock).toHaveBeenCalledTimes(1);
    expect(params.pushInlineActionNotice).toHaveBeenCalledWith(
      'warning', 'Workflow lifecycle writeback failed', 'Unknown field name: "Listed At"',
    );
  });

  it('reuses cached images, uploads additions, and keeps the selected gallery order', async () => {
    const existingCache = { url: 'https://i.ebayimg.com/old.jpg', sha256: 'a'.repeat(64) };
    const addedCache = { url: 'https://i.ebayimg.com/new.jpg', sha256: 'b'.repeat(64) };
    const metadata = [
      { url: 'https://drive.google.com/uc?id=new-photo', filename: 'bel-canto-pre1-preamplifier-rear.jpg', alt: 'Bel Canto Pre1 preamplifier rear', sortOrder: 1, sourceStage: 'photos', includedInListing: true },
      { url: 'https://drive.google.com/uc?id=old-photo', filename: 'bel-canto-pre1-preamplifier-front.jpg', alt: 'Bel Canto Pre1 preamplifier front', sortOrder: 2, sourceStage: 'photos', includedInListing: true, ebayHostedImageCache: existingCache },
      { url: 'https://drive.google.com/uc?id=excluded-photo', sortOrder: 3, sourceStage: 'photos', includedInListing: false },
    ];
    const fields = {
      'Workflow Status': 'Listed, eBay',
      'eBay Offer ID': 'offer-1',
      'Listed At': '2026-10-12T12:00:00.000Z',
      'Workflow Image Metadata JSON': JSON.stringify(metadata),
      SKU: '11750',
      Description: 'Bel Canto Pre1 preamplifier',
    };
    const params = createParams();
    params.selectedRecord = { ...params.selectedRecord!, fields };
    params.mergedDraftSourceFields = fields;
    uploadMock.mockImplementation(async (sourceUrl: string) => sourceUrl.includes('old-photo')
      ? { ...existingCache, reused: true }
      : { ...addedCache, reused: false });
    getRecordMock.mockResolvedValue({ id: 'rec-republish', fields });
    publishMock.mockResolvedValue({
      target: 'ebay',
      ebay: { sku: '11750', offerId: 'offer-1', listingId: 'listing-1', mode: 'updated', wasExistingOffer: true },
      failures: [],
    });
    const { result } = renderHook(() => useListingApprovalPublishActions(params));
    await act(async () => result.current.runCombinedPush('ebay'));
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock).toHaveBeenCalledWith(metadata[1].url, 1, existingCache);
    expect(uploadMock).toHaveBeenCalledWith(metadata[0].url, 0, undefined);
    const savedMetadata = JSON.parse(updateRecordMock.mock.calls[0][2]['Workflow Image Metadata JSON']);
    expect(savedMetadata).toEqual([
      { ...metadata[0], ebayHostedImageCache: addedCache },
      metadata[1],
      metadata[2],
    ]);
    expect(params.setDerivedFormValue).toHaveBeenCalledWith('Workflow Image Metadata JSON', JSON.stringify(savedMetadata));
    expect(publishMock.mock.calls[0][3].fields['eBay Inventory Product Image URLs JSON'])
      .toBe(JSON.stringify([addedCache.url, existingCache.url]));
    expect(params.pushInlineActionNotice).toHaveBeenCalledWith(
      'info', 'Checking eBay images', '2/2 images ready: 1 reused, 1 uploaded.',
      { id: 'ebay-publish-progress', persistent: true },
    );

    const savedFields = { ...fields, 'Workflow Image Metadata JSON': JSON.stringify(savedMetadata) };
    getRecordMock.mockResolvedValue({ id: 'rec-republish', fields: savedFields });
    uploadMock.mockImplementation(async (_url: string, _index: number, cache: typeof existingCache) => ({ ...cache, reused: true }));
    updateRecordMock.mockClear();
    const nextParams = { ...params, selectedRecord: { ...params.selectedRecord!, fields: savedFields }, mergedDraftSourceFields: savedFields };
    const nextHook = renderHook(() => useListingApprovalPublishActions(nextParams));
    await act(async () => nextHook.result.current.runCombinedPush('ebay'));
    expect(updateRecordMock.mock.calls.every((call) => !('Workflow Image Metadata JSON' in call[2]))).toBe(true);
    expect(params.pushInlineActionNotice).toHaveBeenCalledWith(
      'info', 'Checking eBay images', '2/2 images ready: 2 reused, 0 uploaded.',
      { id: 'ebay-publish-progress', persistent: true },
    );
  });

  it('does not publish if saving prepared image fingerprints fails', async () => {
    const fields = {
      Description: 'Bel Canto Pre1 preamplifier',
      'Workflow Image Metadata JSON': JSON.stringify([{ url: 'https://drive.google.com/uc?id=photo', sourceStage: 'photos', includedInListing: true }]),
    };
    const params = { ...createParams(), mergedDraftSourceFields: fields };
    getRecordMock.mockResolvedValue({ id: 'rec-republish', fields });
    uploadMock.mockResolvedValue({ url: 'https://i.ebayimg.com/photo.jpg', sha256: 'a'.repeat(64), reused: false });
    updateRecordMock.mockRejectedValue(new Error('Airtable save unavailable'));
    const { result } = renderHook(() => useListingApprovalPublishActions(params));
    await act(async () => result.current.runCombinedPush('ebay'));
    expect(publishMock).not.toHaveBeenCalled();
    expect(params.pushInlineActionNotice).toHaveBeenCalledWith(
      'error', 'Publish failed', 'Airtable save unavailable', { id: 'ebay-publish-progress' },
    );
  });

  it('saves successful image preparations even when another image fails', async () => {
    const metadata = [
      { url: 'https://drive.google.com/uc?id=good', sourceStage: 'photos', includedInListing: true },
      { url: 'https://drive.google.com/uc?id=bad', sourceStage: 'photos', includedInListing: true },
    ];
    const fields = { Description: 'Bel Canto Pre1 preamplifier', 'Workflow Image Metadata JSON': JSON.stringify(metadata) };
    getRecordMock.mockResolvedValue({ id: 'rec-republish', fields });
    uploadMock.mockImplementation(async (url: string) => {
      if (url.includes('bad')) throw new Error('Image download failed');
      return { url: 'https://i.ebayimg.com/good.jpg', sha256: 'a'.repeat(64), reused: false };
    });
    const params = { ...createParams(), mergedDraftSourceFields: fields };
    const { result } = renderHook(() => useListingApprovalPublishActions(params));
    await act(async () => result.current.runCombinedPush('ebay'));
    expect(uploadMock).toHaveBeenCalledTimes(3);
    expect(updateRecordMock).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(updateRecordMock.mock.calls[0][2]['Workflow Image Metadata JSON']);
    expect(saved[0].ebayHostedImageCache).toEqual({ url: 'https://i.ebayimg.com/good.jpg', sha256: 'a'.repeat(64) });
    expect(saved[1]).toEqual(metadata[1]);
    expect(publishMock).not.toHaveBeenCalled();
    expect(params.pushInlineActionNotice).toHaveBeenCalledWith(
      'error', 'Publish failed', 'Could not upload eBay image 2 after 2 attempts: Image download failed', { id: 'ebay-publish-progress' },
    );
  });

  it('does not retry an uploaded image when its response is missing a fingerprint', async () => {
    const fields = {
      Description: 'Bel Canto Pre1 preamplifier',
      'Workflow Image Metadata JSON': JSON.stringify([{ url: 'https://drive.google.com/uc?id=photo', sourceStage: 'photos', includedInListing: true }]),
    };
    const params = { ...createParams(), mergedDraftSourceFields: fields };
    uploadMock.mockResolvedValue({ url: 'https://i.ebayimg.com/photo.jpg' });
    const { result } = renderHook(() => useListingApprovalPublishActions(params));
    await act(async () => result.current.runCombinedPush('ebay'));
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(publishMock).not.toHaveBeenCalled();
    expect(updateRecordMock).not.toHaveBeenCalled();
    expect(params.pushInlineActionNotice).toHaveBeenCalledWith(
      'error', 'Publish failed', expect.stringContaining('missing content fingerprint'), { id: 'ebay-publish-progress' },
    );
  });

  it('preserves unsaved image edits made while preparing the eBay images', async () => {
    const metadata = [{ url: 'https://drive.google.com/uc?id=photo', sourceStage: 'photos', includedInListing: true, alt: 'Original alt' }];
    const fields = { Description: 'Bel Canto Pre1 preamplifier', 'Workflow Image Metadata JSON': JSON.stringify(metadata) };
    const draftMetadata = [
      { ...metadata[0], includedInListing: false, alt: 'Edited alt' },
      { url: 'https://drive.google.com/uc?id=added-later', sourceStage: 'photos', includedInListing: true },
    ];
    formValuesMock.mockReturnValue({ 'Workflow Image Metadata JSON': JSON.stringify(draftMetadata) });
    getRecordMock.mockResolvedValue({ id: 'rec-republish', fields });
    const cache = { url: 'https://i.ebayimg.com/photo.jpg', sha256: 'a'.repeat(64) };
    uploadMock.mockResolvedValue({ ...cache, reused: false });
    const params = { ...createParams(), mergedDraftSourceFields: fields };
    const { result } = renderHook(() => useListingApprovalPublishActions(params));
    await act(async () => result.current.runCombinedPush('ebay'));
    expect(params.setFormValue).toHaveBeenCalledWith('Workflow Image Metadata JSON', JSON.stringify([
      { ...draftMetadata[0], ebayHostedImageCache: cache },
      draftMetadata[1],
    ]));
    expect(params.setDerivedFormValue).not.toHaveBeenCalledWith('Workflow Image Metadata JSON', expect.any(String));
    expect(JSON.parse(updateRecordMock.mock.calls[0][2]['Workflow Image Metadata JSON'])).toEqual([
      { ...metadata[0], ebayHostedImageCache: cache },
    ]);
  });
});
