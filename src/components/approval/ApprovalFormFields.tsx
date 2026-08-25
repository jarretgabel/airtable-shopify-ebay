import { Suspense, lazy, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { hasWorkflowListingSourceContext } from '@/stores/approval/approvalStoreWorkflowPrefill';
import {
  isReadOnlyApprovalField,
} from './approvalFormFieldsSharedHelpers';
import {
  type EbayListingTemplateId,
} from './approvalFormFieldsEbayHelpersBasic';
import {
  EBAY_BODY_ABOUT_DEFAULT_TEXT,
  EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD,
  EBAY_BODY_DESCRIPTION_FALLBACK_EDITOR_FIELD,
} from './listingApprovalEbayConstants';
import {
  isEbayAdvancedOptionField,
} from './approvalFormFieldsEbayHelpers';
import { EbayTemplateCopyWysiwygEditor } from './EbayTemplateCopyWysiwygEditor';
import { ApprovalFormFieldGrid } from './ApprovalFormFieldGrid';
import type { ApprovalFormFieldsSupplementalEditorsProps } from './ApprovalFormFieldsSupplementalEditors';
import { resolveListingApprovalTestingSectionFields } from './listingApprovalTestingSection';
import { useApprovalFormFieldSetup } from './useApprovalFormFieldSetup';
import { useApprovalFormFieldRequirements } from './useApprovalFormFieldRequirements';

const ApprovalFormFieldsSupplementalEditors = lazy(async () => ({
  default: (await import('./ApprovalFormFieldsSupplementalEditors')).ApprovalFormFieldsSupplementalEditors,
}));

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';

const EBAY_DESCRIPTION_EDITOR_DEFAULT_HTML = [
  '<p style="margin:0 0 12px;text-align:center;color:#cc0000;"><strong>SOLD AS-IS</strong></p>',
  '<p style="margin:0 0 12px;text-align:center;color:#cc0000;"><strong>LIST OF DEFECTS IS NOT EXHAUSTIVE - THERE MAY BE ADDITIONAL DEFECTS</strong></p>',
  '<p style="margin:0 0 14px;text-align:center;color:#cc0000;"><strong>NO RETURNS UNDER ANY CIRCUMSTANCES</strong></p>',
  '<p style="margin:0 0 14px;text-align:center;color:#0a3f3f;"><strong>Salvaged from a salt-water flooded warehouse. Considerable rust and corrosion. Please see all high resolution photographs below.</strong></p>',
  '<p style="margin:0 0 12px;color:#111111;"><strong>All items included are pictured.</strong></p>',
  '<p style="margin:0;color:#cc0000;"><strong>Local Pickup in NYC Available</strong></p>',
].join('');

function isGenericDescriptionFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'description' || normalized === 'item description';
}

