import { useState, type ReactNode } from 'react';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import type { ListingApprovalSelectedRecordPanelProps } from '@/components/approval/ListingApprovalSelectedRecordPanel';
import type { EbayListingTemplateId } from '@/components/approval/listingApprovalEbayConstants';
import { buildListingApprovalQueuePanelProps } from '@/components/approval/listingApprovalQueuePanelProps';
import { buildListingApprovalTabPanels } from '@/components/approval/listingApprovalTabPanels';
import { useListingApprovalInteractionState } from '@/components/approval/useListingApprovalInteractionState';
import { useListingApprovalShopifyActionSupport } from '@/components/approval/useListingApprovalShopifyActionSupport';
import { useListingApprovalDerivedState } from '@/components/approval/useListingApprovalDerivedState';
import { useListingApprovalFieldNames } from '@/components/approval/useListingApprovalFieldNames';
import { useListingApprovalRecordActions } from '@/components/approval/useListingApprovalRecordActions';
import { useListingApprovalRecordLifecycle } from '@/components/approval/useListingApprovalRecordLifecycle';
import { checkOptionalEnv } from '@/config/runtimeEnv';
import {
  useApprovalStore,
} from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

interface UseListingApprovalTabStateParams {
  viewModel: ApprovalTabViewModel;
  tableReference?: string;
  tableName?: string;
  createShopifyDraftOnApprove?: boolean;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
}

interface UseListingApprovalTabStateResult {
  selectedRecord: AirtableRecord | null;
  selectedRecordPanelProps: ListingApprovalSelectedRecordPanelProps | null;
  queuePanelProps: ReturnType<typeof buildListingApprovalQueuePanelProps>;
  confirmationModal: ReactNode;
}

