import { Suspense, lazy } from 'react';
import { EbayShippingServicesEditor } from './EbayShippingServicesEditor';
import { ApprovalFormFieldsShippingEditors } from './ApprovalFormFieldsShippingEditors';
import { ShopifyTagsEditor } from './ShopifyTagsEditor';
import { WorkflowListingImageSelector } from './WorkflowListingImageSelector';
import {
  buildWorkflowListingImageSelectionValues,
  parseWorkflowSelectedImageRows,
  type WorkflowListingImageAttachment,
} from './workflowListingImageHelpers';

const EbayAttributesEditor = lazy(async () => ({
  default: (await import('./EbayAttributesEditor')).EbayAttributesEditor,
}));
const EbayCategoriesSelect = lazy(async () => ({
  default: (await import('./EbayCategoriesSelect')).EbayCategoriesSelect,
}));
const KeyFeaturesEditor = lazy(async () => ({
  default: (await import('./KeyFeaturesEditor')).KeyFeaturesEditor,
}));
const ShopifyCollectionsSelect = lazy(async () => ({
  default: (await import('./ShopifyCollectionsSelect')).ShopifyCollectionsSelect,
}));
const TestingNotesTextareaEditor = lazy(async () => ({
  default: (await import('./TestingNotesTextareaEditor')).TestingNotesTextareaEditor,
}));

const lazyEditorFallback = (
  <div className="col-span-1 rounded-xl border border-[var(--line)] bg-white/5 px-4 py-3 text-sm text-[var(--muted)] md:col-span-2">
    Loading editor...
  </div>
);

export interface ApprovalFormFieldsSupplementalEditorsProps {
  imageUrlSourceField?: string;
  useCombinedImageAltEditor: boolean;
  combinedImageEditorValue: string;
  imageAltTextSourceField?: string;
  shopifyImagePayloadFieldName?: string;
  workflowImageAttachments: WorkflowListingImageAttachment[];
  selectedWorkflowImageUrls: string[];
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  saving: boolean;
  isReadOnlyApprovalField: (fieldName: string) => boolean;
  activeBodyDescriptionFieldName?: string;
  renderSpecialLabel: (label: string, fieldName?: string) => JSX.Element;
  inputBaseClass: string;
  isEbayApprovalForm: boolean;
  shopifyKeyFeaturesFieldName?: string;
  shopifyKeyFeaturesSyncFieldNames: string[];
  ebayKeyFeaturesFieldName?: string;
  ebayKeyFeaturesSyncFieldNames: string[];
  ebayTestingNotesFieldName?: string;
  ebayAttributesFieldName?: string;
  ebayAttributesSyncFieldNames: string[];
  ebayDomesticShippingFeesFieldName?: string;
  ebayInternationalShippingFeesFieldName?: string;
  ebayDomesticShippingFlatFeeFieldName: string;
  ebayInternationalShippingFlatFeeFieldName: string;
  hasEbayShippingServicesEditor: boolean;
  domesticService1FieldName?: string;
  domesticService2FieldName?: string;
  internationalService1FieldName?: string;
  internationalService2FieldName?: string;
  hasShopifyTagEditor: boolean;
  shopifyTagValues: string[];
  setShopifyTagValues: (nextTags: string[]) => void;
  shopifyTagMaxTags?: number;
  hasShopifyCollectionEditor: boolean;
  shopifyCollectionsFieldName: string;
  effectiveShopifyCollectionIds: string[];
  effectiveCollectionEditorLabelsById: Record<string, string>;
  setShopifyCollectionIds: (nextCollectionIds: string[], collectionLabelsById?: Record<string, string>) => void;
  hasEbayCategoryEditor: boolean;
  effectiveEbayCategoriesFieldName: string;
  ebayMarketplaceId: string;
  ebaySelectedCategoryDisplayValues: string[];
  normalizedEbayCategoryLabelsById: Record<string, string>;
  setEbayCategoryIds: (nextIds: string[]) => void;
  onEbayCategoryLabelsChange?: (labelsById: Record<string, string>) => void;
  hasSecondaryEbayCategory: boolean;
  renderFieldLabel: (fieldName: string) => JSX.Element;
  getSelectClassName: (fieldName: string) => string;
  getInputClassName: (fieldName: string, extraClassName?: string) => string;
}

