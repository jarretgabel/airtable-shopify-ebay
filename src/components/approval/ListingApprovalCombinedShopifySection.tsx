import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import { isShopifyAdvancedOptionField } from '@/components/approval/approvalFormFieldsShopifyHelpersBasic';
import type { ListingApprovalCombinedShopifySectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';

const ShopifyApprovalPayloadDetails = lazy(async () => ({
  default: (await import('@/components/approval/ListingApprovalRecordPayloadPanels')).ShopifyApprovalPayloadDetails,
}));

function ShopifyPayloadFallback() {
  return (
    <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
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
  const standardShopifyFieldNames = combinedShopifyOnlyFieldNames.filter((fieldName) => !isShopifyAdvancedOptionField(fieldName));
  const advancedShopifyFieldNames = combinedShopifyOnlyFieldNames.filter((fieldName) => isShopifyAdvancedOptionField(fieldName));

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
          <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">Advanced Shopify Fields</summary>
            <div className="border-t border-[var(--line)] px-3 py-3">
              <ApprovalFormFields
                recordId={selectedRecord.id}
                approvalChannel="shopify"
                isCombinedApproval
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

        <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">Shopify Body (HTML)</summary>
          <div className="border-t border-[var(--line)] px-3 py-3">
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">Read-only HTML from Airtable field.</p>
            {!combinedShopifyBodyHtmlFieldName && (
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">No Shopify Body HTML field was found for this record.</p>
            )}
            <pre className="m-0 max-h-[260px] overflow-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{combinedShopifyBodyHtmlValue}</pre>
          </div>
        </details>

        <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">Shopify Body Rendered</summary>
          <div className="border-t border-[var(--line)] px-3 py-3">
            <BodyHtmlPreview value={combinedShopifyBodyHtmlValue} previewOnly />
          </div>
        </details>

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
      </div>
    </AppPageSectionSurface>
  );
}