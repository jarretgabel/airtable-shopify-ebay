import { useEffect, useMemo } from 'react';
import {
  EMPTY_SHOPIFY_CATEGORY_RESOLUTION,
  EMPTY_SHOPIFY_FIELD_RESOLUTION,
  SHOPIFY_PRODUCT_SET_MUTATION,
  SHOPIFY_SEARCH_TAXONOMY_CATEGORIES_QUERY,
  SHOPIFY_UNIFIED_PRODUCT_SET_DOCS_EXAMPLE,
} from '@/components/approval/listingApprovalShopifyConstants';
import {
  EBAY_DRAFT_PAYLOAD_DOCS_EXAMPLE,
  resolveEbayListingTemplateHtml,
  type EbayListingTemplateId,
} from '@/components/approval/listingApprovalEbayConstants';
import {
  isEbayGlobalShippingFieldName,
  isEbayHandlingCostFieldName,
  isRemovedCombinedEbayPriceFieldName,
} from '@/components/approval/listingApprovalFieldHelpers';
import { useApprovalPreview } from '@/hooks/approval/useApprovalPreview';
import type { ShopifyUnifiedProductSetRequest } from '@/services/shopify';
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
  const effectiveShopifyCreatePayload = shopifyApprovalPreview?.productSetRequest ?? null;
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

  const shopifyDraftCreatePayloadJson = useMemo(() => {
    if (!effectiveShopifyCreatePayload) return '';

    try {
      const previewVariables: ShopifyUnifiedProductSetRequest = {
        ...effectiveShopifyCreatePayload,
        input: {
          ...effectiveShopifyCreatePayload.input,
          tags: effectiveShopifyCreatePayload.input.tags ?? [],
          collectionsToJoin: effectiveShopifyCreatePayload.input.collectionsToJoin ?? [],
        },
      };

      return JSON.stringify({
        operationName: 'ProductSet',
        query: SHOPIFY_PRODUCT_SET_MUTATION,
        variables: previewVariables,
      }, null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize payload"\n}';
    }
  }, [effectiveShopifyCreatePayload]);

  const shopifyPayloadDebug = useMemo(() => {
    if (!effectiveShopifyCreatePayload) {
      return {
        tags: [] as string[],
        collectionsToJoin: [] as string[],
      };
    }

    return {
      tags: effectiveShopifyCreatePayload.input.tags ?? [],
      collectionsToJoin: effectiveShopifyCreatePayload.input.collectionsToJoin ?? [],
    };
  }, [effectiveShopifyCreatePayload]);

  const shopifyCategorySyncPreviewJson = useMemo(() => {
    if (!isShopifyPayloadPreviewContext) return '';
    if (!shopifyCategoryLookupValue.trim()) return '';
    if (currentPageCategoryIdResolution.value.trim() || shopifyCategoryResolution.match?.id) return '';

    const preview = {
      operationName: 'SearchTaxonomyCategories',
      query: SHOPIFY_SEARCH_TAXONOMY_CATEGORIES_QUERY,
      variables: {
        search: shopifyCategoryLookupValue,
        first: 10,
      },
      note: 'Only needed when the current page value is a taxonomy breadcrumb instead of a category GID.',
    };

    try {
      return JSON.stringify(preview, null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize GraphQL preview"\n}';
    }
  }, [currentPageCategoryIdResolution.value, isShopifyPayloadPreviewContext, shopifyCategoryLookupValue, shopifyCategoryResolution.match]);

  const ebayDraftPayloadBundle = useMemo(() => {
    if (!isEbayPayloadPreviewContext) return null;
    return ebayApprovalPreview?.draftPayloadBundle ?? null;
  }, [ebayApprovalPreview, isEbayPayloadPreviewContext]);

  const ebayDraftPayloadBundleJson = useMemo(() => {
    if (!ebayDraftPayloadBundle) return '';
    try {
      return JSON.stringify(ebayDraftPayloadBundle, null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize payload"\n}';
    }
  }, [ebayDraftPayloadBundle]);

  const shopifyCreatePayloadDocsJson = useMemo(() => {
    try {
      return JSON.stringify(SHOPIFY_UNIFIED_PRODUCT_SET_DOCS_EXAMPLE, null, 2);
    } catch {
      return '{\n  "input": {}\n}';
    }
  }, []);

  const ebayPayloadDocsJson = useMemo(() => {
    try {
      return JSON.stringify(EBAY_DRAFT_PAYLOAD_DOCS_EXAMPLE, null, 2);
    } catch {
      return '{\n  "inventoryItem": {},\n  "offer": {}\n}';
    }
  }, []);

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
    ebayDraftPayloadBundleJson,
    ebayPayloadDocsJson,
    loadShopifyApprovalPreviewNow,
    mergedDraftSourceFields,
    shopifyApprovalPreview,
    shopifyCategoryLookupValue,
    shopifyCategoryResolution,
    shopifyCategorySyncPreviewJson,
    shopifyCreatePayloadDocsJson,
    shopifyDraftCreatePayloadJson,
    shopifyPayloadDebug,
  };
}