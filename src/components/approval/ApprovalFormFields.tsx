import { Suspense, lazy, useEffect, useMemo } from 'react';
import {
  isReadOnlyApprovalField,
} from './approvalFormFieldsSharedHelpers';
import {
  type EbayListingTemplateId,
} from './approvalFormFieldsEbayHelpersBasic';
import {
  isEbayAdvancedOptionField,
} from './approvalFormFieldsEbayHelpers';
import { ApprovalFormFieldGrid } from './ApprovalFormFieldGrid';
import type { ApprovalFormFieldsSupplementalEditorsProps } from './ApprovalFormFieldsSupplementalEditors';
import { useApprovalFormFieldSetup } from './useApprovalFormFieldSetup';
import { useApprovalFormFieldRequirements } from './useApprovalFormFieldRequirements';

const ApprovalFormFieldsSupplementalEditors = lazy(async () => ({
  default: (await import('./ApprovalFormFieldsSupplementalEditors')).ApprovalFormFieldsSupplementalEditors,
}));

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';

interface ApprovalFormFieldsProps {
  recordId?: string;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  forceShowShopifyCollectionsEditor?: boolean;
  isCombinedApproval?: boolean;
  hideEbayAdvancedOptions?: boolean;
  showOnlyEbayAdvancedOptions?: boolean;
  allFieldNames: string[];
  writableFieldNames?: string[];
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
  selectedEbayTemplateId?: string;
  onEbayTemplateIdChange?: (templateId: EbayListingTemplateId) => void;
}

export function ApprovalFormFields({
  recordId,
  approvalChannel,
  forceShowShopifyCollectionsEditor = false,
  isCombinedApproval = false,
  hideEbayAdvancedOptions = false,
  showOnlyEbayAdvancedOptions = false,
  allFieldNames,
  writableFieldNames = [],
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
  suppressImageScalarFields = false,
  originalFieldValues = {},
  normalizedBodyHtmlPreview,
  normalizedShopifyTagValues,
  normalizedShopifyCollectionIds,
  normalizedShopifyCollectionLabelsById = {},
  normalizedEbayCategoryLabelsById = {},
  onEbayCategoryLabelsChange,
  onBodyHtmlPreviewChange,
  selectedEbayTemplateId,
  onEbayTemplateIdChange,
}: ApprovalFormFieldsProps) {
  const ebayAdvancedOptionFieldNames = useMemo(
    () => allFieldNames.filter((fieldName: string) => isEbayAdvancedOptionField(fieldName)),
    [allFieldNames],
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
    ebayInternationalShippingFeesFieldName,
    ebayInternationalShippingFlatFeeFieldName,
    ebayKeyFeaturesFieldName,
    ebayKeyFeaturesSyncFieldNames,
    ebayMarketplaceId,
    ebayPackageTypeOptions,
    ebaySelectedCategoryDisplayValues,
    ebayTestingNotesFieldName,
    effectiveCollectionEditorLabelsById,
    effectiveEbayCategoriesFieldName,
    effectiveShopifyCollectionIds,
    hasCanonicalConditionField,
    hasEbayCategoryEditor,
    hasEbayShippingServicesEditor,
    hasSecondaryEbayCategory,
    hasShopifyCollectionEditor,
    hasShopifyTagEditor,
    imageAltTextSourceField,
    imageUrlSourceField,
    internationalService1FieldName,
    internationalService2FieldName,
    isEbayApprovalForm,
    isEbayListingForm,
    pinnedPreDescriptionFieldName,
    preferredShopifyPriceFieldName,
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
    useCombinedImageAltEditor,
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
    ebayCategoriesFieldName,
    effectiveEbayCategoriesFieldName,
    preferredShopifyPriceFieldName,
    imageUrlSourceField,
    useCombinedImageAltEditor,
    imageAltTextSourceField,
    suppressImageScalarFields,
    hasCanonicalConditionField,
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
    imageUrlSourceField,
    useCombinedImageAltEditor,
    combinedImageEditorValue,
    imageAltTextSourceField,
    shopifyImagePayloadFieldName,
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
    shopifyTagMaxTags: shopifyTagStrategy.writeSingleFields.length > 0 ? shopifyTagStrategy.writeSingleFields.length : undefined,
    hasShopifyCollectionEditor,
    shopifyCollectionsFieldName: shopifyCollectionStrategy.writeCompoundFields[0] ?? shopifyCollectionStrategy.writeSingleFields[0] ?? 'Collections',
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
  };
  const supplementalEditors = (
    <Suspense fallback={<div className="col-span-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)] md:col-span-2">Loading supplemental editors...</div>}>
      <ApprovalFormFieldsSupplementalEditors {...supplementalEditorsProps} />
    </Suspense>
  );

  return (
    <ApprovalFormFieldGrid
      showOnlyEbayAdvancedOptions={showOnlyEbayAdvancedOptions}
      showEbayAdvancedOptions={approvalChannel === 'ebay' && !hideEbayAdvancedOptions}
      ebayAdvancedOptionFieldNames={ebayAdvancedOptionFieldNames}
      requiredOrderedFieldNames={requiredOrderedFieldNames}
      optionalOrderedFieldNames={optionalOrderedFieldNames}
      pinnedPreDescriptionFieldName={pinnedPreDescriptionFieldName}
      standardFieldProps={standardFieldProps}
      supplementalEditors={supplementalEditors}
    />
  );
}
