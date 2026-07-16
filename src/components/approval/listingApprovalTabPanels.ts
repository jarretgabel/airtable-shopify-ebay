import { createElement, type Dispatch, type SetStateAction } from 'react';
import type {
  EbayApprovalPayloadPreviewData,
  ShopifyApprovalPayloadPreviewData,
} from '@/components/approval/ListingApprovalRecordPayloadPanels';
import type { ListingApprovalSelectedRecordPanelProps } from '@/components/approval/ListingApprovalSelectedRecordPanel';
import type { EbayListingTemplateId } from '@/components/approval/listingApprovalEbayConstants';
import { buildListingApprovalQueuePanelProps } from '@/components/approval/listingApprovalQueuePanelProps';
import { buildListingApprovalSelectedRecordPanelProps } from '@/components/approval/listingApprovalSelectedRecordPanelProps';
import { buildListingApprovalSelectedRecordStatusProps } from '@/components/approval/listingApprovalSelectedRecordStatusProps';
import { buildListingApprovalSelectedRecordViewProps } from '@/components/approval/listingApprovalSelectedRecordViewProps';
import { ListingApprovalSoldReadyPanel } from '@/components/approval/ListingApprovalSoldReadyPanel';
import { ListingApprovalWorkflowOpsPanel } from '@/components/approval/ListingApprovalWorkflowOpsPanel';
import {
  buildListingApprovalWorkflowSummaryData,
  type ListingApprovalWorkflowSummaryData,
} from '@/components/approval/ListingApprovalWorkflowSummary';
import type { InlineNoticeTone } from '@/components/approval/listingApprovalRecordActionTypes';
import { errorSurfaceClass } from '@/components/tabs/uiClasses';
import { checkOptionalEnv } from '@/config/runtimeEnv';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import type { AirtableRecord } from '@/types/airtable';

function getSelectedRecordEyebrowLabel(approvalChannel: 'shopify' | 'ebay' | 'combined'): string {
  switch (approvalChannel) {
    case 'shopify':
      return 'Shopify Listing Editor';
    case 'ebay':
      return 'eBay Listing Editor';
    case 'combined':
    default:
      return 'Combined Listing Editor';
  }
}

function toExternalUrl(baseUrl: string, path: string): string {
  const trimmedBaseUrl = baseUrl.trim();
  if (!trimmedBaseUrl) return '';

  const normalizedBaseUrl = /^https?:\/\//i.test(trimmedBaseUrl)
    ? trimmedBaseUrl
    : `https://${trimmedBaseUrl}`;

  return `${normalizedBaseUrl.replace(/\/$/, '')}${path}`;
}

function getFirstTrimmedValue(source: Record<string, string>, fieldNames: readonly string[]): string {
  for (const fieldName of fieldNames) {
    const rawValue = source[fieldName];
    if (typeof rawValue !== 'string') continue;

    const value = rawValue.trim();
    if (value) return value;
  }

  return '';
}

function resolveShopifyServiceListingUrl(storeDomain: string, formValues: Record<string, string>): string {
  const explicitListingUrl = getFirstTrimmedValue(formValues, [
    'Shopify Product URL',
    'Shopify Storefront URL',
  ]);
  if (explicitListingUrl) {
    return /^https?:\/\//i.test(explicitListingUrl)
      ? explicitListingUrl
      : `https://${explicitListingUrl}`;
  }

  const handle = getFirstTrimmedValue(formValues, [
    'Shopify REST Handle',
    'Shopify Handle',
    'Shopify GraphQL Handle',
    'Handle',
    'handle',
  ]);
  if (!handle) return '';

  return toExternalUrl(storeDomain, `/products/${encodeURIComponent(handle)}`);
}

function isPostPublishMarketplaceStatus(status: string | null): boolean {
  return status === 'Listed, Shopify'
    || status === 'Listed, eBay'
    || status === 'Stale Listing, Shopify'
    || status === 'Stale Listing, eBay'
    || status === 'Sold - Ready to Ship'
    || status === 'Shipped';
}

