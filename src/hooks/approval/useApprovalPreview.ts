import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeApprovalRecord } from '@/services/app-api/approval';
import type { EbayApprovalPreviewResult } from '@/services/app-api/ebay';
import type { ShopifyApprovalPreviewResult } from '@/services/app-api/shopify';
import type { ApprovalFieldKind } from '@/stores/approval/approvalStoreFieldUtils';
import type { AirtableRecord } from '@/types/airtable';

interface UseApprovalPreviewParams {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  selectedRecord: AirtableRecord | null;
  fieldKinds: Record<string, ApprovalFieldKind>;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  fromFormValue: (value: string, kind: ApprovalFieldKind) => unknown;
  isCombinedApproval: boolean;
  ebayCategoryLabelsById: Record<string, string>;
  selectedEbayTemplateHtml: string;
  combinedEbayTitleFieldName: string;
  combinedDescriptionFieldName: string;
  combinedSharedKeyFeaturesFieldName: string;
  combinedEbayTestingNotesFieldName: string;
  combinedEbayBodyHtmlFieldName: string;
  isRemovedCombinedEbayPriceFieldName: (fieldName: string) => boolean;
  isEbayHandlingCostFieldName: (fieldName: string) => boolean;
  isEbayGlobalShippingFieldName: (fieldName: string) => boolean;
}

export function useApprovalPreview({
  approvalChannel,
  selectedRecord,
  fieldKinds,
  formValues,
  setFormValue,
  fromFormValue,
  isCombinedApproval,
  ebayCategoryLabelsById,
  selectedEbayTemplateHtml,
  combinedEbayTitleFieldName,
  combinedDescriptionFieldName,
  combinedSharedKeyFeaturesFieldName,
  combinedEbayTestingNotesFieldName,
  combinedEbayBodyHtmlFieldName,
  isRemovedCombinedEbayPriceFieldName,
  isEbayHandlingCostFieldName,
  isEbayGlobalShippingFieldName,
}: UseApprovalPreviewParams) {
  const [shopifyApprovalPreview, setShopifyApprovalPreview] = useState<ShopifyApprovalPreviewResult | null>(null);
  const [ebayApprovalPreview, setEbayApprovalPreview] = useState<EbayApprovalPreviewResult | null>(null);
  const normalizePreviewRequestRef = useRef(0);
  const latestFormValuesRef = useRef(formValues);

  useEffect(() => {
    latestFormValuesRef.current = formValues;
  }, [formValues]);

  const mergedDraftSourceFields = useMemo(() => {
    if (!selectedRecord) return null;

    const merged: Record<string, unknown> = {
      ...selectedRecord.fields,
    };

    Object.entries(formValues).forEach(([fieldName, rawValue]) => {
      const kind = fieldKinds[fieldName] ?? 'text';
      merged[fieldName] = fromFormValue(rawValue, kind);
    });

    Object.keys(merged).forEach((fieldName) => {
      if (isCombinedApproval && isRemovedCombinedEbayPriceFieldName(fieldName)) {
        delete merged[fieldName];
        return;
      }
      if (isEbayHandlingCostFieldName(fieldName)) {
        merged[fieldName] = 0;
      }
      if (isEbayGlobalShippingFieldName(fieldName)) {
        merged[fieldName] = true;
      }
    });

    return merged;
  }, [fieldKinds, formValues, fromFormValue, isCombinedApproval, isEbayGlobalShippingFieldName, isEbayHandlingCostFieldName, isRemovedCombinedEbayPriceFieldName, selectedRecord]);

  const isShopifyPayloadPreviewContext = approvalChannel === 'shopify' || approvalChannel === 'combined';
  const isEbayPayloadPreviewContext = approvalChannel === 'ebay' || approvalChannel === 'combined';

  const currentEbayPreviewBodyInput = useMemo(() => {
    if (!isCombinedApproval) return undefined;

    return {
      templateHtml: selectedEbayTemplateHtml,
      title: combinedEbayTitleFieldName ? (formValues[combinedEbayTitleFieldName] ?? '') : '',
      description: combinedDescriptionFieldName ? (formValues[combinedDescriptionFieldName] ?? '') : '',
      keyFeatures: combinedSharedKeyFeaturesFieldName ? (formValues[combinedSharedKeyFeaturesFieldName] ?? '') : '',
      testingNotes: combinedEbayTestingNotesFieldName ? (formValues[combinedEbayTestingNotesFieldName] ?? '') : '',
      fieldName: combinedEbayBodyHtmlFieldName || undefined,
    };
  }, [combinedDescriptionFieldName, combinedEbayBodyHtmlFieldName, combinedEbayTestingNotesFieldName, combinedEbayTitleFieldName, combinedSharedKeyFeaturesFieldName, formValues, isCombinedApproval, selectedEbayTemplateHtml]);

  const currentEbayCategoryPreviewInput = useMemo(
    () => (isEbayPayloadPreviewContext ? { labelsById: ebayCategoryLabelsById } : undefined),
    [ebayCategoryLabelsById, isEbayPayloadPreviewContext],
  );

  useEffect(() => {
    if (!mergedDraftSourceFields || (!isShopifyPayloadPreviewContext && !isEbayPayloadPreviewContext)) {
      setShopifyApprovalPreview(null);
      setEbayApprovalPreview(null);
      return;
    }

    const requestId = normalizePreviewRequestRef.current + 1;
    normalizePreviewRequestRef.current = requestId;
    const target = isShopifyPayloadPreviewContext && isEbayPayloadPreviewContext
      ? 'both'
      : isShopifyPayloadPreviewContext
        ? 'shopify'
        : 'ebay';

    void normalizeApprovalRecord(mergedDraftSourceFields, target, {
      bodyPreview: isEbayPayloadPreviewContext ? currentEbayPreviewBodyInput : undefined,
      categoryPreview: currentEbayCategoryPreviewInput,
    })
      .then((preview) => {
        if (normalizePreviewRequestRef.current !== requestId) return;
        setShopifyApprovalPreview(preview.shopify ?? null);
        setEbayApprovalPreview(preview.ebay ?? null);
        Object.entries(preview.ebay?.categoryFieldUpdates ?? {}).forEach(([fieldName, value]) => {
          if ((latestFormValuesRef.current[fieldName] ?? '') !== value) {
            setFormValue(fieldName, value);
          }
        });
      })
      .catch(() => {
        if (normalizePreviewRequestRef.current !== requestId) return;
        setShopifyApprovalPreview(null);
        setEbayApprovalPreview(null);
      });
  }, [currentEbayCategoryPreviewInput, currentEbayPreviewBodyInput, isEbayPayloadPreviewContext, isShopifyPayloadPreviewContext, mergedDraftSourceFields, setFormValue]);

  const loadShopifyApprovalPreviewNow = async (fallbackFields: Record<string, unknown>) => {
    const preview = await normalizeApprovalRecord(mergedDraftSourceFields ?? fallbackFields, 'shopify');
    setShopifyApprovalPreview(preview.shopify ?? null);
    if (!preview.shopify) {
      throw new Error('Shopify approval preview is unavailable.');
    }
    return preview.shopify;
  };

  return {
    ebayApprovalPreview,
    isEbayPayloadPreviewContext,
    isShopifyPayloadPreviewContext,
    loadShopifyApprovalPreviewNow,
    mergedDraftSourceFields,
    shopifyApprovalPreview,
  };
}