export function ApprovalFormFieldsSupplementalEditors({
  imageUrlSourceField,
  imageAltTextSourceField,
  shopifyImagePayloadFieldName,
  workflowImageAttachments,
  selectedWorkflowImageUrls,
  formValues,
  setFormValue,
  saving,
  isReadOnlyApprovalField,
  activeBodyDescriptionFieldName,
  renderSpecialLabel,
  inputBaseClass,
  isEbayApprovalForm,
  shopifyKeyFeaturesFieldName,
  shopifyKeyFeaturesSyncFieldNames,
  ebayKeyFeaturesFieldName,
  ebayKeyFeaturesSyncFieldNames,
  ebayTestingNotesFieldName,
  ebayAttributesFieldName,
  ebayAttributesSyncFieldNames,
  ebayDomesticShippingFeesFieldName,
  ebayInternationalShippingFeesFieldName,
  ebayDomesticShippingFlatFeeFieldName,
  ebayInternationalShippingFlatFeeFieldName,
  hasEbayShippingServicesEditor,
  domesticService1FieldName,
  domesticService2FieldName,
  internationalService1FieldName,
  internationalService2FieldName,
  hasShopifyTagEditor,
  shopifyTagValues,
  setShopifyTagValues,
  shopifyTagMaxTags,
  hasShopifyCollectionEditor,
  shopifyCollectionsFieldName,
  effectiveShopifyCollectionIds,
  effectiveCollectionEditorLabelsById,
  setShopifyCollectionIds,
  hasEbayCategoryEditor,
  effectiveEbayCategoriesFieldName,
  ebayMarketplaceId,
  ebaySelectedCategoryDisplayValues,
  normalizedEbayCategoryLabelsById,
  setEbayCategoryIds,
  onEbayCategoryLabelsChange,
  hasSecondaryEbayCategory,
  renderFieldLabel,
  getSelectClassName,
  getInputClassName,
}: ApprovalFormFieldsSupplementalEditorsProps) {
  return (
    <>
      {imageUrlSourceField && (
        <WorkflowListingImageSelector
          attachments={workflowImageAttachments}
          selectedUrls={selectedWorkflowImageUrls}
          onSelectionChange={(nextSelectedUrls) => {
            const currentRows = parseWorkflowSelectedImageRows(
              formValues[imageUrlSourceField] ?? '',
              imageAltTextSourceField ? (formValues[imageAltTextSourceField] ?? '') : '',
              shopifyImagePayloadFieldName ? (formValues[shopifyImagePayloadFieldName] ?? '') : '',
            );
            const nextValues = buildWorkflowListingImageSelectionValues({
              selectedUrls: nextSelectedUrls,
              attachments: workflowImageAttachments,
              currentRows,
            });

            setFormValue(imageUrlSourceField, nextValues.imageValue);
            if (imageAltTextSourceField) {
              setFormValue(imageAltTextSourceField, nextValues.imageAltTextValue);
            }
            if (shopifyImagePayloadFieldName && shopifyImagePayloadFieldName !== imageUrlSourceField) {
              setFormValue(shopifyImagePayloadFieldName, nextValues.shopifyImagePayloadValue);
            }
          }}
          disabled={saving || isReadOnlyApprovalField(imageUrlSourceField)}
        />
      )}

      {activeBodyDescriptionFieldName && (
        <label className="col-span-1 flex flex-col gap-2 md:col-span-2">
          {renderSpecialLabel('Description', activeBodyDescriptionFieldName)}
          <textarea
            className={`${inputBaseClass} min-h-[110px] resize-y leading-[1.4]`}
            value={formValues[activeBodyDescriptionFieldName] ?? ''}
            onChange={(event) => setFormValue(activeBodyDescriptionFieldName, event.target.value)}
            placeholder={isEbayApprovalForm
              ? 'Listing description saved to Airtable Description and mirrored into Body HTML'
              : 'Short product description used in listing body HTML'}
            disabled={saving}
          />
        </label>
      )}

      {shopifyKeyFeaturesFieldName && (
        <Suspense fallback={lazyEditorFallback}>
          <KeyFeaturesEditor
            keyFeaturesFieldName={shopifyKeyFeaturesFieldName}
            keyFeaturesValue={formValues[shopifyKeyFeaturesFieldName] ?? ''}
            setFormValue={setFormValue}
            syncFieldNames={shopifyKeyFeaturesSyncFieldNames}
            disabled={saving}
          />
        </Suspense>
      )}

      {ebayKeyFeaturesFieldName && (
        <Suspense fallback={lazyEditorFallback}>
          <KeyFeaturesEditor
            keyFeaturesFieldName={ebayKeyFeaturesFieldName}
            keyFeaturesValue={formValues[ebayKeyFeaturesFieldName] ?? ''}
            setFormValue={setFormValue}
            syncFieldNames={ebayKeyFeaturesSyncFieldNames}
            disabled={saving}
          />
        </Suspense>
      )}

      {ebayTestingNotesFieldName && (
        <Suspense fallback={lazyEditorFallback}>
          <TestingNotesTextareaEditor
            fieldName={ebayTestingNotesFieldName}
            value={formValues[ebayTestingNotesFieldName] ?? ''}
            setFormValue={setFormValue}
            disabled={saving}
            label="Testing Notes"
          />
        </Suspense>
      )}

      {ebayAttributesFieldName && (
        <Suspense fallback={lazyEditorFallback}>
          <EbayAttributesEditor
            fieldName={ebayAttributesFieldName}
            value={formValues[ebayAttributesFieldName] ?? ''}
            setFormValue={setFormValue}
            syncFieldNames={ebayAttributesSyncFieldNames}
            disabled={saving}
            label="Attributes"
          />
        </Suspense>
      )}

      <ApprovalFormFieldsShippingEditors
        formValues={formValues}
        setFormValue={setFormValue}
        saving={saving}
        isReadOnlyApprovalField={isReadOnlyApprovalField}
        renderSpecialLabel={renderSpecialLabel}
        renderFieldLabel={renderFieldLabel}
        getSelectClassName={getSelectClassName}
        getInputClassName={getInputClassName}
        ebayDomesticShippingFeesFieldName={ebayDomesticShippingFeesFieldName}
        ebayInternationalShippingFeesFieldName={ebayInternationalShippingFeesFieldName}
        ebayDomesticShippingFlatFeeFieldName={ebayDomesticShippingFlatFeeFieldName}
        ebayInternationalShippingFlatFeeFieldName={ebayInternationalShippingFlatFeeFieldName}
      />

      {hasEbayShippingServicesEditor && (
        <EbayShippingServicesEditor
          domesticService1FieldName={domesticService1FieldName}
          domesticService2FieldName={domesticService2FieldName}
          internationalService1FieldName={internationalService1FieldName}
          internationalService2FieldName={internationalService2FieldName}
          values={formValues}
          setFormValue={setFormValue}
          disabled={saving}
        />
      )}

      {hasShopifyTagEditor && (
        <ShopifyTagsEditor
          tags={shopifyTagValues}
          onChange={setShopifyTagValues}
          disabled={saving}
          maxTags={shopifyTagMaxTags}
        />
      )}

      {hasShopifyCollectionEditor && (
        <Suspense fallback={lazyEditorFallback}>
          <ShopifyCollectionsSelect
            fieldName={shopifyCollectionsFieldName}
            label="Collections"
            value={effectiveShopifyCollectionIds}
            labelsById={effectiveCollectionEditorLabelsById}
            onChange={setShopifyCollectionIds}
            disabled={saving}
          />
        </Suspense>
      )}

      {hasEbayCategoryEditor && (
        <Suspense fallback={lazyEditorFallback}>
          <EbayCategoriesSelect
            fieldName={effectiveEbayCategoriesFieldName}
            label="eBay Categories"
            marketplaceId={ebayMarketplaceId}
            value={ebaySelectedCategoryDisplayValues}
            labelsById={normalizedEbayCategoryLabelsById}
            onChange={(nextIds, labelsById) => {
              setEbayCategoryIds(nextIds);
              if (labelsById) {
                onEbayCategoryLabelsChange?.(labelsById);
              }
            }}
            disabled={saving}
            helperWarning={hasSecondaryEbayCategory ? (
              <span className="text-xs font-semibold text-rose-300">
                Adding a second category incurrs extra fees
              </span>
            ) : null}
          />
        </Suspense>
      )}
    </>
  );
}