interface BuildListingApprovalTabPanelsParams {
  selectedRecord: AirtableRecord | null;
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  approvedFieldName: string;
  allFieldNames: string[];
  formRequiredFieldNames: string[];
  formShopifyRequiredFieldNames: string[];
  formEbayRequiredFieldNames: string[];
  formValues: Record<string, string>;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  listingFormatOptions: string[];
  listingDurationOptions: string[];
  saving: boolean;
  setFormValue: (fieldName: string, value: string) => void;
  setDerivedFormValue: (fieldName: string, value: string) => void;
  currentPageShopifyBodyHtml: string;
  currentPageShopifyTagValues: string[];
  currentPageShopifyCollectionIds: string[];
  currentPageShopifyCollectionLabelsById: Record<string, string>;
  onOpenOperationalRecord?: (recordId: string) => void;
  onOpenTestingForm?: (recordId: string) => void;
  onOpenPhotosForm?: (recordId: string) => void;
  combinedDescriptionFieldName: string;
  combinedSharedFieldNames: string[];
  combinedRequiredFieldNames: string[];
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
  combinedSharedKeyFeaturesFieldName: string;
  combinedSharedKeyFeaturesSyncFieldNames: string[];
  combinedEbayTestingNotesFieldName: string;
  drawerSourceFields: Record<string, unknown>;
  sharedDrawerRequiredStatus: { hasRequired: boolean; allFilled: boolean };
  combinedShopifyOnlyFieldNames: string[];
  shopifyDrawerRequiredStatus: { hasRequired: boolean; allFilled: boolean };
  selectedEbayTemplateId: EbayListingTemplateId;
  setSelectedEbayTemplateId: Dispatch<SetStateAction<EbayListingTemplateId>>;
  combinedShopifyBodyHtmlFieldName: string;
  combinedShopifyBodyHtmlValue: string;
  currentPageProductDescriptionResolution: { sourceFieldName: string; sourceType: string };
  currentPageProductDescription: string;
  currentPageProductCategoryResolution: { sourceFieldName: string; sourceType: string };
  currentPageCategoryIdResolution: { sourceFieldName: string; value: string };
  shopifyCategoryLookupValue: string;
  shopifyCategoryResolution: {
    status: string;
    error?: string;
    match?: { fullName?: string; id?: string } | null;
  };
  isShopifyPayloadPreviewContext: boolean;
  shopifyProductSetRequest: ShopifyApprovalPayloadPreviewData['shopifyProductSetRequest'];
  combinedEbayOnlyFieldNames: string[];
  ebayDrawerRequiredStatus: { hasRequired: boolean; allFilled: boolean };
  combinedEbayGeneratedBodyHtml: string;
  ebayCategoryLabelsById: Record<string, string>;
  setEbayCategoryLabelsById: Dispatch<SetStateAction<Record<string, string>>>;
  setBodyHtmlPreview: Dispatch<SetStateAction<string>>;
  combinedEbayBodyHtmlFieldName: string;
  combinedEbayBodyHtmlValue: string;
  bodyHtmlPreview: string;
  isEbayPayloadPreviewContext: boolean;
  ebayDraftPayloadBundle: EbayApprovalPayloadPreviewData['ebayDraftPayloadBundle'];
  titleFieldName: string;
  isApproved: boolean;
  error: string | null;
  onBackToList: () => void;
  backToListLabel?: string;
  approving: boolean;
  pushingTarget: 'shopify' | 'ebay' | 'both' | null;
  hasUnsavedChanges: boolean;
  changedFieldNames: string[];
  hasMissingShopifyRequiredFields: boolean;
  missingShopifyRequiredFieldNames: string[];
  missingShopifyRequiredFieldLabels: string[];
  hasMissingEbayRequiredFields: boolean;
  missingEbayRequiredFieldNames: string[];
  missingEbayRequiredFieldLabels: string[];
  inlineActionNotices: Array<{ id: string; tone: InlineNoticeTone; title: string; message: string }>;
  fadingInlineNoticeIds: string[];
  canUpdateApprovedShopifyListing: boolean;
  hasExistingShopifyRestProductId: boolean;
  pushShopifyDisabled: boolean;
  pushEbayDisabled: boolean;
  pushBothDisabled: boolean;
  isShopifyPublishBlockedByAuctionFormat: boolean;
  onResetData: () => void;
  onSaveUpdates: () => void;
  onPrimaryAction: () => void;
  runCombinedPush: (target: 'shopify' | 'ebay' | 'both') => Promise<void> | void;
  hasTableReference: boolean;
  loading: boolean;
  creatingShopifyListing: boolean;
  tableReference: string;
  tableName?: string;
  records: AirtableRecord[];
  formatFieldName: string;
  hasExistingEbayOfferId: boolean;
  shopifyAdminListingUrl: string | null;
  shopifyServiceListingUrl: string | null;
  ebayAdminListingUrl: string | null;
  ebayServiceListingUrl: string | null;
  priceFieldName: string;
  vendorFieldName: string;
  qtyFieldName: string;
  openRecord: (record: AirtableRecord) => void;
  onSelectRecord: (recordId: string) => void;
  createNewShopifyListing: () => Promise<void>;
  loadRecords: (tableReference: string, tableName?: string, force?: boolean) => Promise<void>;
}

