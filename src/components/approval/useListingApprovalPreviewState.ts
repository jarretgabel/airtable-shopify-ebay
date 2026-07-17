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
import { buildEbayBodyHtmlFromTemplate } from '@/services/ebayBodyHtml';
import { buildEbayDraftPayloadBundleFromApprovalFields } from '@/services/ebayDraftFromAirtable';
import { buildShopifyDraftProductFromApprovalFields } from '@/services/shopifyDraftFromAirtableProduct';
import { resolveShopifyBodyHtml } from '@/services/shopifyDraftFromAirtableBody';
import { buildShopifyUnifiedProductSetRequest } from '@/services/shopify';
import { useApprovalPreview } from '@/hooks/approval/useApprovalPreview';
import { fromFormValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

function toCombinedPreviewTextValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
      .join(', ');
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function resolveCombinedPreviewFieldValue(
  formValues: Record<string, string>,
  sourceFields: Record<string, unknown> | null | undefined,
  selectedRecord: AirtableRecord | null,
  fieldName: string,
): string {
  if (!fieldName) return '';

  const formValue = formValues[fieldName] ?? '';
  if (formValue.trim()) return formValue;

  const sourceValue = toCombinedPreviewTextValue(sourceFields?.[fieldName]).trim();
  if (sourceValue) return sourceValue;

  return toCombinedPreviewTextValue(selectedRecord?.fields[fieldName]).trim();
}

function buildCombinedPreviewSourceFields(
  formValues: Record<string, string>,
  sourceFields: Record<string, unknown> | null | undefined,
  selectedRecord: AirtableRecord | null,
): Record<string, unknown> {
  const nextFields: Record<string, unknown> = {
    ...(selectedRecord?.fields ?? {}),
    ...(sourceFields ?? {}),
  };

  Object.keys(formValues).forEach((fieldName) => {
    nextFields[fieldName] = resolveCombinedPreviewFieldValue(formValues, sourceFields, selectedRecord, fieldName);
  });

  return nextFields;
}

interface UseListingApprovalPreviewStateParams {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  selectedRecord: AirtableRecord | null;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  formValues: Record<string, string>;
  setDerivedFormValue: (fieldName: string, value: string) => void;
  ebayCategoryLabelsById: Record<string, string>;
  selectedEbayTemplateId: EbayListingTemplateId;
  combinedEbayBodyHtmlFieldName: string;
  combinedEbayTestingNotesFieldName: string;
  combinedEbayTitleFieldName: string;
  combinedDescriptionFieldName: string;
  combinedMakeFieldName: string;
  combinedModelFieldName: string;
  combinedSharedKeyFeaturesFieldName: string;
}

export function useListingApprovalPreviewState({
  approvalChannel,
  isCombinedApproval,
  selectedRecord,
  fieldKinds,
  formValues,
  setDerivedFormValue,
  ebayCategoryLabelsById,
  selectedEbayTemplateId,
  combinedEbayBodyHtmlFieldName,
  combinedEbayTestingNotesFieldName,
  combinedEbayTitleFieldName,
  combinedDescriptionFieldName,
  combinedMakeFieldName,
  combinedModelFieldName,
  combinedSharedKeyFeaturesFieldName,
}: UseListingApprovalPreviewStateParams) {
  const selectedEbayTemplateHtml = resolveEbayListingTemplateHtml(selectedEbayTemplateId);
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
    setDerivedFormValue,
    fromFormValue,
    isCombinedApproval,
    ebayCategoryLabelsById,
    selectedEbayTemplateHtml,
    combinedEbayTitleFieldName,
    combinedDescriptionFieldName,
    combinedMakeFieldName,
    combinedModelFieldName,
    combinedSharedKeyFeaturesFieldName,
    combinedEbayTestingNotesFieldName,
    combinedEbayBodyHtmlFieldName,
    isRemovedCombinedEbayPriceFieldName,
    isEbayHandlingCostFieldName,
    isEbayGlobalShippingFieldName,
  });

  const currentPageProductDescriptionResolution = shopifyApprovalPreview?.productDescriptionResolution ?? EMPTY_SHOPIFY_FIELD_RESOLUTION;
  const currentPageProductDescription = currentPageProductDescriptionResolution.value;
  const localCombinedShopifyBodyHtml = useMemo(() => {
    if (!isCombinedApproval) return '';

    const previewFields = buildCombinedPreviewSourceFields(formValues, mergedDraftSourceFields, selectedRecord);
    return resolveShopifyBodyHtml(previewFields).trim();
  }, [formValues, isCombinedApproval, mergedDraftSourceFields, selectedRecord]);
  const currentPageShopifyBodyHtml = localCombinedShopifyBodyHtml || shopifyApprovalPreview?.bodyHtmlResolution.value || '';
  const currentPageShopifyTagValues = shopifyApprovalPreview?.tagValues ?? [];
  const currentPageShopifyCollectionIds = shopifyApprovalPreview?.collectionIds ?? [];
  const currentPageShopifyCollectionLabelsById = shopifyApprovalPreview?.collectionLabelsById ?? {};
  const currentPageProductCategoryResolution = shopifyApprovalPreview?.productCategoryResolution ?? EMPTY_SHOPIFY_FIELD_RESOLUTION;
  const currentPageCategoryIdResolution = shopifyApprovalPreview?.categoryIdResolution ?? EMPTY_SHOPIFY_FIELD_RESOLUTION;
  const shopifyCategoryLookupValue = shopifyApprovalPreview?.categoryLookupValue ?? '';
  const shopifyCategoryResolution = shopifyApprovalPreview?.categoryResolution ?? EMPTY_SHOPIFY_CATEGORY_RESOLUTION;
  const localFallbackShopifyProductSetRequest = useMemo(() => {
    if (!isShopifyPayloadPreviewContext) return null;
    if (!mergedDraftSourceFields && !selectedRecord?.fields) return null;

    try {
      const previewFields = buildCombinedPreviewSourceFields(formValues, mergedDraftSourceFields, selectedRecord);
      const draftProduct = buildShopifyDraftProductFromApprovalFields(previewFields);
      return buildShopifyUnifiedProductSetRequest(draftProduct);
    } catch {
      return null;
    }
  }, [formValues, isShopifyPayloadPreviewContext, mergedDraftSourceFields, selectedRecord]);
  const shopifyProductSetRequest = shopifyApprovalPreview?.productSetRequest ?? localFallbackShopifyProductSetRequest;
  const localCombinedEbayGeneratedBodyHtml = useMemo(() => {
    if (!isCombinedApproval) return '';
    if (!selectedEbayTemplateHtml.trim()) return '';

    return buildEbayBodyHtmlFromTemplate(
      selectedEbayTemplateHtml,
      resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, combinedEbayTitleFieldName),
      resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, combinedDescriptionFieldName),
      resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, combinedSharedKeyFeaturesFieldName),
      resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, combinedEbayTestingNotesFieldName),
      resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, combinedMakeFieldName),
      resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, combinedModelFieldName),
      {
        componentType: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Component Type'),
        serialNumber: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Serial Number'),
        condition: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, '__Condition__')
          || resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Condition'),
        originalBox: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Original Box'),
        remote: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Remote'),
        powerCable: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Power Cable'),
        manual: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Manual'),
        voltage: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Voltage'),
        shippingWeight: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Shipping Weight')
          || resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Weight'),
        shippingDimensions: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Shipping Dims'),
        audiogonRating: resolveCombinedPreviewFieldValue(formValues, mergedDraftSourceFields, selectedRecord, 'Audiogon Rating'),
      },
    );
  }, [
    combinedDescriptionFieldName,
    combinedEbayTestingNotesFieldName,
    combinedEbayTitleFieldName,
    combinedMakeFieldName,
    combinedModelFieldName,
    combinedSharedKeyFeaturesFieldName,
    formValues,
    isCombinedApproval,
    mergedDraftSourceFields,
    selectedEbayTemplateHtml,
  ]);
  const combinedEbayGeneratedBodyHtml = localCombinedEbayGeneratedBodyHtml.trim()
    ? localCombinedEbayGeneratedBodyHtml
    : (ebayApprovalPreview?.generatedBodyHtml?.trim() ? ebayApprovalPreview.generatedBodyHtml : '');

  useEffect(() => {
    if (!isCombinedApproval || !combinedEbayBodyHtmlFieldName) return;
    if (!combinedEbayGeneratedBodyHtml.trim()) return;

    const current = formValues[combinedEbayBodyHtmlFieldName] ?? '';
    if (current !== combinedEbayGeneratedBodyHtml) {
      setDerivedFormValue(combinedEbayBodyHtmlFieldName, combinedEbayGeneratedBodyHtml);
    }
  }, [
    combinedEbayBodyHtmlFieldName,
    combinedEbayGeneratedBodyHtml,
    formValues,
    isCombinedApproval,
    setDerivedFormValue,
  ]);

  const ebayDraftPayloadBundle = useMemo(() => {
    if (!isEbayPayloadPreviewContext) return null;
    if (ebayApprovalPreview?.draftPayloadBundle) {
      return ebayApprovalPreview.draftPayloadBundle;
    }

    if (!mergedDraftSourceFields && !selectedRecord?.fields) {
      return null;
    }

    try {
      const previewFields = buildCombinedPreviewSourceFields(formValues, mergedDraftSourceFields, selectedRecord);
      return buildEbayDraftPayloadBundleFromApprovalFields(previewFields);
    } catch {
      return null;
    }
  }, [ebayApprovalPreview, formValues, isEbayPayloadPreviewContext, mergedDraftSourceFields, selectedRecord]);

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