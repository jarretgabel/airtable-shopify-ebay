import type { Dispatch, SetStateAction } from 'react';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import type { ListingApprovalSelectedRecordPanelProps } from '@/components/approval/ListingApprovalSelectedRecordPanel';
import type { EbayListingTemplateId } from '@/components/approval/listingApprovalEbayConstants';
import { buildListingApprovalQueuePanelProps } from '@/components/approval/listingApprovalQueuePanelProps';
import { buildListingApprovalSelectedRecordPanelProps } from '@/components/approval/listingApprovalSelectedRecordPanelProps';
import { buildListingApprovalSelectedRecordStatusProps } from '@/components/approval/listingApprovalSelectedRecordStatusProps';
import { buildListingApprovalSelectedRecordViewProps } from '@/components/approval/listingApprovalSelectedRecordViewProps';
import type { InlineNoticeTone } from '@/components/approval/listingApprovalRecordActionTypes';
import { errorSurfaceClass } from '@/components/tabs/uiClasses';
import type { AirtableRecord } from '@/types/airtable';

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
  currentPageShopifyBodyHtml: string;
  currentPageShopifyTagValues: string[];
  currentPageShopifyCollectionIds: string[];
  currentPageShopifyCollectionLabelsById: Record<string, string>;
  combinedDescriptionFieldName: string;
  combinedSharedFieldNames: string[];
  combinedRequiredFieldNames: string[];
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
  combinedSharedKeyFeaturesFieldName: string;
  combinedSharedKeyFeaturesSyncFieldNames: string[];
  combinedEbayTestingNotesFieldName: string;
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
  shopifyPayloadDebug: { collectionsToJoin: string[]; tags: string[] };
  shopifyDraftCreatePayloadJson: string;
  shopifyCategorySyncPreviewJson: string;
  shopifyCreatePayloadDocsJson: string;
  combinedEbayOnlyFieldNames: string[];
  ebayDrawerRequiredStatus: { hasRequired: boolean; allFilled: boolean };
  combinedEbayGeneratedBodyHtml: string;
  ebayCategoryLabelsById: Record<string, string>;
  setEbayCategoryLabelsById: Dispatch<SetStateAction<Record<string, string>>>;
  setBodyHtmlPreview: Dispatch<SetStateAction<string>>;
  combinedEbayBodyHtmlFieldName: string;
  combinedEbayBodyHtmlValue: string;
  bodyHtmlPreview: string;
  ebayDraftPayloadBundleJson: string;
  ebayPayloadDocsJson: string;
  titleFieldName: string;
  isApproved: boolean;
  error: string | null;
  onBackToList: () => void;
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
  currentPageShopifyBodyHtml,
  currentPageShopifyTagValues,
  currentPageShopifyCollectionIds,
  currentPageShopifyCollectionLabelsById,
  combinedDescriptionFieldName,
  combinedSharedFieldNames,
  combinedRequiredFieldNames,
  shopifyRequiredFieldNames,
  ebayRequiredFieldNames,
  combinedSharedKeyFeaturesFieldName,
  combinedSharedKeyFeaturesSyncFieldNames,
  combinedEbayTestingNotesFieldName,
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
  shopifyPayloadDebug,
  shopifyDraftCreatePayloadJson,
  shopifyCategorySyncPreviewJson,
  shopifyCreatePayloadDocsJson,
  combinedEbayOnlyFieldNames,
  ebayDrawerRequiredStatus,
  combinedEbayGeneratedBodyHtml,
  ebayCategoryLabelsById,
  setEbayCategoryLabelsById,
  setBodyHtmlPreview,
  combinedEbayBodyHtmlFieldName,
  combinedEbayBodyHtmlValue,
  bodyHtmlPreview,
  ebayDraftPayloadBundleJson,
  ebayPayloadDocsJson,
  titleFieldName,
  isApproved,
  error,
  onBackToList,
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
  const selectedRecordViewProps = selectedRecord
    ? buildListingApprovalSelectedRecordViewProps({
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
      currentPageShopifyBodyHtml,
      currentPageShopifyTagValues,
      currentPageShopifyCollectionIds,
      currentPageShopifyCollectionLabelsById,
      combinedDescriptionFieldName,
      combinedSharedFieldNames,
      combinedRequiredFieldNames,
      shopifyRequiredFieldNames,
      ebayRequiredFieldNames,
      combinedSharedKeyFeaturesFieldName,
      combinedSharedKeyFeaturesSyncFieldNames,
      combinedEbayTestingNotesFieldName,
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
      shopifyPayloadDebug,
      shopifyDraftCreatePayloadJson,
      shopifyCategorySyncPreviewJson,
      shopifyCreatePayloadDocsJson,
      combinedEbayOnlyFieldNames,
      ebayDrawerRequiredStatus,
      combinedEbayGeneratedBodyHtml,
      ebayCategoryLabelsById,
      setEbayCategoryLabelsById,
      setBodyHtmlPreview,
      combinedEbayBodyHtmlFieldName,
      combinedEbayBodyHtmlValue,
      bodyHtmlPreview,
      ebayDraftPayloadBundleJson,
      ebayPayloadDocsJson,
    })
    : null;

  const selectedRecordStatusProps = selectedRecord
    ? buildListingApprovalSelectedRecordStatusProps({
      approvalChannel,
      isCombinedApproval,
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
      hasExistingShopifyRestProductId,
      pushShopifyDisabled,
      pushEbayDisabled,
      pushBothDisabled,
      onResetData,
      onSaveUpdates,
      onPrimaryAction,
      runCombinedPush,
      accentActionButtonClass,
      primaryActionButtonClass,
      secondaryActionButtonClass,
    })
    : null;

  return {
    selectedRecordPanelProps: buildListingApprovalSelectedRecordPanelProps({
      selectedRecord,
      titleFieldName,
      isApproved,
      saving,
      error,
      onBackToList,
      secondaryActionButtonClass,
      errorSurfaceClass,
      isCombinedApproval,
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