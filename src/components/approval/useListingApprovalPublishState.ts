import { useMemo } from 'react';
import {
  EBAY_FORMAT_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_QTY_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
  EBAY_VENDOR_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalEbayConstants';
import {
  findEbayBodyHtmlFieldName,
  findEbayPriceFieldName,
  isEbayBodyHtmlFieldName,
  isEbayBodyHtmlSyncTriggerFieldName,
  isShopifyGraphqlCollectionIdsFieldName,
  isVendorFieldName,
  toApprovalFieldLabel,
} from '@/components/approval/listingApprovalFieldHelpers';
import { getDrawerRequiredStatus } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import {
  SHOPIFY_PRICE_FIELD_CANDIDATES,
  SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES,
  SHOPIFY_TITLE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalShopifyConstants';
import { resolveApprovalPublishSource } from '@/components/approval/listingApprovalShopifyActions';
import { getMissingRequiredFieldNames } from '@/components/approval/requiredFieldStatus';
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
  const approvedFieldName = useMemo(() => {
    const candidateNames = approvalChannel === 'shopify'
      ? ['Shopify Approved', 'Approved']
      : approvalChannel === 'ebay'
        ? ['Approved', 'eBay Approved', 'Shopify Approved']
        : ['Approved', 'Shopify Approved', 'eBay Approved'];

    const candidateSet = new Set(candidateNames.map((name) => name.toLowerCase()));
    const match = allFieldNames.find((fieldName) => candidateSet.has(fieldName.toLowerCase()));
    return match ?? candidateNames[0];
  }, [allFieldNames, approvalChannel]);

  const resolveFieldName = useMemo(
    () => (candidates: string[], fallback: string) => {
      const candidateSet = new Set(candidates.map((name) => name.toLowerCase()));
      const exact = allFieldNames.find((fieldName) => candidateSet.has(fieldName.toLowerCase()));
      return exact ?? fallback;
    },
    [allFieldNames],
  );

  const titleFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Item Title', 'Shopify Title', 'Shopify REST Title', 'Title', 'Name'], 'Item Title')
      : resolveFieldName([...EBAY_TITLE_FIELD_CANDIDATES], 'Item Title'),
    [approvalChannel, resolveFieldName],
  );

  const formatFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Listing Format', 'Status', 'Shopify Status', 'Shopify REST Status'], 'Listing Format')
      : resolveFieldName([...EBAY_FORMAT_FIELD_CANDIDATES], 'Listing Format'),
    [approvalChannel, resolveFieldName],
  );

  const priceFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'Price'], '')
      : findEbayPriceFieldName(Object.keys(selectedRecord?.fields ?? {})),
    [approvalChannel, resolveFieldName, selectedRecord],
  );

  const ebayBodyHtmlSaveFieldName = useMemo(
    () => approvalChannel === 'ebay'
      ? findEbayBodyHtmlFieldName(Object.keys(selectedRecord?.fields ?? {}))
      : '',
    [approvalChannel, selectedRecord],
  );

  const vendorFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Vendor', 'Shopify Vendor', 'Vendor', 'Manufacturer', 'Brand'], '')
      : resolveFieldName([...EBAY_VENDOR_FIELD_CANDIDATES], ''),
    [approvalChannel, resolveFieldName],
  );

  const qtyFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Variant 1 Inventory Quantity', 'Shopify Variant 1 Inventory Quantity', 'Quantity', 'Qty'], '')
      : resolveFieldName([...EBAY_QTY_FIELD_CANDIDATES], ''),
    [approvalChannel, resolveFieldName],
  );

  const shopifyRequiredFieldNames = useMemo(() => {
    const required = [
      resolveFieldName([...SHOPIFY_TITLE_FIELD_CANDIDATES], ''),
      resolveFieldName([...SHOPIFY_PRICE_FIELD_CANDIDATES], ''),
      resolveFieldName([...SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES], ''),
    ].filter((fieldName): fieldName is string => fieldName.trim().length > 0);

    return Array.from(new Set(required));
  }, [resolveFieldName]);

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

  const ebayRequiredFieldNames = useMemo(() => {
    const required = [
      resolveFieldName([...EBAY_TITLE_FIELD_CANDIDATES], ''),
      resolveFieldName([...EBAY_PRICE_FIELD_CANDIDATES], ''),
    ].filter((fieldName): fieldName is string => fieldName.trim().length > 0);

    return Array.from(new Set(required));
  }, [resolveFieldName]);

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

  const combinedRequiredFieldNames = useMemo(
    () => Array.from(new Set([...shopifyRequiredFieldNames, ...ebayRequiredFieldNames])),
    [ebayRequiredFieldNames, shopifyRequiredFieldNames],
  );

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