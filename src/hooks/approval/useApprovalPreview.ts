import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeApprovalRecord } from '@/services/app-api/approval';
import type { EbayApprovalPreviewResult } from '@/services/app-api/ebay';
import type { ShopifyApprovalPreviewResult } from '@/services/app-api/shopify';
import type { ApprovalFieldKind } from '@/stores/approval/approvalStoreFieldUtils';
import type { AirtableRecord } from '@/types/airtable';

function toPreviewTextValue(value: unknown): string {
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

function resolveCombinedPreviewValue(
  formValues: Record<string, string>,
  sourceFields: Record<string, unknown> | null | undefined,
  selectedRecord: AirtableRecord | null,
  fieldName: string,
): string {
  if (!fieldName) return '';

  const formValue = formValues[fieldName] ?? '';
  if (formValue.trim()) return formValue;

  const sourceValue = toPreviewTextValue(sourceFields?.[fieldName]).trim();
  if (sourceValue) return sourceValue;

  return toPreviewTextValue(selectedRecord?.fields[fieldName]).trim();
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

interface UseApprovalPreviewParams {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  selectedRecord: AirtableRecord | null;
  fieldKinds: Record<string, ApprovalFieldKind>;
  formValues: Record<string, string>;
  setDerivedFormValue: (fieldName: string, value: string) => void;
  fromFormValue: (value: string, kind: ApprovalFieldKind) => unknown;
  isCombinedApproval: boolean;
  ebayCategoryLabelsById: Record<string, string>;
  selectedEbayTemplateHtml: string;
  combinedEbayTitleFieldName: string;
  combinedDescriptionFieldName: string;
  combinedSharedKeyFeaturesFieldName: string;
  combinedEbayTestingNotesFieldName: string;
  combinedEbayBodyHtmlFieldName: string;
  combinedMakeFieldName: string;
  combinedModelFieldName: string;
  isRemovedCombinedEbayPriceFieldName: (fieldName: string) => boolean;
  isEbayHandlingCostFieldName: (fieldName: string) => boolean;
  isEbayGlobalShippingFieldName: (fieldName: string) => boolean;
}

export function useApprovalPreview({
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
  combinedSharedKeyFeaturesFieldName,
  combinedEbayTestingNotesFieldName,
  combinedEbayBodyHtmlFieldName,
  combinedMakeFieldName,
  combinedModelFieldName,
  isRemovedCombinedEbayPriceFieldName,
  isEbayHandlingCostFieldName,
  isEbayGlobalShippingFieldName,
}: UseApprovalPreviewParams) {
  const [shopifyApprovalPreview, setShopifyApprovalPreview] = useState<ShopifyApprovalPreviewResult | null>(null);
  const [ebayApprovalPreview, setEbayApprovalPreview] = useState<EbayApprovalPreviewResult | null>(null);
  const normalizePreviewRequestRef = useRef(0);
  const lastNormalizeSignatureRef = useRef('');
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
      title: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, combinedEbayTitleFieldName),
      description: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, combinedDescriptionFieldName),
      keyFeatures: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, combinedSharedKeyFeaturesFieldName),
      testingNotes: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, combinedEbayTestingNotesFieldName),
      make: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, combinedMakeFieldName),
      model: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, combinedModelFieldName),
      componentType: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Component Type'),
      serialNumber: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Serial Number'),
      condition: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, '__Condition__')
        || resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Condition'),
      originalBox: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Original Box'),
      remote: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Remote'),
      powerCable: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Power Cable'),
      manual: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Manual'),
      voltage: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Voltage'),
      shippingWeight: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Shipping Weight')
        || resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Weight'),
      shippingDimensions: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Shipping Dims'),
      audiogonRating: resolveCombinedPreviewValue(formValues, mergedDraftSourceFields, selectedRecord, 'Audiogon Rating'),
      fieldName: combinedEbayBodyHtmlFieldName || undefined,
    };
  }, [combinedDescriptionFieldName, combinedEbayBodyHtmlFieldName, combinedEbayTestingNotesFieldName, combinedEbayTitleFieldName, combinedMakeFieldName, combinedModelFieldName, combinedSharedKeyFeaturesFieldName, formValues, isCombinedApproval, mergedDraftSourceFields, selectedEbayTemplateHtml, selectedRecord]);

  const currentEbayCategoryPreviewInput = useMemo(
    () => (isEbayPayloadPreviewContext ? { labelsById: ebayCategoryLabelsById } : undefined),
    [ebayCategoryLabelsById, isEbayPayloadPreviewContext],
  );

  useEffect(() => {
    if (!mergedDraftSourceFields || (!isShopifyPayloadPreviewContext && !isEbayPayloadPreviewContext)) {
      setShopifyApprovalPreview(null);
      setEbayApprovalPreview(null);
      lastNormalizeSignatureRef.current = '';
      return;
    }

    const requestId = normalizePreviewRequestRef.current + 1;
    normalizePreviewRequestRef.current = requestId;
    const target = isShopifyPayloadPreviewContext && isEbayPayloadPreviewContext
      ? 'both'
      : isShopifyPayloadPreviewContext
        ? 'shopify'
        : 'ebay';

    const requestSignature = stableSerialize({
      target,
      fields: mergedDraftSourceFields,
      bodyPreview: isEbayPayloadPreviewContext ? currentEbayPreviewBodyInput : undefined,
      categoryPreview: currentEbayCategoryPreviewInput,
    });

    if (lastNormalizeSignatureRef.current === requestSignature) {
      return;
    }

    lastNormalizeSignatureRef.current = requestSignature;

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
            setDerivedFormValue(fieldName, value);
          }
        });
      })
      .catch(() => {
        if (normalizePreviewRequestRef.current !== requestId) return;
        // Keep the last successful preview visible on transient failures and allow retry.
        lastNormalizeSignatureRef.current = '';
      });
  }, [currentEbayCategoryPreviewInput, currentEbayPreviewBodyInput, isEbayPayloadPreviewContext, isShopifyPayloadPreviewContext, mergedDraftSourceFields, setDerivedFormValue]);

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