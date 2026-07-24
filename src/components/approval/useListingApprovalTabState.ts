import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { getRecordFromResolvedSource } from '@/services/app-api/airtable';
import { getProduct as getShopifyProduct } from '@/services/app-api/shopify';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
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
  backToListLabel?: string;
}

interface UseListingApprovalTabStateResult {
  selectedRecord: AirtableRecord | null;
  selectedRecordPanelProps: ListingApprovalSelectedRecordPanelProps | null;
  queuePanelProps: ReturnType<typeof buildListingApprovalQueuePanelProps>;
  confirmationModal: ReactNode;
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

function resolveShopifyStorefrontUrl(storeDomain: string, formValues: Record<string, string>): string {
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

export function useListingApprovalTabState({
  viewModel,
  tableReference: propsTableReference,
  tableName: propTableName,
  createShopifyDraftOnApprove = false,
  approvalChannel = 'ebay',
  backToListLabel,
}: UseListingApprovalTabStateParams): UseListingApprovalTabStateResult {
  const {
    selectedRecordId,
    onSelectRecord,
    onBackToList,
    onOpenIntakeForm,
    onOpenOperationalRecord,
    onOpenTestingForm,
    onOpenPhotosForm,
  } = viewModel;
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
    initialFormValues,
    fieldKinds,
    setFormValue,
    setDerivedFormValue,
    hydrateForm,
    loadRecords,
    loadListingFormatOptions,
    saveRecord,
  } = useApprovalStore();

  const [creatingShopifyListing, setCreatingShopifyListing] = useState(false);
  const [bodyHtmlPreview, setBodyHtmlPreview] = useState('');
  const [selectedEbayTemplateId, setSelectedEbayTemplateId] = useState<EbayListingTemplateId>('classic');
  const [ebayCategoryLabelsById, setEbayCategoryLabelsById] = useState<Record<string, string>>({});
  const [directSelectedRecord, setDirectSelectedRecord] = useState<AirtableRecord | null>(null);
  const [directSelectedRecordLoading, setDirectSelectedRecordLoading] = useState(false);
  const [shopifyServiceListingUrl, setShopifyServiceListingUrl] = useState<string | null>(null);

  const shopifyStoreDomain = checkOptionalEnv('VITE_SHOPIFY_STORE_DOMAIN');
  const explicitShopifyStorefrontUrl = useMemo(
    () => resolveShopifyStorefrontUrl(shopifyStoreDomain, formValues),
    [formValues, shopifyStoreDomain],
  );
  const shopifyRestProductId = useMemo(() => {
    const rawProductId = getFirstTrimmedValue(formValues, ['Shopify REST Product ID', 'Shopify Product ID']);
    const parsedProductId = Number(rawProductId);
    return Number.isFinite(parsedProductId) && parsedProductId > 0
      ? parsedProductId
      : null;
  }, [formValues]);

  const recordsForSelection = useMemo(() => {
    if (!directSelectedRecord) {
      return records;
    }

    if (records.some((record) => record.id === directSelectedRecord.id)) {
      return records.map((record) => (record.id === directSelectedRecord.id ? directSelectedRecord : record));
    }

    return [directSelectedRecord, ...records];
  }, [directSelectedRecord, records]);

  useEffect(() => {
    if (!selectedRecordId) {
      setDirectSelectedRecord(null);
      setDirectSelectedRecordLoading(false);
      return;
    }

    if (!tableReference.trim()) {
      setDirectSelectedRecordLoading(false);
      return;
    }

    const queuedRecord = records.find((record) => record.id === selectedRecordId);
    const queuedRecordHasDetailFields = Boolean(
      queuedRecord
      && (
        Object.prototype.hasOwnProperty.call(queuedRecord.fields, 'Workflow Image Metadata JSON')
        || Object.prototype.hasOwnProperty.call(queuedRecord.fields, 'Images')
      )
    );

    if (queuedRecordHasDetailFields) {
      setDirectSelectedRecord(null);
      setDirectSelectedRecordLoading(false);
      return;
    }

    let cancelled = false;

    const loadDirectRecord = async () => {
      setDirectSelectedRecordLoading(true);
      try {
        let record: AirtableRecord | null = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            record = await getRecordFromResolvedSource(tableReference, tableName, selectedRecordId);
            break;
          } catch {
            if (attempt === 1) {
              throw new Error('Direct record lookup failed.');
            }
          }
        }

        if (cancelled) {
          return;
        }

        setDirectSelectedRecord(record);
      } catch {
        if (cancelled) {
          return;
        }

        setDirectSelectedRecord(null);
      } finally {
        if (cancelled) {
          return;
        }

        setDirectSelectedRecordLoading(false);
      }
    };

    void loadDirectRecord();

    return () => {
      cancelled = true;
    };
  }, [records, selectedRecordId, tableName, tableReference]);

  useEffect(() => {
    if (explicitShopifyStorefrontUrl) {
      setShopifyServiceListingUrl(explicitShopifyStorefrontUrl);
      return;
    }

    if (!shopifyStoreDomain.trim() || !shopifyRestProductId) {
      setShopifyServiceListingUrl(null);
      return;
    }

    let cancelled = false;

    const resolveStorefrontUrlFromShopifyProduct = async () => {
      try {
        const product = await getShopifyProduct(shopifyRestProductId);
        if (cancelled) return;

        const handle = typeof product?.handle === 'string' ? product.handle.trim() : '';
        if (!handle) {
          setShopifyServiceListingUrl(null);
          return;
        }

        setShopifyServiceListingUrl(toExternalUrl(shopifyStoreDomain, `/products/${encodeURIComponent(handle)}`));
      } catch {
        if (cancelled) return;
        setShopifyServiceListingUrl(null);
      }
    };

    void resolveStorefrontUrlFromShopifyProduct();

    return () => {
      cancelled = true;
    };
  }, [explicitShopifyStorefrontUrl, shopifyRestProductId, shopifyStoreDomain]);

  const {
    actualFieldNames,
    allFieldNames,
  } = useListingApprovalFieldNames({
    records: recordsForSelection,
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
    drawerSourceFields,
    ebayBodyHtmlSaveFieldName,
    ebayDrawerRequiredStatus,
    ebayDraftPayloadBundle,
    ebayRequiredFieldNames,
    formEbayRequiredFieldNames,
    formRequiredFieldNames,
    formShopifyRequiredFieldNames,
    formatFieldName,
    hasExistingEbayOfferId,
    hasExistingShopifyRestProductId,
    hasMissingEbayRequiredFields,
    hasMissingShopifyRequiredFields,
    hasUnsavedChanges,
    isShopifyPublishBlockedByAuctionFormat,
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
    records: recordsForSelection,
    selectedRecordId,
    allFieldNames,
    approvalChannel,
    isCombinedApproval,
    formValues,
    initialFormValues,
    fieldKinds,
    setFormValue,
    setDerivedFormValue,
    ebayCategoryLabelsById,
    selectedEbayTemplateId,
    setSelectedEbayTemplateId,
    tableReference,
    tableName,
  });

  const queueLoading = loading || (
    Boolean(selectedRecordId)
    && !selectedRecord
    && directSelectedRecordLoading
  );

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

  const workflowPublishSummary = selectedRecord && isCombinedApproval && typeof selectedRecord.fields['Workflow Status'] === 'string'
    ? {
      workflowStatus: selectedRecord.fields['Workflow Status'].trim(),
      readiness: getUsedGearWorkflowListingReadiness(selectedRecord),
    }
    : null;

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
    setDerivedFormValue,
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
    isShopifyPublishBlockedByAuctionFormat,
    missingShopifyRequiredFieldLabels,
    missingEbayRequiredFieldLabels,
    changedFieldNames,
    approvalPublishSource,
    mergedDraftSourceFields,
    workflowPublishSummary,
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
    setDerivedFormValue,
    currentPageShopifyBodyHtml,
    currentPageShopifyTagValues,
    currentPageShopifyCollectionIds,
    currentPageShopifyCollectionLabelsById,
    onOpenIntakeForm,
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
    inlineActionNotices: interactionState.inlineActionNotices,
    fadingInlineNoticeIds: interactionState.fadingInlineNoticeIds,
    canUpdateApprovedShopifyListing,
    hasExistingShopifyRestProductId,
    pushShopifyDisabled,
    pushEbayDisabled,
    pushBothDisabled,
    isShopifyPublishBlockedByAuctionFormat,
    onResetData: handleResetData,
    onSaveUpdates: handleSaveUpdates,
    onPrimaryAction: handlePrimaryAction,
    runCombinedPush,
    hasTableReference,
    loading: queueLoading,
    creatingShopifyListing,
    tableReference,
    tableName,
    records,
    formatFieldName,
    hasExistingEbayOfferId,
    shopifyAdminListingUrl: null,
    shopifyServiceListingUrl,
    ebayAdminListingUrl: null,
    ebayServiceListingUrl: null,
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