export function buildListingApprovalTabPanels({
  selectedRecord,
  approvalChannel,
  isCombinedApproval,
  approvedFieldName,
  allFieldNames,
  formRequiredFieldNames,
  formShopifyRequiredFieldNames,
  formEbayRequiredFieldNames,
  formValues,
  fieldKinds,
  listingFormatOptions,
  listingDurationOptions,
  saving,
  setFormValue,
  setDerivedFormValue,
  currentPageShopifyBodyHtml,
  currentPageShopifyTagValues,
  currentPageShopifyCollectionIds,
  currentPageShopifyCollectionLabelsById,
  onOpenOperationalRecord,
  onOpenTestingForm,
  onOpenPhotosForm,
  combinedDescriptionFieldName,
  combinedSharedFieldNames,
  combinedRequiredFieldNames,
  shopifyRequiredFieldNames,
  ebayRequiredFieldNames,
  combinedSharedKeyFeaturesFieldName,
  combinedSharedKeyFeaturesSyncFieldNames,
  combinedEbayTestingNotesFieldName,
  drawerSourceFields,
  sharedDrawerRequiredStatus,
  combinedShopifyOnlyFieldNames,
  shopifyDrawerRequiredStatus,
  selectedEbayTemplateId,
  setSelectedEbayTemplateId,
  combinedShopifyBodyHtmlFieldName,
  combinedShopifyBodyHtmlValue,
  currentPageProductDescriptionResolution,
  currentPageProductDescription,
  currentPageProductCategoryResolution,
  currentPageCategoryIdResolution,
  shopifyCategoryLookupValue,
  shopifyCategoryResolution,
  isShopifyPayloadPreviewContext,
  shopifyProductSetRequest,
  combinedEbayOnlyFieldNames,
  ebayDrawerRequiredStatus,
  combinedEbayGeneratedBodyHtml,
  ebayCategoryLabelsById,
  setEbayCategoryLabelsById,
  setBodyHtmlPreview,
  combinedEbayBodyHtmlFieldName,
  combinedEbayBodyHtmlValue,
  bodyHtmlPreview,
  isEbayPayloadPreviewContext,
  ebayDraftPayloadBundle,
  titleFieldName,
  isApproved,
  error,
  onBackToList,
  backToListLabel,
  approving,
  pushingTarget,
  hasUnsavedChanges,
  changedFieldNames,
  hasMissingShopifyRequiredFields,
  missingShopifyRequiredFieldNames,
  missingShopifyRequiredFieldLabels,
  hasMissingEbayRequiredFields,
  missingEbayRequiredFieldNames,
  missingEbayRequiredFieldLabels,
  inlineActionNotices,
  fadingInlineNoticeIds,
  canUpdateApprovedShopifyListing,
  hasExistingShopifyRestProductId,
  pushShopifyDisabled,
  pushEbayDisabled,
  pushBothDisabled,
  isShopifyPublishBlockedByAuctionFormat,
  onResetData,
  onSaveUpdates,
  onPrimaryAction,
  runCombinedPush,
  hasTableReference,
  loading,
  creatingShopifyListing,
  tableReference,
  tableName,
  records,
  formatFieldName,
  hasExistingEbayOfferId,
  shopifyAdminListingUrl,
  shopifyServiceListingUrl,
  ebayAdminListingUrl,
  ebayServiceListingUrl,
  priceFieldName,
  vendorFieldName,
  qtyFieldName,
  openRecord,
  onSelectRecord,
  createNewShopifyListing,
  loadRecords,
}: BuildListingApprovalTabPanelsParams): {
  selectedRecordPanelProps: ListingApprovalSelectedRecordPanelProps | null;
  queuePanelProps: ReturnType<typeof buildListingApprovalQueuePanelProps>;
} {
  const resolvedShopifyStoreDomain = checkOptionalEnv('VITE_SHOPIFY_STORE_DOMAIN');
  const shopifyProductId = getFirstTrimmedValue(formValues, ['Shopify REST Product ID', 'Shopify Product ID']);
  const ebayOfferId = getFirstTrimmedValue(formValues, ['eBay Offer ID']);
  const ebayListingId = getFirstTrimmedValue(formValues, ['eBay Listing ID', 'eBay Item ID', 'Listing ID', 'Item ID']);

  const derivedShopifyAdminListingUrl = shopifyProductId
    ? toExternalUrl(resolvedShopifyStoreDomain, `/admin/products/${encodeURIComponent(shopifyProductId)}`)
    : '';
  const derivedShopifyServiceListingUrl = resolveShopifyServiceListingUrl(resolvedShopifyStoreDomain, formValues);
  const derivedEbayAdminListingUrl = ebayOfferId
    ? `https://www.ebay.com/sh/lst/active?offerId=${encodeURIComponent(ebayOfferId)}`
    : '';
  const derivedEbayServiceListingUrl = ebayListingId
    ? `https://www.ebay.com/itm/${encodeURIComponent(ebayListingId)}`
    : '';

  const workflowStatus = selectedRecord && typeof selectedRecord.fields['Workflow Status'] === 'string'
    ? selectedRecord.fields['Workflow Status'].trim()
    : null;
  const allowMarketplaceListingLinks = !isCombinedApproval || isPostPublishMarketplaceStatus(workflowStatus);

  const resolvedShopifyAdminListingUrl = allowMarketplaceListingLinks
    ? (shopifyAdminListingUrl ?? (derivedShopifyAdminListingUrl || null))
    : null;
  const resolvedShopifyServiceListingUrl = allowMarketplaceListingLinks
    ? (shopifyServiceListingUrl ?? (derivedShopifyServiceListingUrl || null))
    : null;
  const resolvedEbayAdminListingUrl = allowMarketplaceListingLinks
    ? (ebayAdminListingUrl ?? (derivedEbayAdminListingUrl || null))
    : null;
  const resolvedEbayServiceListingUrl = allowMarketplaceListingLinks
    ? (ebayServiceListingUrl ?? (derivedEbayServiceListingUrl || null))
    : null;

  const workflowSummary: ListingApprovalWorkflowSummaryData | null = selectedRecord && isCombinedApproval
    ? buildListingApprovalWorkflowSummaryData(selectedRecord)
    : null;

  const selectedRecordViewProps = selectedRecord
    ? buildListingApprovalSelectedRecordViewProps({
      selectedRecord,
      approvalChannel,
      isCombinedApproval,
      approvedFieldName,
      titleFieldName,
      allFieldNames,
      formRequiredFieldNames,
      formShopifyRequiredFieldNames,
      formEbayRequiredFieldNames,
      formValues,
      fieldKinds,
      listingFormatOptions,
      listingDurationOptions,
      saving,
      setFormValue,
      setDerivedFormValue,
      currentPageShopifyBodyHtml,
      currentPageShopifyTagValues,
      currentPageShopifyCollectionIds,
      currentPageShopifyCollectionLabelsById,
      onOpenOperationalRecord,
      onOpenTestingForm,
      onOpenPhotosForm,
      combinedDescriptionFieldName,
      combinedSharedFieldNames,
      combinedRequiredFieldNames,
      shopifyRequiredFieldNames,
      ebayRequiredFieldNames,
      combinedSharedKeyFeaturesFieldName,
      combinedSharedKeyFeaturesSyncFieldNames,
      combinedEbayTestingNotesFieldName,
      drawerSourceFields,
      sharedDrawerRequiredStatus,
      combinedShopifyOnlyFieldNames,
      shopifyDrawerRequiredStatus,
      selectedEbayTemplateId,
      setSelectedEbayTemplateId,
      combinedShopifyBodyHtmlFieldName,
      combinedShopifyBodyHtmlValue,
      currentPageProductDescriptionResolution,
      currentPageProductDescription,
      currentPageProductCategoryResolution,
      currentPageCategoryIdResolution,
      shopifyCategoryLookupValue,
      shopifyCategoryResolution,
      isShopifyPayloadPreviewContext,
      shopifyProductSetRequest,
      combinedEbayOnlyFieldNames,
      ebayDrawerRequiredStatus,
      combinedEbayGeneratedBodyHtml,
      ebayCategoryLabelsById,
      setEbayCategoryLabelsById,
      setBodyHtmlPreview,
      combinedEbayBodyHtmlFieldName,
      combinedEbayBodyHtmlValue,
      bodyHtmlPreview,
      isEbayPayloadPreviewContext,
      ebayDraftPayloadBundle,
    })
    : null;

  const selectedRecordStatusProps = selectedRecord
    ? buildListingApprovalSelectedRecordStatusProps({
      approvalChannel,
      isCombinedApproval,
      workflowStatus: workflowSummary?.workflowStatus ?? null,
      workflowReadinessMissingRequirements: selectedRecord && workflowSummary && isCombinedApproval
        ? getUsedGearWorkflowListingReadiness(selectedRecord).missingRequirements
        : [],
      saving,
      approving,
      pushingTarget,
      hasUnsavedChanges,
      changedFieldNames,
      hasMissingShopifyRequiredFields,
      missingShopifyRequiredFieldNames,
      missingShopifyRequiredFieldLabels,
      hasMissingEbayRequiredFields,
      missingEbayRequiredFieldNames,
      missingEbayRequiredFieldLabels,
      inlineActionNotices,
      fadingInlineNoticeIds,
      canUpdateApprovedShopifyListing,
      isApproved,
      hasExistingEbayOfferId,
      hasExistingShopifyRestProductId,
      pushShopifyDisabled,
      pushEbayDisabled,
      pushBothDisabled,
      isShopifyPublishBlockedByAuctionFormat,
      shopifyAdminListingUrl: resolvedShopifyAdminListingUrl,
      shopifyServiceListingUrl: resolvedShopifyServiceListingUrl,
      ebayAdminListingUrl: resolvedEbayAdminListingUrl,
      ebayServiceListingUrl: resolvedEbayServiceListingUrl,
      onResetData,
      onSaveUpdates,
      onPrimaryAction,
      runCombinedPush,
    })
    : null;

  const workflowDetails = selectedRecord && isCombinedApproval && workflowSummary && hasTableReference
    ? workflowSummary.workflowStatus === 'Sold - Ready to Ship' || workflowSummary.workflowStatus === 'Shipped'
      ? createElement(ListingApprovalSoldReadyPanel, {
        selectedRecord,
        tableReference,
        tableName,
        loadRecords,
      })
      : createElement(ListingApprovalWorkflowOpsPanel, {
        selectedRecord,
        tableReference,
        tableName,
        loadRecords,
        onMovedBackToReady: () => {
          setDerivedFormValue('Workflow Status', 'Approved for Publish');
          setDerivedFormValue('Shopify REST Product ID', '');
          setDerivedFormValue('Shopify Product ID', '');
          setDerivedFormValue('Shopify REST Published At', '');
          setDerivedFormValue('Shopify REST Published Scope', '');
          setDerivedFormValue('eBay Offer ID', '');
          setDerivedFormValue('eBay Listing ID', '');
          setDerivedFormValue('eBay Item ID', '');
          setDerivedFormValue('Listing ID', '');
          setDerivedFormValue('Item ID', '');
          setDerivedFormValue('eBay Published At', '');
        },
      })
    : null;

  return {
    selectedRecordPanelProps: buildListingApprovalSelectedRecordPanelProps({
      selectedRecord,
      titleFieldName,
      eyebrowLabel: getSelectedRecordEyebrowLabel(approvalChannel),
      isApproved,
      saving,
      error,
      onBackToList,
      backToListLabel,
      errorSurfaceClass,
      isCombinedApproval,
      workflowSummary,
      workflowDetails,
      selectedRecordViewProps,
      selectedRecordStatusProps,
    }),
    queuePanelProps: buildListingApprovalQueuePanelProps({
      hasTableReference,
      error,
      loading,
      approvalChannel,
      creatingShopifyListing,
      saving,
      tableReference,
      tableName,
      records,
      approvedFieldName,
      shopifyRequiredFieldNames,
      ebayRequiredFieldNames,
      combinedRequiredFieldNames,
      titleFieldName,
      formatFieldName,
      priceFieldName,
      vendorFieldName,
      qtyFieldName,
      openRecord,
      onSelectRecord,
      createNewShopifyListing,
      loadRecords,
    }),
  };
}