function isEffectivelyEmptyHtml(value: string): boolean {
  const withoutTags = value
    .replace(/<br\s*\/?\s*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return withoutTags.length === 0;
}

interface ApprovalFormFieldsProps {
  recordId?: string;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  forceShowShopifyCollectionsEditor?: boolean;
  showSupplementalEditors?: boolean;
  showWorkflowImageSelector?: boolean;
  isCombinedApproval?: boolean;
  hideEbayAdvancedOptions?: boolean;
  showOnlyEbayAdvancedOptions?: boolean;
  ebayAdvancedOptionsExtraContent?: ReactNode;
  allFieldNames: string[];
  writableFieldNames?: string[];
  readOnlyFieldNames?: string[];
  requiredFieldNames?: string[];
  shopifyRequiredFieldNames?: string[];
  ebayRequiredFieldNames?: string[];
  approvedFieldName: string;
  formValues: Record<string, string>;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  listingFormatOptions: string[];
  listingDurationOptions?: string[];
  saving: boolean;
  setFormValue: (fieldName: string, value: string) => void;
  setDerivedFormValue: (fieldName: string, value: string) => void;
  suppressImageScalarFields?: boolean;
  originalFieldValues?: Record<string, string>;
  showBodyHtmlPreview?: boolean;
  normalizedBodyHtmlPreview?: string;
  normalizedShopifyTagValues?: string[];
  normalizedShopifyCollectionIds?: string[];
  normalizedShopifyCollectionLabelsById?: Record<string, string>;
  normalizedEbayCategoryLabelsById?: Record<string, string>;
  onEbayCategoryLabelsChange?: (labelsById: Record<string, string>) => void;
  onBodyHtmlPreviewChange?: (value: string) => void;
  onOpenOperationalRecord?: (recordId: string) => void;
  onOpenTestingForm?: (recordId: string) => void;
  onOpenPhotosForm?: (recordId: string) => void;
  selectedEbayTemplateId?: string;
  onEbayTemplateIdChange?: (templateId: EbayListingTemplateId) => void;
}

export function ApprovalFormFields({
  recordId,
  approvalChannel,
  forceShowShopifyCollectionsEditor = false,
  showSupplementalEditors = true,
  showWorkflowImageSelector = true,
  isCombinedApproval = false,
  hideEbayAdvancedOptions = false,
  showOnlyEbayAdvancedOptions = false,
  ebayAdvancedOptionsExtraContent,
  allFieldNames,
  writableFieldNames = [],
  readOnlyFieldNames = [],
  requiredFieldNames = [],
  shopifyRequiredFieldNames = [],
  ebayRequiredFieldNames = [],
  approvedFieldName,
  formValues,
  fieldKinds,
  listingFormatOptions,
  listingDurationOptions = [],
  saving,
  setFormValue,
  setDerivedFormValue,
  suppressImageScalarFields = false,
  originalFieldValues = {},
  normalizedBodyHtmlPreview,
  normalizedShopifyTagValues,
  normalizedShopifyCollectionIds,
  normalizedShopifyCollectionLabelsById = {},
  normalizedEbayCategoryLabelsById = {},
  onEbayCategoryLabelsChange,
  onBodyHtmlPreviewChange,
  onOpenOperationalRecord,
  onOpenTestingForm,
  onOpenPhotosForm,
  selectedEbayTemplateId,
  onEbayTemplateIdChange,
}: ApprovalFormFieldsProps) {
  const ebayAdvancedOptionFieldNames = useMemo(
    () => allFieldNames.filter((fieldName: string) => isEbayAdvancedOptionField(fieldName)),
    [allFieldNames],
  );
  const workflowManagedListingContent = useMemo(
    () => hasWorkflowListingSourceContext(originalFieldValues),
    [originalFieldValues],
  );
  const testingSectionValues = useMemo(
    () => ({ ...originalFieldValues, ...formValues }),
    [formValues, originalFieldValues],
  );
  const testingSectionFields = useMemo(
    () => (approvalChannel === 'combined' || isCombinedApproval
      ? []
      : resolveListingApprovalTestingSectionFields(Array.from(new Set([
        ...allFieldNames,
        ...writableFieldNames,
        ...Object.keys(testingSectionValues),
      ])))),
    [allFieldNames, approvalChannel, isCombinedApproval, testingSectionValues, writableFieldNames],
  );
  const testingSectionFieldNames = useMemo(
    () => testingSectionFields.map((field) => field.fieldName),
    [testingSectionFields],
  );

  const {
    activeBodyDescriptionFieldName,
    combinedImageEditorValue,
    derivedBodyHtmlPreview,
    domesticService1FieldName,
    domesticService2FieldName,
    ebayAttributesCandidateFieldNames,
    ebayAttributesFieldName,
    ebayAttributesSyncFieldNames,
    ebayBodyDescriptionFieldName,
    ebayBodyHtmlFieldName,
    ebayBodyHtmlTemplateFieldName,
    ebayCategoriesFieldName,
    ebayDomesticShippingFeesFieldName,
    ebayDomesticShippingFlatFeeFieldName,
    ebayFormatFieldName,
    ebayFulfillmentPolicyFieldName,
    ebayInternationalShippingFeesFieldName,
    ebayInternationalShippingFlatFeeFieldName,
    ebayKeyFeaturesFieldName,
    ebayPaymentPolicyFieldName,
    ebayKeyFeaturesSyncFieldNames,
    ebayMarketplaceId,
    ebayPackageTypeOptions,
    ebayReturnPolicyFieldName,
    ebaySelectedCategoryDisplayValues,
    ebayTestingNotesFieldName,
    effectiveCollectionEditorLabelsById,
    effectiveEbayCategoriesFieldName,
    effectiveShopifyCollectionIds,
    hasCanonicalConditionField,
    hasEbayCategoryEditor,
    hasEbayBusinessPoliciesEditor,
    hasEbayShippingServicesEditor,
    hasSecondaryEbayCategory,
    hasShopifyCollectionEditor,
    hasShopifyTagEditor,
    hasShopifyVendorEditor,
    imageAltTextSourceField,
    imageUrlSourceField,
    internationalService1FieldName,
    internationalService2FieldName,
    isEbayApprovalForm,
    isEbayListingForm,
    pinnedPreDescriptionFieldName,
    preferredShopifyPriceFieldName,
    selectedWorkflowImageUrls,
    setEbayCategoryIds,
    setShopifyCollectionIds,
    setShopifyTagValues,
    shopifyBodyDescriptionFieldName,
    shopifyBodyHtmlFieldName,
    shopifyBodyHtmlTemplateFieldName,
    shopifyCollectionStrategy,
    shopifyImagePayloadFieldName,
    shopifyKeyFeaturesFieldName,
    shopifyKeyFeaturesSyncFieldNames,
    shopifyTagStrategy,
    shopifyTagValues,
    shopifyVendorDefaultValue,
    shopifyVendorFieldName,
    useCombinedImageAltEditor,
    workflowImageAttachments,
  } = useApprovalFormFieldSetup({
    recordId,
    approvalChannel,
    forceShowShopifyCollectionsEditor,
    isCombinedApproval,
    allFieldNames,
    writableFieldNames,
    formValues,
    fieldKinds,
    originalFieldValues,
    normalizedBodyHtmlPreview,
    normalizedShopifyTagValues,
    normalizedShopifyCollectionIds,
    normalizedShopifyCollectionLabelsById,
    setFormValue,
    setDerivedFormValue,
    selectedEbayTemplateId,
    onEbayTemplateIdChange,
  });
  const ebayListingFormat = ebayFormatFieldName ? (formValues[ebayFormatFieldName] ?? '') : '';
  const {
    isRequiredField,
    optionalOrderedFieldNames,
    renderFieldLabel,
    renderSpecialLabel,
    requiredOrderedFieldNames,
    toFieldLabel,
  } = useApprovalFormFieldRequirements({
    approvalChannel,
    allFieldNames,
    requiredFieldNames,
    shopifyRequiredFieldNames,
    ebayRequiredFieldNames,
    isEbayListingForm,
    ebayListingFormat,
  });

  const getInputClassName = (fieldName: string, extra?: string): string => {
    const requiredInputClass = isRequiredField(fieldName)
      ? 'border-rose-400/45 bg-rose-500/5 focus:border-rose-300'
      : '';

    return [inputBaseClass, requiredInputClass, extra].filter(Boolean).join(' ');
  };
  const getSelectClassName = (fieldName: string): string => getInputClassName(fieldName, 'appearance-none pr-12');

  useEffect(() => {
    onBodyHtmlPreviewChange?.(derivedBodyHtmlPreview);
  }, [derivedBodyHtmlPreview, onBodyHtmlPreviewChange]);

  const standardFieldProps = {
    showWorkflowImageSelector,
    approvalChannel,
    isCombinedApproval,
    allFieldNames,
    hasEbayShippingServicesEditor,
    approvedFieldName,
    hasShopifyTagEditor,
    hasShopifyCollectionEditor,
    shopifyBodyDescriptionFieldName,
    ebayBodyDescriptionFieldName,
    shopifyBodyHtmlFieldName,
    shopifyBodyHtmlTemplateFieldName,
    ebayBodyHtmlFieldName,
    ebayBodyHtmlTemplateFieldName,
    shopifyKeyFeaturesFieldName,
    ebayKeyFeaturesFieldName,
    ebayTestingNotesFieldName,
    ebayAttributesCandidateFieldNames,
    hasEbayCategoryEditor,
    hasEbayBusinessPoliciesEditor,
    ebayFulfillmentPolicyFieldName,
    ebayPaymentPolicyFieldName,
    ebayReturnPolicyFieldName,
    ebayCategoriesFieldName,
    effectiveEbayCategoriesFieldName,
    preferredShopifyPriceFieldName,
    imageUrlSourceField,
    useCombinedImageAltEditor,
    imageAltTextSourceField,
    suppressImageScalarFields,
    hasCanonicalConditionField,
    testingSectionFieldNames,
    readOnlyFieldNames,
    formValues,
    fieldKinds,
    saving,
    listingFormatOptions,
    listingDurationOptions,
    ebayPackageTypeOptions,
    setFormValue,
    isRequiredField,
    renderFieldLabel,
    toFieldLabel,
    getSelectClassName,
    getInputClassName,
  };
  const supplementalEditorsProps: ApprovalFormFieldsSupplementalEditorsProps = {
    showWorkflowImageSelector,
    imageUrlSourceField,
    useCombinedImageAltEditor,
    combinedImageEditorValue,
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
    ebayBodyHtmlFieldName: approvalChannel === 'ebay' ? undefined : ebayBodyHtmlFieldName,
    ebayAttributesFieldName,
    ebayAttributesSyncFieldNames,
    ebayDomesticShippingFeesFieldName,
    ebayInternationalShippingFeesFieldName,
    ebayDomesticShippingFlatFeeFieldName,
    ebayInternationalShippingFlatFeeFieldName,
    hasEbayBusinessPoliciesEditor,
    ebayFulfillmentPolicyFieldName,
    ebayPaymentPolicyFieldName,
    ebayReturnPolicyFieldName,
    ebayMarketplaceId,
    hasEbayShippingServicesEditor,
    domesticService1FieldName,
    domesticService2FieldName,
    internationalService1FieldName,
    internationalService2FieldName,
    hasShopifyTagEditor,
    shopifyTagValues,
    setShopifyTagValues,
    shopifyTagMaxTags: shopifyTagStrategy.writeSingleFields.length > 0 ? shopifyTagStrategy.writeSingleFields.length : undefined,
    hasShopifyCollectionEditor,
    hasShopifyVendorEditor,
    shopifyVendorFieldName,
    shopifyVendorValue: shopifyVendorFieldName ? (formValues[shopifyVendorFieldName] ?? '') : '',
    shopifyVendorDefaultValue,
    setShopifyVendorValue: (nextVendor: string) => {
      if (!shopifyVendorFieldName) return;
      setFormValue(shopifyVendorFieldName, nextVendor);
    },
    shopifyCollectionsFieldName: shopifyCollectionStrategy.writeCompoundFields[0] ?? shopifyCollectionStrategy.writeSingleFields[0] ?? 'Collections',
    effectiveShopifyCollectionIds,
    effectiveCollectionEditorLabelsById,
    setShopifyCollectionIds,
    hasEbayCategoryEditor,
    effectiveEbayCategoriesFieldName,
    ebaySelectedCategoryDisplayValues,
    normalizedEbayCategoryLabelsById,
    setEbayCategoryIds,
    onEbayCategoryLabelsChange,
    hasSecondaryEbayCategory,
    recordId,
    onOpenOperationalRecord,
    onOpenTestingForm,
    onOpenPhotosForm,
    renderFieldLabel,
    getSelectClassName,
    getInputClassName,
  };
  const supplementalEditors = showSupplementalEditors ? (
    <Suspense fallback={<div className="col-span-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)] md:col-span-2">Loading supplemental editors...</div>}>
      <ApprovalFormFieldsSupplementalEditors {...supplementalEditorsProps} />
    </Suspense>
  ) : null;

  const editableEbayDescriptionFieldName = approvalChannel === 'ebay'
    ? (
      ebayBodyDescriptionFieldName && !isGenericDescriptionFieldName(ebayBodyDescriptionFieldName)
        ? ebayBodyDescriptionFieldName
        : EBAY_BODY_DESCRIPTION_FALLBACK_EDITOR_FIELD
    )
    : '';

  const hasDetectedEbayDescriptionField = approvalChannel === 'ebay'
    && editableEbayDescriptionFieldName !== EBAY_BODY_DESCRIPTION_FALLBACK_EDITOR_FIELD;

  const fallbackEbayDescriptionSeed = useMemo(() => {
    if (approvalChannel !== 'ebay' || hasDetectedEbayDescriptionField) return '';
    return EBAY_DESCRIPTION_EDITOR_DEFAULT_HTML;
  }, [approvalChannel, hasDetectedEbayDescriptionField]);

  const editableEbayDescriptionValue = hasDetectedEbayDescriptionField
    ? (formValues[editableEbayDescriptionFieldName] || fallbackEbayDescriptionSeed || EBAY_DESCRIPTION_EDITOR_DEFAULT_HTML)
    : (formValues[editableEbayDescriptionFieldName] || fallbackEbayDescriptionSeed || EBAY_DESCRIPTION_EDITOR_DEFAULT_HTML);
  const editableEbayAboutRawValue = formValues[EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD] ?? '';
  const editableEbayAboutValue = isEffectivelyEmptyHtml(editableEbayAboutRawValue)
    ? EBAY_BODY_ABOUT_DEFAULT_TEXT
    : editableEbayAboutRawValue;

  const effectiveEbayAdvancedOptionsExtraContent = ebayAdvancedOptionsExtraContent
    ?? (approvalChannel === 'ebay' ? (
      <div className="space-y-3">
        <EbayTemplateCopyWysiwygEditor
          fieldName={editableEbayDescriptionFieldName}
          value={editableEbayDescriptionValue}
          setFormValue={setFormValue}
          disabled={saving || (hasDetectedEbayDescriptionField && isReadOnlyApprovalField(editableEbayDescriptionFieldName))}
          label="Advanced: eBay Template Copy"
          helperText={hasDetectedEbayDescriptionField
            ? 'WYSIWYG editor for eBay description copy. Edit only the description content shown in the listing.'
            : 'WYSIWYG editor for eBay description copy. This record has no detected description field, so this editor is preloaded from Body HTML and edits may not persist to Airtable.'}
        />

        <EbayTemplateCopyWysiwygEditor
          fieldName={EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD}
          value={editableEbayAboutValue}
          setFormValue={setFormValue}
          disabled={saving}
          label="Advanced: HEAA About Copy"
          helperText={'WYSIWYG editor for the "About" copy shown below the details tables in the rendered eBay body.'}
        />
      </div>
    ) : undefined);

  return (
    <ApprovalFormFieldGrid
      showOnlyEbayAdvancedOptions={showOnlyEbayAdvancedOptions}
      showEbayAdvancedOptions={approvalChannel === 'ebay' && !hideEbayAdvancedOptions}
      ebayAdvancedOptionFieldNames={ebayAdvancedOptionFieldNames}
      ebayAdvancedOptionsExtraContent={effectiveEbayAdvancedOptionsExtraContent}
      requiredOrderedFieldNames={requiredOrderedFieldNames}
      optionalOrderedFieldNames={optionalOrderedFieldNames}
      pinnedPreDescriptionFieldName={pinnedPreDescriptionFieldName}
      standardFieldProps={standardFieldProps}
      supplementalEditors={supplementalEditors}
    />
  );
}
