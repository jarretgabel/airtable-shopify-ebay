import { Suspense, lazy } from 'react';
import { EbayShippingServicesEditor } from './EbayShippingServicesEditor';
import { ApprovalFormFieldsShippingEditors } from './ApprovalFormFieldsShippingEditors';
import { ListingApprovalTestingSection, type ListingApprovalTestingSectionField } from './listingApprovalTestingSection';
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
  recordId?: string;
  imageUrlSourceField?: string;
  useCombinedImageAltEditor: boolean;
  combinedImageEditorValue: string;
  imageAltTextSourceField?: string;
  shopifyImagePayloadFieldName?: string;
  workflowImageAttachments: WorkflowListingImageAttachment[];
  selectedWorkflowImageUrls: string[];
  formValues: Record<string, string>;
  testingSectionValues?: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  saving: boolean;
  isReadOnlyApprovalField: (fieldName: string) => boolean;
  workflowManagedListingContent: boolean;
  testingSectionFields: ListingApprovalTestingSectionField[];
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
  onOpenOperationalRecord?: (recordId: string) => void;
  onOpenTestingForm?: (recordId: string) => void;
  onOpenPhotosForm?: (recordId: string) => void;
  renderFieldLabel: (fieldName: string) => JSX.Element;
  getSelectClassName: (fieldName: string) => string;
  getInputClassName: (fieldName: string, extraClassName?: string) => string;
}

const iconActionButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white/5 text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-white/10 hover:text-[var(--ink)]';

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5">
      <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L6 12H4v-2l7.5-7.5Z" />
      <path d="M10.5 3.5l2 2" />
    </svg>
  );
}

export function ApprovalFormFieldsSupplementalEditors({
  recordId,
  imageUrlSourceField,
  imageAltTextSourceField,
  shopifyImagePayloadFieldName,
  workflowImageAttachments,
  selectedWorkflowImageUrls,
  formValues,
  testingSectionValues,
  setFormValue,
  saving,
  isReadOnlyApprovalField,
  workflowManagedListingContent,
  testingSectionFields,
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
  onOpenOperationalRecord,
  onOpenTestingForm,
  onOpenPhotosForm,
  renderFieldLabel,
  getSelectClassName,
  getInputClassName,
}: ApprovalFormFieldsSupplementalEditorsProps) {
  const hasTestingSection = testingSectionFields.length > 0;
  const effectiveTestingSectionValues = testingSectionValues ?? formValues;
  const workflowHeaderAction = recordId && workflowManagedListingContent && onOpenOperationalRecord ? (
    <button
      type="button"
      className={iconActionButtonClass}
      onClick={() => onOpenOperationalRecord(recordId)}
      aria-label="Edit workflow source record"
      title="Edit workflow source record"
    >
      <EditIcon />
    </button>
  ) : null;
  const testingHeaderAction = recordId && onOpenTestingForm ? (
    <button
      type="button"
      className={iconActionButtonClass}
      onClick={() => onOpenTestingForm(recordId)}
      aria-label="Edit testing form"
      title="Edit testing form"
    >
      <EditIcon />
    </button>
  ) : null;
  const imageSourceActions = recordId ? (
    <>
      {onOpenTestingForm && (
        <button type="button" className={iconActionButtonClass} onClick={() => onOpenTestingForm(recordId)} aria-label="Edit testing form" title="Edit testing form">
          <EditIcon />
        </button>
      )}
      {onOpenPhotosForm && (
        <button type="button" className={iconActionButtonClass} onClick={() => onOpenPhotosForm(recordId)} aria-label="Edit photos form" title="Edit photos form">
          <EditIcon />
        </button>
      )}
    </>
  ) : null;

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
          sourceActions={imageSourceActions}
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
            disabled={saving || workflowManagedListingContent}
            helperText={workflowManagedListingContent
              ? 'Read-only listing details derived from the Testing form and workflow fields. Update the Testing form to change these values.'
              : undefined}
            headerAction={workflowHeaderAction}
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
            disabled={saving || workflowManagedListingContent}
            helperText={workflowManagedListingContent
              ? 'Read-only listing details derived from the Testing form and workflow fields. Update the Testing form to change these values.'
              : undefined}
            headerAction={workflowHeaderAction}
          />
        </Suspense>
      )}

      {hasTestingSection && (
        <ListingApprovalTestingSection fields={testingSectionFields} formValues={effectiveTestingSectionValues} headerAction={testingHeaderAction} />
      )}

      {ebayTestingNotesFieldName && !hasTestingSection && (
        <Suspense fallback={lazyEditorFallback}>
          <TestingNotesTextareaEditor
            fieldName={ebayTestingNotesFieldName}
            value={formValues[ebayTestingNotesFieldName] ?? ''}
            setFormValue={setFormValue}
            disabled={saving || workflowManagedListingContent}
            label="Testing Notes"
            helperText={workflowManagedListingContent
              ? 'Read-only mirror of the Testing form notes. Update the Testing form to change this value.'
              : undefined}
            placeholder={workflowManagedListingContent
              ? 'Testing form notes will appear here after the workflow fields are loaded.'
              : undefined}
            headerAction={workflowManagedListingContent ? testingHeaderAction : null}
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

      {isEbayApprovalForm && (
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
      )}

      {isEbayApprovalForm && hasEbayShippingServicesEditor && (
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