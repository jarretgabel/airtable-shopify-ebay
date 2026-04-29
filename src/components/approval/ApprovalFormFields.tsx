import { useCallback, useEffect, useMemo, type ComponentProps } from 'react';
import {
  type EbayListingTemplateId,
  getEbayPriceFieldLabel,
  isEbayPriceFieldAlias,
  isPriceLikeField,
  isReadOnlyApprovalField,
  isTitleLikeField,
  prioritizeTitleBeforePrice,
  toHumanReadableLabel,
} from './approvalFormFieldsBasicHelpers';
import {
  isEbayAdvancedOptionField,
} from './approvalFormFieldsEbayHelpers';
import { ApprovalFormFieldGrid } from './ApprovalFormFieldGrid';
import { ApprovalFormFieldsSupplementalEditors } from './ApprovalFormFieldsSupplementalEditors';
import { useApprovalFormFieldSetup } from './useApprovalFormFieldSetup';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const requiredBadgeClass = 'inline-block rounded-full border border-rose-400/45 bg-rose-500/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-rose-200';

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
  const normalizedRequiredFieldNames = useMemo(
    () => requiredFieldNames.map((fieldName) => fieldName.toLowerCase()),
    [requiredFieldNames],
  );
  const normalizedShopifyRequiredFieldNames = useMemo(
    () => shopifyRequiredFieldNames.map((fieldName) => fieldName.toLowerCase()),
    [shopifyRequiredFieldNames],
  );
  const normalizedEbayRequiredFieldNames = useMemo(
    () => ebayRequiredFieldNames.map((fieldName) => fieldName.toLowerCase()),
    [ebayRequiredFieldNames],
  );
  const hasEbayRequiredPriceField = useMemo(
    () => normalizedEbayRequiredFieldNames.some((fieldName) => isPriceLikeField(fieldName)),
    [normalizedEbayRequiredFieldNames],
  );

  const isShopifyCategoryLikeField = useCallback((fieldName: string): boolean => {
    const normalized = fieldName.trim().toLowerCase();
    return normalized === 'type'
      || normalized === 'shopify type'
      || normalized === 'product type'
      || normalized === 'shopify product type'
      || normalized === 'shopify rest product type'
      || normalized === 'shopify category'
      || normalized === 'shopify product category'
      || normalized === 'shopify rest product category'
      || normalized === 'category'
      || normalized === 'product category';
  }, []);

  const matchesRequiredFieldGroup = useCallback((fieldName: string, normalizedRequiredNames: string[]): boolean => {
    const normalizedFieldName = fieldName.toLowerCase();
    if (normalizedRequiredNames.includes(normalizedFieldName)) return true;

    if (isTitleLikeField(fieldName)) {
      return normalizedRequiredNames.some((requiredFieldName) => isTitleLikeField(requiredFieldName));
    }

    if (isPriceLikeField(fieldName)) {
      return normalizedRequiredNames.some((requiredFieldName) => isPriceLikeField(requiredFieldName));
    }

    if (isShopifyCategoryLikeField(fieldName)) {
      return normalizedRequiredNames.some((requiredFieldName) => isShopifyCategoryLikeField(requiredFieldName));
    }

    return false;
  }, [isShopifyCategoryLikeField]);

  const isForcedEbayPriceRequiredField = useCallback((fieldName: string): boolean => {
    if (!hasEbayRequiredPriceField) return false;
    if (approvalChannel !== 'ebay' && approvalChannel !== 'combined') return false;
    return isEbayPriceFieldAlias(fieldName);
  }, [approvalChannel, hasEbayRequiredPriceField]);

  const isRequiredField = useCallback((fieldName: string): boolean => (
    matchesRequiredFieldGroup(fieldName, normalizedRequiredFieldNames)
    || isForcedEbayPriceRequiredField(fieldName)
  ), [isForcedEbayPriceRequiredField, matchesRequiredFieldGroup, normalizedRequiredFieldNames]);
  const isShopifyRequiredField = useCallback((fieldName: string): boolean => matchesRequiredFieldGroup(fieldName, normalizedShopifyRequiredFieldNames), [matchesRequiredFieldGroup, normalizedShopifyRequiredFieldNames]);
  const isEbayRequiredField = useCallback((fieldName: string): boolean => (
    matchesRequiredFieldGroup(fieldName, normalizedEbayRequiredFieldNames)
    || isForcedEbayPriceRequiredField(fieldName)
  ), [isForcedEbayPriceRequiredField, matchesRequiredFieldGroup, normalizedEbayRequiredFieldNames]);
  const orderedFieldNames = useMemo(() => {
    const required = prioritizeTitleBeforePrice(
      allFieldNames.filter((fieldName) => isRequiredField(fieldName)),
      approvalChannel,
    );
    const optional = prioritizeTitleBeforePrice(
      allFieldNames.filter((fieldName) => !isRequiredField(fieldName)),
      approvalChannel,
    );
    return [...required, ...optional];
  }, [allFieldNames, approvalChannel, isRequiredField]);
  const requiredOrderedFieldNames = useMemo(
    () => orderedFieldNames.filter((fieldName) => isRequiredField(fieldName)),
    [isRequiredField, orderedFieldNames],
  );
  const optionalOrderedFieldNames = useMemo(
    () => orderedFieldNames.filter((fieldName) => !isRequiredField(fieldName)),
    [isRequiredField, orderedFieldNames],
  );
  const ebayAdvancedOptionFieldNames = useMemo(
    () => allFieldNames.filter((fieldName: string) => isEbayAdvancedOptionField(fieldName)),
    [allFieldNames],
  );
  const toFieldLabel = (fieldName: string): string => {
    if (isEbayListingForm && fieldName.trim().toLowerCase() === 'ebay offer price value') {
      return getEbayPriceFieldLabel(ebayListingFormat);
    }

    return toHumanReadableLabel(fieldName);
  };
  const getInputClassName = (fieldName: string, extra?: string): string => {
    const requiredInputClass = isRequiredField(fieldName)
      ? 'border-rose-400/45 bg-rose-500/5 focus:border-rose-300'
      : '';

    return [inputBaseClass, requiredInputClass, extra].filter(Boolean).join(' ');
  };
  const getSelectClassName = (fieldName: string): string => getInputClassName(fieldName, 'appearance-none pr-12');
  const getLabelClassName = (fieldName?: string): string => {
    if (fieldName && isRequiredField(fieldName)) {
      return `${labelClass} text-rose-200`;
    }

    return labelClass;
  };
  const renderRequiredBadges = (fieldName: string): JSX.Element | null => {
    const isShopifyRequired = isShopifyRequiredField(fieldName);
    const isEbayRequired = isEbayRequiredField(fieldName);

    if (!isShopifyRequired && !isEbayRequired) return null;

    if (approvalChannel !== 'combined' && isRequiredField(fieldName)) {
      return <span className={requiredBadgeClass}>Required</span>;
    }

    return (
      <>
        {isShopifyRequired && <span className={requiredBadgeClass}>Shopify Required</span>}
        {isEbayRequired && <span className={requiredBadgeClass}>eBay Required</span>}
      </>
    );
  };
  const renderFieldLabel = (fieldName: string): JSX.Element => (
    <span className={`${getLabelClassName(fieldName)} flex items-center gap-2`}>
      <span>{toFieldLabel(fieldName)}</span>
      {renderRequiredBadges(fieldName)}
    </span>
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

  useEffect(() => {
    onBodyHtmlPreviewChange?.(derivedBodyHtmlPreview);
  }, [derivedBodyHtmlPreview, onBodyHtmlPreviewChange]);

  function renderSpecialLabel(label: string, fieldName?: string): JSX.Element {
    return (
      <span className={`${getLabelClassName(fieldName)} flex items-center gap-2`}>
        <span>{label}</span>
        {fieldName ? renderRequiredBadges(fieldName) : null}
      </span>
    );
  }

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
  const supplementalEditorsProps: ComponentProps<typeof ApprovalFormFieldsSupplementalEditors> = {
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

  return (
    <ApprovalFormFieldGrid
      showOnlyEbayAdvancedOptions={showOnlyEbayAdvancedOptions}
      showEbayAdvancedOptions={approvalChannel === 'ebay' && !hideEbayAdvancedOptions}
      ebayAdvancedOptionFieldNames={ebayAdvancedOptionFieldNames}
      requiredOrderedFieldNames={requiredOrderedFieldNames}
      optionalOrderedFieldNames={optionalOrderedFieldNames}
      pinnedPreDescriptionFieldName={pinnedPreDescriptionFieldName}
      standardFieldProps={standardFieldProps}
      supplementalEditorsProps={supplementalEditorsProps}
    />
  );
}
