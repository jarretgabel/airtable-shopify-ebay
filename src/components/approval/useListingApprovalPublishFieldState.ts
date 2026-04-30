import { useMemo } from 'react';
import {
  EBAY_FORMAT_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_QTY_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
  EBAY_VENDOR_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalEbayConstants';
import { findEbayBodyHtmlFieldName, findEbayPriceFieldName } from '@/components/approval/listingApprovalFieldHelpers';
import {
  SHOPIFY_PRICE_FIELD_CANDIDATES,
  SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES,
  SHOPIFY_TITLE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalShopifyConstants';
import type { AirtableRecord } from '@/types/airtable';

interface UseListingApprovalPublishFieldStateParams {
  allFieldNames: string[];
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  selectedRecord: AirtableRecord | null;
}

export function useListingApprovalPublishFieldState({
  allFieldNames,
  approvalChannel,
  selectedRecord,
}: UseListingApprovalPublishFieldStateParams) {
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

  const ebayRequiredFieldNames = useMemo(() => {
    const required = [
      resolveFieldName([...EBAY_TITLE_FIELD_CANDIDATES], ''),
      resolveFieldName([...EBAY_PRICE_FIELD_CANDIDATES], ''),
    ].filter((fieldName): fieldName is string => fieldName.trim().length > 0);

    return Array.from(new Set(required));
  }, [resolveFieldName]);

  const combinedRequiredFieldNames = useMemo(
    () => Array.from(new Set([...shopifyRequiredFieldNames, ...ebayRequiredFieldNames])),
    [ebayRequiredFieldNames, shopifyRequiredFieldNames],
  );

  return {
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
  };
}