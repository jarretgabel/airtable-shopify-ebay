import { useState } from 'react';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { ListingApprovalCombinedSections } from '@/components/approval/ListingApprovalCombinedSections';
import type { EbayListingTemplateId } from '@/components/approval/listingApprovalEbayConstants';
import { ListingApprovalQueuePanel } from '@/components/approval/ListingApprovalQueuePanel';
import { ListingApprovalRecordActions } from '@/components/approval/ListingApprovalRecordActions';
import { ListingApprovalRecordAlerts } from '@/components/approval/ListingApprovalRecordAlerts';
import { ListingApprovalRecordPayloadPanels } from '@/components/approval/ListingApprovalRecordPayloadPanels';
import { ListingApprovalSelectedRecordView } from '@/components/approval/ListingApprovalSelectedRecordView';
import { useListingApprovalFieldNames } from '@/components/approval/useListingApprovalFieldNames';
import { useListingApprovalDerivedState } from '@/components/approval/useListingApprovalDerivedState';
import { useListingApprovalRecordLifecycle } from '@/components/approval/useListingApprovalRecordLifecycle';
import { useListingApprovalRecordActions } from '@/components/approval/useListingApprovalRecordActions';
import { useListingApprovalShopifySupport } from '@/components/approval/useListingApprovalShopifySupport';
import { useApprovalInlineNotices } from '@/hooks/approval/useApprovalInlineNotices';
import { errorSurfaceClass, panelSurfaceClass } from '@/components/tabs/uiClasses';
import {
  DEFAULT_APPROVAL_TABLE_REFERENCE,
  toFormValue,
  useApprovalStore,
} from '@/stores/approvalStore';

interface ListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
  tableReference?: string;
  tableName?: string;
  createShopifyDraftOnApprove?: boolean;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
}

