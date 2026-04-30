import { useEffect, useMemo } from 'react';
import {
  EMPTY_SHOPIFY_CATEGORY_RESOLUTION,
  EMPTY_SHOPIFY_FIELD_RESOLUTION,
} from '@/components/approval/listingApprovalShopifyConstants';
import {
  resolveEbayListingTemplateHtml,
  type EbayListingTemplateId,
} from '@/components/approval/listingApprovalEbayConstants';
import {
  isEbayGlobalShippingFieldName,
  isEbayHandlingCostFieldName,
  isRemovedCombinedEbayPriceFieldName,
} from '@/components/approval/listingApprovalFieldHelpers';
import { useApprovalPreview } from '@/hooks/approval/useApprovalPreview';
import { fromFormValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

interface UseListingApprovalPreviewStateParams {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  selectedRecord: AirtableRecord | null;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  ebayCategoryLabelsById: Record<string, string>;
  selectedEbayTemplateId: EbayListingTemplateId;
  combinedEbayBodyHtmlFieldName: string;
  combinedEbayTestingNotesFieldName: string;
  combinedEbayTitleFieldName: string;
  combinedDescriptionFieldName: string;
  combinedSharedKeyFeaturesFieldName: string;
}

export function useListingApprovalPreviewState({
  approvalChannel,
  isCombinedApproval,
  selectedRecord,
  fieldKinds,
  formValues,
  setFormValue,
  ebayCategoryLabelsById,
  selectedEbayTemplateId,
  combinedEbayBodyHtmlFieldName,
  combinedEbayTestingNotesFieldName,
  combinedEbayTitleFieldName,
  combinedDescriptionFieldName,
  combinedSharedKeyFeaturesFieldName,
}: UseListingApprovalPreviewStateParams) {
  const {
    ebayApprovalPreview,
    isEbayPayloadPreviewContext,
    isShopifyPayloadPreviewContext,
    loadShopifyApprovalPreviewNow,
    mergedDraftSourceFields,
    shopifyApprovalPreview,
  } = useApprovalPreview({
    approvalChannel,
    selectedRecord,
    fieldKinds,
    formValues,
    setFormValue,
    fromFormValue,
    isCombinedApproval,
    ebayCategoryLabelsById,
    selectedEbayTemplateHtml: resolveEbayListingTemplateHtml(selectedEbayTemplateId),
    combinedEbayTitleFieldName,
    combinedDescriptionFieldName,
    combinedSharedKeyFeaturesFieldName,
    combinedEbayTestingNotesFieldName,
    combinedEbayBodyHtmlFieldName,
    isRemovedCombinedEbayPriceFieldName,
    isEbayHandlingCostFieldName,
    isEbayGlobalShippingFieldName,
  });

  const currentPageProductDescriptionResolution = shopifyApprovalPreview?.productDescriptionResolution ?? EMPTY_SHOPIFY_FIELD_RESOLUTION;
  const currentPageProductDescription = currentPageProductDescriptionResolution.value;
  const currentPageShopifyBodyHtml = shopifyApprovalPreview?.bodyHtmlResolution.value ?? '';
  const currentPageShopifyTagValues = shopifyApprovalPreview?.tagValues ?? [];
  const currentPageShopifyCollectionIds = shopifyApprovalPreview?.collectionIds ?? [];
  const currentPageShopifyCollectionLabelsById = shopifyApprovalPreview?.collectionLabelsById ?? {};
  const currentPageProductCategoryResolution = shopifyApprovalPreview?.productCategoryResolution ?? EMPTY_SHOPIFY_FIELD_RESOLUTION;
  const currentPageCategoryIdResolution = shopifyApprovalPreview?.categoryIdResolution ?? EMPTY_SHOPIFY_FIELD_RESOLUTION;
  const shopifyCategoryLookupValue = shopifyApprovalPreview?.categoryLookupValue ?? '';
  const shopifyCategoryResolution = shopifyApprovalPreview?.categoryResolution ?? EMPTY_SHOPIFY_CATEGORY_RESOLUTION;
  const shopifyProductSetRequest = shopifyApprovalPreview?.productSetRequest ?? null;
  const combinedEbayGeneratedBodyHtml = ebayApprovalPreview?.generatedBodyHtml ?? '';

  useEffect(() => {
    if (!isCombinedApproval || !combinedEbayBodyHtmlFieldName) return;
    if (!combinedEbayGeneratedBodyHtml.trim()) return;

    const current = formValues[combinedEbayBodyHtmlFieldName] ?? '';
    if (current !== combinedEbayGeneratedBodyHtml) {
      setFormValue(combinedEbayBodyHtmlFieldName, combinedEbayGeneratedBodyHtml);
    }
  }, [
    combinedEbayBodyHtmlFieldName,
    combinedEbayGeneratedBodyHtml,
    formValues,
    isCombinedApproval,
    setFormValue,
  ]);

  const ebayDraftPayloadBundle = useMemo(() => {
    if (!isEbayPayloadPreviewContext) return null;
    return ebayApprovalPreview?.draftPayloadBundle ?? null;
  }, [ebayApprovalPreview, isEbayPayloadPreviewContext]);

  return {
    combinedEbayGeneratedBodyHtml,
    currentPageCategoryIdResolution,
    currentPageProductCategoryResolution,
    currentPageProductDescription,
    currentPageProductDescriptionResolution,
    currentPageShopifyBodyHtml,
    currentPageShopifyCollectionIds,
    currentPageShopifyCollectionLabelsById,
    currentPageShopifyTagValues,
    ebayDraftPayloadBundle,
    isEbayPayloadPreviewContext,
    isShopifyPayloadPreviewContext,
    loadShopifyApprovalPreviewNow,
    mergedDraftSourceFields,
    shopifyApprovalPreview,
    shopifyCategoryLookupValue,
    shopifyCategoryResolution,
    shopifyProductSetRequest,
  };
}