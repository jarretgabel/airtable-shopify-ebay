import { useMemo } from 'react';
import {
  isEbayBodyHtmlFieldName,
  isEbayBodyHtmlSyncTriggerFieldName,
  isShopifyGraphqlCollectionIdsFieldName,
  isVendorFieldName,
  toApprovalFieldLabel,
} from '@/components/approval/listingApprovalFieldHelpers';
import { getDrawerRequiredStatus } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import { resolveApprovalPublishSource } from '@/components/approval/listingApprovalShopifyActions';
import { getMissingRequiredFieldNames } from '@/components/approval/requiredFieldStatus';
import { useListingApprovalPublishFieldState } from '@/components/approval/useListingApprovalPublishFieldState';
import {
  CONDITION_FIELD,
  SHIPPING_SERVICE_FIELD,
  toFormValue,
} from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

interface UseListingApprovalPublishStateParams {
  allFieldNames: string[];
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  formValues: Record<string, string>;
  mergedDraftSourceFields: Record<string, unknown> | null | undefined;
  selectedRecord: AirtableRecord | null;
  combinedSharedFieldNames: string[];
  combinedShopifyOnlyFieldNames: string[];
  combinedEbayOnlyFieldNames: string[];
  tableReference: string;
  tableName?: string;
}

export function useListingApprovalPublishState({
  allFieldNames,
  approvalChannel,
  formValues,
  mergedDraftSourceFields,
  selectedRecord,
  combinedSharedFieldNames,
  combinedShopifyOnlyFieldNames,
  combinedEbayOnlyFieldNames,
  tableReference,
  tableName,
}: UseListingApprovalPublishStateParams) {
  const {
    approvedFieldName,
    combinedRequiredFieldNames,
    ebayBodyHtmlSaveFieldName,
    ebayRequiredFieldNames,
    formatFieldName,
    priceFieldName,
    qtyFieldName,
    shopifyRequiredFieldNames,
    titleFieldName,
    vendorFieldName,
  } = useListingApprovalPublishFieldState({
    allFieldNames,
    approvalChannel,
    selectedRecord,
  });

  const missingShopifyRequiredFieldNames = useMemo(() => {
    if ((approvalChannel !== 'shopify' && approvalChannel !== 'combined') || !selectedRecord) return [] as string[];

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    return getMissingRequiredFieldNames(source, shopifyRequiredFieldNames);
  }, [approvalChannel, mergedDraftSourceFields, selectedRecord, shopifyRequiredFieldNames]);

  const missingShopifyRequiredFieldLabels = useMemo(
    () => missingShopifyRequiredFieldNames.map((fieldName) => toApprovalFieldLabel(fieldName)),
    [missingShopifyRequiredFieldNames],
  );

  const hasMissingShopifyRequiredFields = missingShopifyRequiredFieldNames.length > 0;

  const missingEbayRequiredFieldNames = useMemo(() => {
    if ((approvalChannel !== 'ebay' && approvalChannel !== 'combined') || !selectedRecord) return [] as string[];

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    return getMissingRequiredFieldNames(source, ebayRequiredFieldNames);
  }, [approvalChannel, mergedDraftSourceFields, selectedRecord, ebayRequiredFieldNames]);

  const currentEbayListingFormat = useMemo(() => {
    if ((approvalChannel !== 'ebay' && approvalChannel !== 'combined') || !selectedRecord) return '';

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    const rawValue = source[formatFieldName];
    return rawValue === null || rawValue === undefined ? '' : String(rawValue);
  }, [approvalChannel, formatFieldName, mergedDraftSourceFields, selectedRecord]);

  const missingEbayRequiredFieldLabels = useMemo(
    () => missingEbayRequiredFieldNames.map((fieldName) => toApprovalFieldLabel(fieldName, { ebayListingFormat: currentEbayListingFormat })),
    [currentEbayListingFormat, missingEbayRequiredFieldNames],
  );

  const hasMissingEbayRequiredFields = missingEbayRequiredFieldNames.length > 0;

  const drawerSourceFields = useMemo(
    () => mergedDraftSourceFields ?? selectedRecord?.fields ?? {},
    [mergedDraftSourceFields, selectedRecord],
  );

  const sharedDrawerRequiredStatus = useMemo(
    () => getDrawerRequiredStatus(combinedSharedFieldNames, combinedRequiredFieldNames, drawerSourceFields),
    [combinedRequiredFieldNames, combinedSharedFieldNames, drawerSourceFields],
  );

  const shopifyDrawerRequiredStatus = useMemo(
    () => getDrawerRequiredStatus(combinedShopifyOnlyFieldNames, shopifyRequiredFieldNames, drawerSourceFields),
    [combinedShopifyOnlyFieldNames, drawerSourceFields, shopifyRequiredFieldNames],
  );

  const ebayDrawerRequiredStatus = useMemo(
    () => getDrawerRequiredStatus(combinedEbayOnlyFieldNames, ebayRequiredFieldNames, drawerSourceFields),
    [combinedEbayOnlyFieldNames, drawerSourceFields, ebayRequiredFieldNames],
  );

  const formRequiredFieldNames = approvalChannel === 'shopify'
    ? shopifyRequiredFieldNames
    : approvalChannel === 'ebay'
      ? ebayRequiredFieldNames
      : combinedRequiredFieldNames;
  const formShopifyRequiredFieldNames = approvalChannel === 'ebay' ? [] : shopifyRequiredFieldNames;
  const formEbayRequiredFieldNames = approvalChannel === 'shopify' ? [] : ebayRequiredFieldNames;

  const approvedValue = selectedRecord?.fields[approvedFieldName];
  const isApproved = approvedValue === true
    || String(approvedValue ?? '').toLowerCase() === 'true'
    || String(approvedValue ?? '').toLowerCase() === 'yes';

  const changedFieldNames = useMemo(() => {
    if (!selectedRecord) return [] as string[];

    return Object.entries(formValues)
      .filter(([fieldName, currentValue]) => {
        if (fieldName === SHIPPING_SERVICE_FIELD) return false;
        if (fieldName === CONDITION_FIELD) return false;
        if (approvalChannel === 'ebay' && isEbayBodyHtmlFieldName(fieldName)) return false;

        const normalizedFieldName = fieldName.trim().toLowerCase();
        if (normalizedFieldName === 'primary category name' || normalizedFieldName === 'secondary category name') return false;
        if (normalizedFieldName === 'shopify rest product id' || normalizedFieldName === 'shopify product id') return false;
        if (approvalChannel === 'shopify' && isVendorFieldName(fieldName)) return false;
        if (approvalChannel === 'shopify' && isShopifyGraphqlCollectionIdsFieldName(fieldName)) return false;

        const originalValue = toFormValue(selectedRecord.fields[fieldName]);
        return currentValue !== originalValue;
      })
      .map(([fieldName]) => fieldName);
  }, [approvalChannel, formValues, selectedRecord]);

  const shouldForceEbayBodyHtmlSave = useMemo(
    () => approvalChannel === 'ebay' && changedFieldNames.some((fieldName) => isEbayBodyHtmlSyncTriggerFieldName(fieldName)),
    [approvalChannel, changedFieldNames],
  );

  const hasUnsavedChanges = changedFieldNames.length > 0;

  const hasExistingShopifyRestProductId = useMemo(() => {
    if (approvalChannel !== 'shopify') return false;

    const rawExistingProductId = formValues['Shopify REST Product ID']?.trim() ?? '';
    if (!rawExistingProductId) return false;

    const parsedExistingProductId = Number(rawExistingProductId);
    return Number.isFinite(parsedExistingProductId) && parsedExistingProductId > 0;
  }, [approvalChannel, formValues]);

  const canUpdateApprovedShopifyListing = approvalChannel === 'shopify'
    && isApproved
    && hasExistingShopifyRestProductId;

  const pushShopifyDisabled = (approvalChannel !== 'combined' && approvalChannel !== 'shopify') || hasMissingShopifyRequiredFields;
  const pushEbayDisabled = (approvalChannel !== 'combined' && approvalChannel !== 'ebay') || hasMissingEbayRequiredFields;
  const pushBothDisabled = approvalChannel !== 'combined' || hasMissingShopifyRequiredFields || hasMissingEbayRequiredFields;

  const approvalPublishSource = useMemo(
    () => resolveApprovalPublishSource(approvalChannel, tableReference, tableName),
    [approvalChannel, tableName, tableReference],
  );

  return {
    approvedFieldName,
    approvalPublishSource,
    canUpdateApprovedShopifyListing,
    changedFieldNames,
    combinedRequiredFieldNames,
    drawerSourceFields,
    ebayBodyHtmlSaveFieldName,
    ebayDrawerRequiredStatus,
    ebayRequiredFieldNames,
    formEbayRequiredFieldNames,
    formRequiredFieldNames,
    formShopifyRequiredFieldNames,
    formatFieldName,
    hasExistingShopifyRestProductId,
    hasMissingEbayRequiredFields,
    hasMissingShopifyRequiredFields,
    hasUnsavedChanges,
    isApproved,
    missingEbayRequiredFieldLabels,
    missingEbayRequiredFieldNames,
    missingShopifyRequiredFieldLabels,
    missingShopifyRequiredFieldNames,
    priceFieldName,
    pushBothDisabled,
    pushEbayDisabled,
    pushShopifyDisabled,
    qtyFieldName,
    sharedDrawerRequiredStatus,
    shopifyDrawerRequiredStatus,
    shopifyRequiredFieldNames,
    shouldForceEbayBodyHtmlSave,
    titleFieldName,
    vendorFieldName,
  };
}