export function ListingApprovalTab({
  viewModel,
  tableReference: propsTableReference,
  tableName: propTableName,
  createShopifyDraftOnApprove = false,
  approvalChannel = 'ebay',
}: ListingApprovalTabProps) {
  const { selectedRecordId, onSelectRecord, onBackToList } = viewModel;
  const tableReference = propsTableReference
    || (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim()
    || DEFAULT_APPROVAL_TABLE_REFERENCE;
  const tableName = propTableName
    ?? (propsTableReference
      ? undefined
      : (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim()
        || (import.meta.env.VITE_AIRTABLE_TABLE_NAME as string | undefined)?.trim());
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
    inlineActionNotices,
    fadingInlineNoticeIds,
    pushInlineActionNotice,
    resetInlineActionNotices,
  } = useApprovalInlineNotices();

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
    ebayPayloadDocsJson,
    ebayDraftPayloadBundleJson,
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
    shopifyCategorySyncPreviewJson,
    shopifyCreatePayloadDocsJson,
    shopifyDraftCreatePayloadJson,
    shopifyDrawerRequiredStatus,
    shopifyPayloadDebug,
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

  const {
    describeShopifyCreateError,
    resolveShopifyCategoryId,
    syncExistingShopifyListing,
    upsertShopifyProductWithCollectionFallback,
  } = useListingApprovalShopifySupport({
    currentPageCategoryIdValue: currentPageCategoryIdResolution.value,
    loadShopifyApprovalPreviewNow: async (fields) => {
      const preview = await loadShopifyApprovalPreviewNow(fields);
      return {
        effectiveProduct: preview.effectiveProduct,
        collectionIds: preview.collectionIds,
        resolvedCategoryId: preview.resolvedCategoryId,
      };
    },
    pushInlineActionNotice: (tone, title, message) => pushInlineActionNotice(tone, title, message),
    shopifyApprovalPreview: shopifyApprovalPreview
      ? {
        effectiveProduct: shopifyApprovalPreview.effectiveProduct,
        collectionIds: shopifyApprovalPreview.collectionIds,
        resolvedCategoryId: shopifyApprovalPreview.resolvedCategoryId,
      }
      : null,
    shopifyResolvedCategoryId: shopifyApprovalPreview?.resolvedCategoryId,
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
    pushInlineActionNotice,
    resetInlineActionNotices,
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
    shopifyApprovalPreview: shopifyApprovalPreview
      ? {
        effectiveProduct: shopifyApprovalPreview.effectiveProduct,
        collectionIds: shopifyApprovalPreview.collectionIds,
        resolvedCategoryId: shopifyApprovalPreview.resolvedCategoryId,
      }
      : null,
    loadShopifyApprovalPreviewNow: async (fields) => {
      const preview = await loadShopifyApprovalPreviewNow(fields);
      return {
        effectiveProduct: preview.effectiveProduct,
        collectionIds: preview.collectionIds,
        resolvedCategoryId: preview.resolvedCategoryId,
      };
    },
    syncExistingShopifyListing,
    describeShopifyCreateError,
    resolveShopifyCategoryId,
    upsertShopifyProductWithCollectionFallback,
    canUpdateApprovedShopifyListing,
    hasMissingShopifyRequiredFields,
    hasMissingEbayRequiredFields,
    missingShopifyRequiredFieldLabels,
    missingEbayRequiredFieldLabels,
    approvalPublishSource,
    mergedDraftSourceFields,
    onBackToList,
    pushInlineActionNotice,
  });

  if (selectedRecord) {
    return (
      <section className={panelSurfaceClass}>
        <ListingApprovalSelectedRecordView
          selectedRecord={selectedRecord}
          titleFieldName={titleFieldName}
          isApproved={isApproved}
          saving={saving}
          error={error}
          onBackToList={onBackToList}
          secondaryActionButtonClass={secondaryActionButtonClass}
          errorSurfaceClass={errorSurfaceClass}
          editor={isCombinedApproval ? (
            <ListingApprovalCombinedSections
            selectedRecord={selectedRecord}
            approvedFieldName={approvedFieldName}
            formValues={formValues}
            fieldKinds={fieldKinds}
            listingFormatOptions={listingFormatOptions}
            listingDurationOptions={listingDurationOptions}
            saving={saving}
            setFormValue={setFormValue}
            combinedDescriptionFieldName={combinedDescriptionFieldName}
            combinedSharedFieldNames={combinedSharedFieldNames}
            combinedRequiredFieldNames={combinedRequiredFieldNames}
            shopifyRequiredFieldNames={shopifyRequiredFieldNames}
            ebayRequiredFieldNames={ebayRequiredFieldNames}
            currentPageShopifyTagValues={currentPageShopifyTagValues}
            currentPageShopifyCollectionIds={currentPageShopifyCollectionIds}
            currentPageShopifyCollectionLabelsById={currentPageShopifyCollectionLabelsById}
            combinedSharedKeyFeaturesFieldName={combinedSharedKeyFeaturesFieldName}
            combinedSharedKeyFeaturesSyncFieldNames={combinedSharedKeyFeaturesSyncFieldNames}
            combinedEbayTestingNotesFieldName={combinedEbayTestingNotesFieldName}
            sharedDrawerRequiredStatus={sharedDrawerRequiredStatus}
            combinedShopifyOnlyFieldNames={combinedShopifyOnlyFieldNames}
            shopifyDrawerRequiredStatus={shopifyDrawerRequiredStatus}
            currentPageShopifyBodyHtml={currentPageShopifyBodyHtml}
            selectedEbayTemplateId={selectedEbayTemplateId}
            setSelectedEbayTemplateId={setSelectedEbayTemplateId}
            combinedShopifyBodyHtmlFieldName={combinedShopifyBodyHtmlFieldName}
            combinedShopifyBodyHtmlValue={combinedShopifyBodyHtmlValue}
            currentPageProductDescriptionResolution={currentPageProductDescriptionResolution}
            currentPageProductDescription={currentPageProductDescription}
            currentPageProductCategoryResolution={currentPageProductCategoryResolution}
            currentPageCategoryIdResolution={currentPageCategoryIdResolution}
            shopifyCategoryLookupValue={shopifyCategoryLookupValue}
            shopifyCategoryResolution={shopifyCategoryResolution}
            shopifyPayloadDebug={shopifyPayloadDebug}
            shopifyDraftCreatePayloadJson={shopifyDraftCreatePayloadJson}
            shopifyCategorySyncPreviewJson={shopifyCategorySyncPreviewJson}
            shopifyCreatePayloadDocsJson={shopifyCreatePayloadDocsJson}
            combinedEbayOnlyFieldNames={combinedEbayOnlyFieldNames}
            ebayDrawerRequiredStatus={ebayDrawerRequiredStatus}
            combinedEbayGeneratedBodyHtml={combinedEbayGeneratedBodyHtml}
            ebayCategoryLabelsById={ebayCategoryLabelsById}
            setEbayCategoryLabelsById={setEbayCategoryLabelsById}
            setBodyHtmlPreview={setBodyHtmlPreview}
            combinedEbayBodyHtmlFieldName={combinedEbayBodyHtmlFieldName}
            combinedEbayBodyHtmlValue={combinedEbayBodyHtmlValue}
            bodyHtmlPreview={bodyHtmlPreview}
            ebayDraftPayloadBundleJson={ebayDraftPayloadBundleJson}
            ebayPayloadDocsJson={ebayPayloadDocsJson}
          />
          ) : (
            <ApprovalFormFields
            recordId={selectedRecord.id}
            approvalChannel={approvalChannel}
            isCombinedApproval={isCombinedApproval}
            forceShowShopifyCollectionsEditor={approvalChannel === 'shopify'}
            allFieldNames={allFieldNames}
            writableFieldNames={Object.keys(selectedRecord.fields)}
            requiredFieldNames={formRequiredFieldNames}
            shopifyRequiredFieldNames={formShopifyRequiredFieldNames}
            ebayRequiredFieldNames={formEbayRequiredFieldNames}
            approvedFieldName={approvedFieldName}
            formValues={formValues}
            fieldKinds={fieldKinds}
            listingFormatOptions={listingFormatOptions}
            listingDurationOptions={listingDurationOptions}
            saving={saving}
            setFormValue={setFormValue}
            suppressImageScalarFields={approvalChannel === 'shopify' || approvalChannel === 'ebay'}
            originalFieldValues={Object.fromEntries(
              Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
            )}
            normalizedBodyHtmlPreview={approvalChannel === 'shopify'
              ? currentPageShopifyBodyHtml
              : approvalChannel === 'ebay'
                ? combinedEbayGeneratedBodyHtml
                : ''}
            normalizedShopifyTagValues={approvalChannel === 'ebay' ? undefined : currentPageShopifyTagValues}
            normalizedShopifyCollectionIds={approvalChannel === 'ebay' ? undefined : currentPageShopifyCollectionIds}
            normalizedShopifyCollectionLabelsById={approvalChannel === 'ebay' ? undefined : currentPageShopifyCollectionLabelsById}
            normalizedEbayCategoryLabelsById={approvalChannel === 'ebay' ? ebayCategoryLabelsById : {}}
            onEbayCategoryLabelsChange={approvalChannel === 'ebay'
              ? (labelsById) => setEbayCategoryLabelsById((current) => ({ ...current, ...labelsById }))
              : undefined}
            onBodyHtmlPreviewChange={setBodyHtmlPreview}
            selectedEbayTemplateId={selectedEbayTemplateId}
            onEbayTemplateIdChange={setSelectedEbayTemplateId}
          />
          )}
          alerts={<ListingApprovalRecordAlerts
          approvalChannel={approvalChannel}
          hasUnsavedChanges={hasUnsavedChanges}
          changedFieldNames={changedFieldNames}
          hasMissingShopifyRequiredFields={hasMissingShopifyRequiredFields}
          missingShopifyRequiredFieldNames={missingShopifyRequiredFieldNames}
          missingShopifyRequiredFieldLabels={missingShopifyRequiredFieldLabels}
          hasMissingEbayRequiredFields={hasMissingEbayRequiredFields}
          missingEbayRequiredFieldNames={missingEbayRequiredFieldNames}
          missingEbayRequiredFieldLabels={missingEbayRequiredFieldLabels}
          inlineActionNotices={inlineActionNotices}
          fadingInlineNoticeIds={fadingInlineNoticeIds}
          />}
          actions={<ListingApprovalRecordActions
            approvalChannel={approvalChannel}
            isCombinedApproval={isCombinedApproval}
            saving={saving}
            approving={approving}
            pushingTarget={pushingTarget}
            hasUnsavedChanges={hasUnsavedChanges}
            canUpdateApprovedShopifyListing={canUpdateApprovedShopifyListing}
            isApproved={isApproved}
            hasExistingShopifyRestProductId={hasExistingShopifyRestProductId}
            hasMissingShopifyRequiredFields={hasMissingShopifyRequiredFields}
            hasMissingEbayRequiredFields={hasMissingEbayRequiredFields}
            pushShopifyDisabled={pushShopifyDisabled}
            pushEbayDisabled={pushEbayDisabled}
            pushBothDisabled={pushBothDisabled}
            onResetData={handleResetData}
            onSaveUpdates={handleSaveUpdates}
            onPublishShopify={() => { void runCombinedPush('shopify'); }}
            onPublishEbay={() => { void runCombinedPush('ebay'); }}
            onPublishBoth={() => { void runCombinedPush('both'); }}
            onPrimaryAction={handlePrimaryAction}
            accentActionButtonClass={accentActionButtonClass}
            primaryActionButtonClass={primaryActionButtonClass}
            secondaryActionButtonClass={secondaryActionButtonClass}
          />}
          payloadPanels={<ListingApprovalRecordPayloadPanels
          approvalChannel={approvalChannel}
          currentPageProductDescriptionResolution={currentPageProductDescriptionResolution}
          currentPageProductDescription={currentPageProductDescription}
          currentPageProductCategoryResolution={currentPageProductCategoryResolution}
          currentPageCategoryIdResolution={currentPageCategoryIdResolution}
          shopifyCategoryLookupValue={shopifyCategoryLookupValue}
          shopifyCategoryResolution={shopifyCategoryResolution}
          shopifyPayloadDebug={shopifyPayloadDebug}
          shopifyDraftCreatePayloadJson={shopifyDraftCreatePayloadJson}
          shopifyCategorySyncPreviewJson={shopifyCategorySyncPreviewJson}
          shopifyCreatePayloadDocsJson={shopifyCreatePayloadDocsJson}
          ebayDraftPayloadBundleJson={ebayDraftPayloadBundleJson}
          ebayPayloadDocsJson={ebayPayloadDocsJson}
        />}
        />
      </section>
    );
  }

  return (
    <>
      <ListingApprovalQueuePanel
        hasTableReference={hasTableReference}
        error={error}
        loading={loading}
        approvalChannel={approvalChannel}
        creatingShopifyListing={creatingShopifyListing}
        saving={saving}
        tableReference={tableReference}
        tableName={tableName}
        records={records}
        approvedFieldName={approvedFieldName}
        shopifyRequiredFieldNames={shopifyRequiredFieldNames}
        ebayRequiredFieldNames={ebayRequiredFieldNames}
        combinedRequiredFieldNames={combinedRequiredFieldNames}
        titleFieldName={titleFieldName}
        formatFieldName={formatFieldName}
        priceFieldName={priceFieldName}
        vendorFieldName={vendorFieldName}
        qtyFieldName={qtyFieldName}
        openRecord={openRecord}
        onSelectRecord={onSelectRecord}
        createNewShopifyListing={createNewShopifyListing}
        loadRecords={loadRecords}
      />
    </>
  );
}
