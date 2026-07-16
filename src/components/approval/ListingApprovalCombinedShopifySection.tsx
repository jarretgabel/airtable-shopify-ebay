import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { isDeveloperRole } from '@/auth/roleAccess';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import {
  isShopifyAdvancedOptionField,
  isShopifyBodyDescriptionField,
} from '@/components/approval/approvalFormFieldsShopifyHelpersBasic';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
  detailPreBlockClass,
  insetPanelClass,
} from '@/components/tabs/uiClasses';
import type { ListingApprovalCombinedShopifySectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';
import { useAuthStore } from '@/stores/auth/authStore';

const ShopifyApprovalPayloadDetails = lazy(async () => ({
  default: (await import('@/components/approval/ListingApprovalRecordPayloadPanels')).ShopifyApprovalPayloadDetails,
}));
const SHOPIFY_CONDITION_METAFIELD_VALUE_FIELD = 'Shopify Condition Metafield Value';

function ShopifyPayloadFallback() {
  return (
    <div className={`${insetPanelClass} mt-4 text-sm text-[var(--muted)]`}>
      Loading Shopify payload preview...
    </div>
  );
}

export function ListingApprovalCombinedShopifySection({
  sectionId,
  selectedRecord,
  approvedFieldName,
  formValues,
  fieldKinds,
  listingFormatOptions,
  listingDurationOptions,
  saving,
  setFormValue,
  setDerivedFormValue,
  writableFieldNames,
  originalFieldValues,
  combinedShopifyOnlyFieldNames,
  shopifyRequiredFieldNames,
  shopifyDrawerRequiredStatus,
  currentPageShopifyBodyHtml,
  currentPageShopifyTagValues,
  currentPageShopifyCollectionIds,
  currentPageShopifyCollectionLabelsById,
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
}: ListingApprovalCombinedShopifySectionProps) {
  // Group advanced Shopify variant fields for separate rendering with clear labels
  const standardShopifyFieldNames = combinedShopifyOnlyFieldNames.filter((fieldName) => {
    if (isShopifyAdvancedOptionField(fieldName)) return false;
    if (isShopifyBodyDescriptionField(fieldName)) return false;
    return true;
  });
  const advancedShopifyFieldNames = Array.from(new Set([
    ...combinedShopifyOnlyFieldNames.filter((fieldName) => isShopifyAdvancedOptionField(fieldName)),
    SHOPIFY_CONDITION_METAFIELD_VALUE_FIELD,
  ]));
  const displayedShopifyBodyHtml = currentPageShopifyBodyHtml || combinedShopifyBodyHtmlValue;
  const showDeveloperPayloadPanels = useAuthStore((state) => {
    const currentUser = state.users.find((user) => user.id === state.currentUserId);
    return currentUser ? isDeveloperRole(currentUser.role) : false;
  });

  return (
    <AppPageSectionSurface id={sectionId} className="scroll-mt-24 space-y-4 bg-[var(--bg)]/60">
      <AppSectionTitle
        title="Shopify-Specific Fields"
        actions={shopifyDrawerRequiredStatus.hasRequired ? <DrawerStatusIcon allFilled={shopifyDrawerRequiredStatus.allFilled} /> : null}
      />
      <div>
        {standardShopifyFieldNames.length > 0 && (
          <ApprovalFormFields
            recordId={selectedRecord.id}
            approvalChannel="shopify"
            isCombinedApproval
            forceShowShopifyCollectionsEditor
            allFieldNames={standardShopifyFieldNames}
            writableFieldNames={writableFieldNames}
            requiredFieldNames={shopifyRequiredFieldNames}
            shopifyRequiredFieldNames={shopifyRequiredFieldNames}
            ebayRequiredFieldNames={[]}
            approvedFieldName={approvedFieldName}
            formValues={formValues}
            fieldKinds={fieldKinds}
            listingFormatOptions={listingFormatOptions}
            listingDurationOptions={listingDurationOptions}
            saving={saving}
            setFormValue={setFormValue}
            setDerivedFormValue={setDerivedFormValue}
            suppressImageScalarFields
            originalFieldValues={originalFieldValues}
            normalizedBodyHtmlPreview={currentPageShopifyBodyHtml}
            normalizedShopifyTagValues={currentPageShopifyTagValues}
            normalizedShopifyCollectionIds={currentPageShopifyCollectionIds}
            normalizedShopifyCollectionLabelsById={currentPageShopifyCollectionLabelsById}
            selectedEbayTemplateId={selectedEbayTemplateId}
            onEbayTemplateIdChange={setSelectedEbayTemplateId}
          />
        )}

        {advancedShopifyFieldNames.length > 0 && (
          <details className={`mt-4 ${detailDisclosureClass}`}>
            <summary className={detailDisclosureSummaryClass}>Advanced Shopify Fields</summary>
            <div className={detailDisclosureBodyClass}>
              <ApprovalFormFields
                recordId={selectedRecord.id}
                approvalChannel="shopify"
                isCombinedApproval
                showSupplementalEditors={false}
                allFieldNames={advancedShopifyFieldNames}
                writableFieldNames={writableFieldNames}
                requiredFieldNames={shopifyRequiredFieldNames}
                shopifyRequiredFieldNames={shopifyRequiredFieldNames}
                ebayRequiredFieldNames={[]}
                approvedFieldName={approvedFieldName}
                formValues={formValues}
                fieldKinds={fieldKinds}
                listingFormatOptions={listingFormatOptions}
                listingDurationOptions={listingDurationOptions}
                saving={saving}
                setFormValue={setFormValue}
                setDerivedFormValue={setDerivedFormValue}
                suppressImageScalarFields
                originalFieldValues={originalFieldValues}
                normalizedBodyHtmlPreview={currentPageShopifyBodyHtml}
                normalizedShopifyTagValues={currentPageShopifyTagValues}
                normalizedShopifyCollectionIds={currentPageShopifyCollectionIds}
                normalizedShopifyCollectionLabelsById={currentPageShopifyCollectionLabelsById}
                selectedEbayTemplateId={selectedEbayTemplateId}
                onEbayTemplateIdChange={setSelectedEbayTemplateId}
              />
            </div>
          </details>
        )}

        {advancedShopifyFieldNames.length > 0 && (
          <div
            role="separator"
            aria-label="Listing content divider"
            className="mt-5 border-t border-[var(--line)]/80"
          />
        )}

        <details className={`mt-4 ${detailDisclosureClass}`}>
          <summary className={detailDisclosureSummaryClass}>Shopify Body (HTML)</summary>
          <div className={detailDisclosureBodyClass}>
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">Generated from the current Shopify body preview when available, otherwise falls back to the saved Airtable field.</p>
            {!combinedShopifyBodyHtmlFieldName && (
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">No Shopify Body HTML field was found for this record.</p>
            )}
            <pre className={`${detailPreBlockClass} max-h-[260px] overflow-auto`}>{displayedShopifyBodyHtml}</pre>
          </div>
        </details>

        <details className={`mt-4 ${detailDisclosureClass}`}>
          <summary className={detailDisclosureSummaryClass}>Shopify Body Rendered</summary>
          <div className={detailDisclosureBodyClass}>
            <BodyHtmlPreview value={displayedShopifyBodyHtml} previewOnly />
          </div>
        </details>

        {showDeveloperPayloadPanels ? (
          <Suspense fallback={<ShopifyPayloadFallback />}>
            <ShopifyApprovalPayloadDetails
              currentPageProductDescriptionResolution={currentPageProductDescriptionResolution}
              currentPageProductDescription={currentPageProductDescription}
              currentPageProductCategoryResolution={currentPageProductCategoryResolution}
              currentPageCategoryIdResolution={currentPageCategoryIdResolution}
              shopifyCategoryLookupValue={shopifyCategoryLookupValue}
              shopifyCategoryResolution={shopifyCategoryResolution}
              isShopifyPayloadPreviewContext={isShopifyPayloadPreviewContext}
              shopifyProductSetRequest={shopifyProductSetRequest}
            />
          </Suspense>
        ) : null}
      </div>
    </AppPageSectionSurface>
  );
}