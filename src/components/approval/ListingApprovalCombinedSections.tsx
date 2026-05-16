import { ListingApprovalCombinedEbaySection } from '@/components/approval/ListingApprovalCombinedEbaySection';
import { ListingApprovalCombinedSharedSection } from '@/components/approval/ListingApprovalCombinedSharedSection';
import { ListingApprovalCombinedShopifySection } from '@/components/approval/ListingApprovalCombinedShopifySection';
import type {
  CombinedSectionCommonProps,
  ListingApprovalCombinedEbaySectionProps,
  ListingApprovalCombinedSharedSectionProps,
  ListingApprovalCombinedShopifySectionProps,
} from '@/components/approval/listingApprovalCombinedSectionTypes';
import { toFormValue } from '@/stores/approvalStore';
interface ListingApprovalCombinedSectionsProps
  extends Omit<CombinedSectionCommonProps, 'writableFieldNames' | 'originalFieldValues'>,
    Omit<ListingApprovalCombinedSharedSectionProps, keyof CombinedSectionCommonProps>,
    Omit<ListingApprovalCombinedShopifySectionProps, keyof CombinedSectionCommonProps>,
    Omit<ListingApprovalCombinedEbaySectionProps, keyof CombinedSectionCommonProps> {}

export function ListingApprovalCombinedSections({
  selectedRecord,
  approvedFieldName,
  formValues,
  fieldKinds,
  listingFormatOptions,
  listingDurationOptions,
  saving,
  setFormValue,
  titleFieldName,
  combinedDescriptionFieldName,
  combinedSharedFieldNames,
  combinedRequiredFieldNames,
  shopifyRequiredFieldNames,
  ebayRequiredFieldNames,
  combinedSharedKeyFeaturesFieldName,
  combinedSharedKeyFeaturesSyncFieldNames,
  sharedTestingSourceFieldValues,
  sharedDrawerRequiredStatus,
  onOpenOperationalRecord,
  onOpenTestingForm,
  combinedShopifyOnlyFieldNames,
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
}: ListingApprovalCombinedSectionsProps) {
  const writableFieldNames = Object.keys(selectedRecord.fields);
  const originalFieldValues = Object.fromEntries(
    Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
  );

  return (
    <div className="space-y-4">
      <ListingApprovalCombinedSharedSection
        selectedRecord={selectedRecord}
        approvedFieldName={approvedFieldName}
        formValues={formValues}
        fieldKinds={fieldKinds}
        listingFormatOptions={listingFormatOptions}
        listingDurationOptions={listingDurationOptions}
        saving={saving}
        setFormValue={setFormValue}
        titleFieldName={titleFieldName}
        writableFieldNames={writableFieldNames}
        originalFieldValues={originalFieldValues}
        combinedDescriptionFieldName={combinedDescriptionFieldName}
        combinedSharedFieldNames={combinedSharedFieldNames}
        combinedRequiredFieldNames={combinedRequiredFieldNames}
        shopifyRequiredFieldNames={shopifyRequiredFieldNames}
        ebayRequiredFieldNames={ebayRequiredFieldNames}
        combinedSharedKeyFeaturesFieldName={combinedSharedKeyFeaturesFieldName}
        combinedSharedKeyFeaturesSyncFieldNames={combinedSharedKeyFeaturesSyncFieldNames}
        sharedTestingSourceFieldValues={sharedTestingSourceFieldValues}
        sharedDrawerRequiredStatus={sharedDrawerRequiredStatus}
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenTestingForm={onOpenTestingForm}
      />

      <ListingApprovalCombinedShopifySection
        selectedRecord={selectedRecord}
        approvedFieldName={approvedFieldName}
        formValues={formValues}
        fieldKinds={fieldKinds}
        listingFormatOptions={listingFormatOptions}
        listingDurationOptions={listingDurationOptions}
        saving={saving}
        setFormValue={setFormValue}
        writableFieldNames={writableFieldNames}
        originalFieldValues={originalFieldValues}
        combinedShopifyOnlyFieldNames={combinedShopifyOnlyFieldNames}
        shopifyRequiredFieldNames={shopifyRequiredFieldNames}
        shopifyDrawerRequiredStatus={shopifyDrawerRequiredStatus}
        currentPageShopifyBodyHtml={currentPageShopifyBodyHtml}
        currentPageShopifyTagValues={currentPageShopifyTagValues}
        currentPageShopifyCollectionIds={currentPageShopifyCollectionIds}
        currentPageShopifyCollectionLabelsById={currentPageShopifyCollectionLabelsById}
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
        isShopifyPayloadPreviewContext={isShopifyPayloadPreviewContext}
        shopifyProductSetRequest={shopifyProductSetRequest}
      />

      <ListingApprovalCombinedEbaySection
        selectedRecord={selectedRecord}
        approvedFieldName={approvedFieldName}
        formValues={formValues}
        fieldKinds={fieldKinds}
        listingFormatOptions={listingFormatOptions}
        listingDurationOptions={listingDurationOptions}
        saving={saving}
        setFormValue={setFormValue}
        writableFieldNames={writableFieldNames}
        originalFieldValues={originalFieldValues}
        combinedEbayOnlyFieldNames={combinedEbayOnlyFieldNames}
        ebayRequiredFieldNames={ebayRequiredFieldNames}
        ebayDrawerRequiredStatus={ebayDrawerRequiredStatus}
        combinedEbayGeneratedBodyHtml={combinedEbayGeneratedBodyHtml}
        ebayCategoryLabelsById={ebayCategoryLabelsById}
        setEbayCategoryLabelsById={setEbayCategoryLabelsById}
        setBodyHtmlPreview={setBodyHtmlPreview}
        selectedEbayTemplateId={selectedEbayTemplateId}
        setSelectedEbayTemplateId={setSelectedEbayTemplateId}
        combinedEbayBodyHtmlFieldName={combinedEbayBodyHtmlFieldName}
        combinedEbayBodyHtmlValue={combinedEbayBodyHtmlValue}
        bodyHtmlPreview={bodyHtmlPreview}
        isEbayPayloadPreviewContext={isEbayPayloadPreviewContext}
        ebayDraftPayloadBundle={ebayDraftPayloadBundle}
      />
    </div>
  );
}