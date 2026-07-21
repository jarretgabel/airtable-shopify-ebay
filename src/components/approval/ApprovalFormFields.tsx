import { Suspense, lazy, useEffect, useMemo } from 'react';
import { hasWorkflowListingSourceContext } from '@/stores/approval/approvalStoreWorkflowPrefill';
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
import { resolveListingApprovalTestingSectionFields } from './listingApprovalTestingSection';
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
  showSupplementalEditors?: boolean;
  isCombinedApproval?: boolean;
  hideEbayAdvancedOptions?: boolean;
  showOnlyEbayAdvancedOptions?: boolean;
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
  isCombinedApproval = false,
  hideEbayAdvancedOptions = false,
  showOnlyEbayAdvancedOptions = false,
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