export function useListingApprovalTabState({
  viewModel,
  tableReference: propsTableReference,
  tableName: propTableName,
  createShopifyDraftOnApprove = false,
  approvalChannel = 'ebay',
}: UseListingApprovalTabStateParams): UseListingApprovalTabStateResult {
  const { selectedRecordId, onSelectRecord, onBackToList } = viewModel;
  const tableReference = propsTableReference || checkOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_REF');
  const tableName = propTableName
    ?? (propsTableReference
      ? undefined
      : checkOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_NAME'));
  const isCombinedApproval = approvalChannel === 'combined';

  const {
    records,
    loading,
    saving,
    error,
    listingFormatOptions,
    listingDurationOptions,
    formValues,
    fieldKinds,
    setFormValue,
    hydrateForm,
    loadRecords,
    loadListingFormatOptions,
    saveRecord,
  } = useApprovalStore();

  const [creatingShopifyListing, setCreatingShopifyListing] = useState(false);
  const [bodyHtmlPreview, setBodyHtmlPreview] = useState('');
  const [selectedEbayTemplateId, setSelectedEbayTemplateId] = useState<EbayListingTemplateId>('classic');
  const [ebayCategoryLabelsById, setEbayCategoryLabelsById] = useState<Record<string, string>>({});

  const {
    actualFieldNames,
    allFieldNames,
  } = useListingApprovalFieldNames({
    records,
    approvalChannel,
  });

  const {
    approvedFieldName,
    approvalPublishSource,
    canUpdateApprovedShopifyListing,
    changedFieldNames,
    combinedDescriptionFieldName,
    combinedEbayBodyHtmlFieldName,
    combinedEbayBodyHtmlValue,
    combinedEbayGeneratedBodyHtml,
    combinedEbayOnlyFieldNames,
    combinedEbayTestingNotesFieldName,
    combinedRequiredFieldNames,
    combinedSharedFieldNames,
    combinedSharedKeyFeaturesFieldName,
    combinedSharedKeyFeaturesSyncFieldNames,
    combinedShopifyBodyHtmlFieldName,
    combinedShopifyBodyHtmlValue,
    combinedShopifyOnlyFieldNames,
    currentPageCategoryIdResolution,
    currentPageProductCategoryResolution,
    currentPageProductDescription,
    currentPageProductDescriptionResolution,
    currentPageShopifyBodyHtml,
    currentPageShopifyCollectionIds,
    currentPageShopifyCollectionLabelsById,
    currentPageShopifyTagValues,
    ebayBodyHtmlSaveFieldName,
    ebayDrawerRequiredStatus,
    ebayDraftPayloadBundle,
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
    isEbayPayloadPreviewContext,
    isShopifyPayloadPreviewContext,
    loadShopifyApprovalPreviewNow,
    mergedDraftSourceFields,
    missingEbayRequiredFieldLabels,
    missingEbayRequiredFieldNames,
    missingShopifyRequiredFieldLabels,
    missingShopifyRequiredFieldNames,
    priceFieldName,
    pushBothDisabled,
    pushEbayDisabled,
    pushShopifyDisabled,
    qtyFieldName,
    selectedRecord,
    sharedDrawerRequiredStatus,
    shopifyApprovalPreview,
    shopifyCategoryLookupValue,
    shopifyCategoryResolution,
    shopifyDrawerRequiredStatus,
    shopifyProductSetRequest,
    shopifyRequiredFieldNames,
    shouldForceEbayBodyHtmlSave,
    titleFieldName,
    vendorFieldName,
  } = useListingApprovalDerivedState({
    records,
    selectedRecordId,
    allFieldNames,
    approvalChannel,
    isCombinedApproval,
    formValues,
    fieldKinds,
    setFormValue,
    ebayCategoryLabelsById,
    selectedEbayTemplateId,
    setSelectedEbayTemplateId,
    tableReference,
    tableName,
  });

  const interactionState = useListingApprovalInteractionState({
    selectedRecord,
    hasUnsavedChanges,
    saving,
    approving: false,
    pushingTarget: null,
  });

  const {
    describeShopifyCreateError,
    loadShopifyApprovalPreviewSnapshotNow,
    resolveShopifyCategoryId,
    shopifyApprovalPreviewSnapshot,
    syncExistingShopifyListing,
    upsertShopifyProductWithCollectionFallback,
  } = useListingApprovalShopifyActionSupport({
    currentPageCategoryIdValue: currentPageCategoryIdResolution.value,
    loadShopifyApprovalPreviewNow,
    pushInlineActionNotice: (tone, title, message) => interactionState.pushInlineActionNotice(tone, title, message),
    shopifyApprovalPreview,
  });

  const {
    createNewShopifyListing,
    hasTableReference,
    openRecord,
  } = useListingApprovalRecordLifecycle({
    approvalChannel,
    allFieldNames,
    approvedFieldName,
    hydrateForm,
    loadListingFormatOptions,
    loadRecords,
    onSelectRecord,
    pushInlineActionNotice: interactionState.pushInlineActionNotice,
    resetInlineActionNotices: interactionState.resetInlineActionNotices,
    selectedRecord,
    selectedRecordId,
    setCreatingShopifyListing,
    setEbayCategoryLabelsById,
    tableReference,
    tableName,
    titleFieldName,
    describeShopifyCreateError,
  });

  const {
    approving,
    pushingTarget,
    handlePrimaryAction,
    handleResetData,
    handleSaveUpdates,
    runCombinedPush,
  } = useListingApprovalRecordActions({
    selectedRecord: selectedRecord ?? undefined,
    approvalChannel,
    allFieldNames,
    approvedFieldName,
    actualFieldNames,
    tableReference,
    tableName,
    formValues,
    setFormValue,
    hydrateForm,
    saveRecord,
    bodyHtmlPreview,
    ebayBodyHtmlSaveFieldName,
    shouldForceEbayBodyHtmlSave,
    combinedSharedKeyFeaturesFieldName,
    combinedEbayTestingNotesFieldName,
    priceFieldName,
    createShopifyDraftOnApprove,
    shopifyApprovalPreview: shopifyApprovalPreviewSnapshot,
    loadShopifyApprovalPreviewNow: loadShopifyApprovalPreviewSnapshotNow,
    syncExistingShopifyListing,
    describeShopifyCreateError,
    resolveShopifyCategoryId,
    upsertShopifyProductWithCollectionFallback,
    canUpdateApprovedShopifyListing,
    hasMissingShopifyRequiredFields,
    hasMissingEbayRequiredFields,
    missingShopifyRequiredFieldLabels,
    missingEbayRequiredFieldLabels,
    changedFieldNames,
    approvalPublishSource,
    mergedDraftSourceFields,
    onBackToList,
    pushInlineActionNotice: interactionState.pushInlineActionNotice,
    requestConfirmation: interactionState.requestConfirmation,
  });

  const {
    selectedRecordPanelProps,
    queuePanelProps,
  } = buildListingApprovalTabPanels({
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
    inlineActionNotices: interactionState.inlineActionNotices,
    fadingInlineNoticeIds: interactionState.fadingInlineNoticeIds,
    canUpdateApprovedShopifyListing,
    hasExistingShopifyRestProductId,
    pushShopifyDisabled,
    pushEbayDisabled,
    pushBothDisabled,
    onResetData: handleResetData,
    onSaveUpdates: handleSaveUpdates,
    onPrimaryAction: handlePrimaryAction,
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
  });

  return {
    selectedRecord,
    selectedRecordPanelProps,
    queuePanelProps,
    confirmationModal: interactionState.confirmationModal,
  };
}