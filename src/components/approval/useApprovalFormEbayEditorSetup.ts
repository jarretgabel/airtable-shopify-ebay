import { useEffect, useMemo, useState } from 'react';
import { getEbayPackageTypes } from '@/services/app-api/ebay';
import {
  DEFAULT_EBAY_LISTING_TEMPLATE_ID,
  type EbayListingTemplateId,
  isEbayAttributesField,
  isEbayBodyDescriptionField,
  isEbayBodyHtmlField,
  isEbayBodyHtmlTemplateField,
  isEbayKeyFeaturesField,
  isEbayTestingNotesField,
  isGenericSharedKeyFeaturesField,
  normalizeEbayListingTemplateId,
} from './approvalFormFieldsBasicHelpers';
import {
  SYNTHETIC_EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD,
  SYNTHETIC_EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD,
  hasNormalizedFieldName,
  isEbayDomesticShippingFlatFeeField,
  isEbayFormatField,
  isEbayInternationalShippingFeesField,
  isEbayInternationalShippingFlatFeeField,
  isEbayShippingServiceFieldName,
  isEbayShippingTypeField,
  isLikelyDerivedAirtableField,
} from './approvalFormFieldsEbayHelpers';
import { pickPreferredField } from './approvalFormFieldsImageHelpers';
import type { ApprovalFormFieldSetupParams } from './approvalFormFieldSetupTypes';

type UseApprovalFormEbayEditorSetupParams = Pick<ApprovalFormFieldSetupParams,
  'recordId'
  | 'approvalChannel'
  | 'isCombinedApproval'
  | 'allFieldNames'
  | 'writableFieldNames'
  | 'formValues'
  | 'originalFieldValues'
  | 'setFormValue'
  | 'selectedEbayTemplateId'
  | 'onEbayTemplateIdChange'
> & {
  ebayMarketplaceId: string;
  isEbayListingForm: boolean;
};

export function useApprovalFormEbayEditorSetup({
  recordId,
  approvalChannel,
  isCombinedApproval,
  allFieldNames,
  writableFieldNames,
  formValues,
  originalFieldValues,
  setFormValue,
  selectedEbayTemplateId,
  onEbayTemplateIdChange,
  ebayMarketplaceId,
  isEbayListingForm,
}: UseApprovalFormEbayEditorSetupParams) {
  const isEbayApprovalForm = approvalChannel === 'ebay';
  const [ebayPackageTypeOptions, setEbayPackageTypeOptions] = useState<string[]>(['Package/Thick Envelope']);

  useEffect(() => {
    if (!(approvalChannel === 'ebay' || approvalChannel === 'combined')) return;

    let cancelled = false;
    void (async () => {
      const options = await getEbayPackageTypes(ebayMarketplaceId);
      if (cancelled || options.length === 0) return;
      setEbayPackageTypeOptions(options);
    })();

    return () => {
      cancelled = true;
    };
  }, [approvalChannel, ebayMarketplaceId]);

  const ebayBodyDescriptionFieldName = isEbayApprovalForm
    ? allFieldNames.find((fieldName) => isEbayBodyDescriptionField(fieldName))
    : undefined;
  const ebayKeyFeaturesCandidateFieldNames = (!isCombinedApproval && isEbayApprovalForm)
    ? allFieldNames.filter((fieldName) => isGenericSharedKeyFeaturesField(fieldName))
    : [];
  const ebayKeyFeaturesFieldName = (!isCombinedApproval && isEbayApprovalForm)
    ? pickPreferredField(
      ebayKeyFeaturesCandidateFieldNames,
      ['Key Features', 'Key Features JSON', 'Features', 'Features JSON'],
      formValues,
    )
    : undefined;
  const ebayKeyFeaturesSyncFieldNames = ebayKeyFeaturesCandidateFieldNames.filter((fieldName) => fieldName !== ebayKeyFeaturesFieldName);
  const ebayTestingNotesCandidateFieldNames = (!isCombinedApproval && isEbayApprovalForm)
    ? allFieldNames.filter((fieldName) => isEbayTestingNotesField(fieldName) || (isEbayKeyFeaturesField(fieldName) && !isGenericSharedKeyFeaturesField(fieldName)))
    : [];
  const ebayTestingNotesFieldName = (!isCombinedApproval && isEbayApprovalForm)
    ? pickPreferredField(
      ebayTestingNotesCandidateFieldNames,
      [
        'Testing Notes',
        'Testing Notes JSON',
        'eBay Testing Notes',
        'eBay Testing Notes JSON',
        'eBay Body Testing Notes',
        'eBay Body Testing Notes JSON',
        'eBay Listing Testing Notes',
        'eBay Listing Testing Notes JSON',
        'eBay Body Key Features JSON',
        'eBay Body Key Features',
        'eBay Listing Key Features JSON',
        'eBay Listing Key Features',
      ],
      formValues,
    )
    : undefined;
  const ebayAttributesCandidateFieldNames = (!isCombinedApproval && isEbayApprovalForm)
    ? allFieldNames.filter((fieldName) => isEbayAttributesField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    : [];
  const ebayAttributesFieldName = (!isCombinedApproval && isEbayApprovalForm)
    ? pickPreferredField(
      ebayAttributesCandidateFieldNames,
      [
        'eBay Inventory Product Aspects JSON',
        'eBay Inventory Product Aspects',
        'eBay Inventory Aspects',
        'eBay Product Aspects',
        'eBay Aspects',
        'ebay_inventory_product_aspects_json',
        'ebay_inventory_product_aspects',
        'ebay_inventory_aspects',
      ],
      formValues,
    )
    : undefined;
  const ebayAttributesSyncFieldNames = ebayAttributesCandidateFieldNames.filter((fieldName) => fieldName !== ebayAttributesFieldName);
  const ebayShippingServiceFieldNames = (!isCombinedApproval && isEbayApprovalForm)
    ? allFieldNames.filter((fieldName) => isEbayShippingServiceFieldName(fieldName))
    : [];
  const hasEbayShippingServicesEditor = ebayShippingServiceFieldNames.length > 0;
  const ebayShippingFeeFieldCandidates = Array.from(new Set([
    ...allFieldNames,
    ...writableFieldNames,
    ...Object.keys(formValues),
  ]));
  const ebayDomesticShippingFeesFieldName = pickPreferredField(
    ebayShippingFeeFieldCandidates.filter((fieldName) => isEbayShippingTypeField(fieldName)),
    ['eBay Domestic Shipping Fees', 'Domestic Shipping Fees', 'ebay_domestic_shipping_fees', 'domestic_shipping_fees'],
    formValues,
  );
  const ebayInternationalShippingFeesFieldName = pickPreferredField(
    ebayShippingFeeFieldCandidates.filter((fieldName) => isEbayInternationalShippingFeesField(fieldName)),
    ['eBay International Shipping Fees', 'International Shipping Fees', 'ebay_international_shipping_fees', 'international_shipping_fees'],
    formValues,
  );
  const ebayDomesticShippingFlatFeeFieldName = pickPreferredField(
    ebayShippingFeeFieldCandidates.filter((fieldName) => isEbayDomesticShippingFlatFeeField(fieldName)),
    ['eBay Domestic Shipping Flat Fee', 'Domestic Shipping Flat Fee', 'eBay Domestic Shipping Flat Fee USD', 'Domestic Shipping Flat Fee USD'],
    formValues,
  ) ?? SYNTHETIC_EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD;
  const ebayInternationalShippingFlatFeeFieldName = pickPreferredField(
    ebayShippingFeeFieldCandidates.filter((fieldName) => isEbayInternationalShippingFlatFeeField(fieldName)),
    ['eBay International Shipping Flat Fee', 'International Shipping Flat Fee', 'eBay International Shipping Flat Fee USD', 'International Shipping Flat Fee USD'],
    formValues,
  ) ?? SYNTHETIC_EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD;
  const domesticService1FieldName = hasEbayShippingServicesEditor
    ? pickPreferredField(
      ebayShippingServiceFieldNames.filter((fieldName) => hasNormalizedFieldName(fieldName, ['Domestic Service 1', 'eBay Domestic Service 1'])),
      ['Domestic Service 1', 'eBay Domestic Service 1'],
      formValues,
    )
    : undefined;
  const domesticService2FieldName = hasEbayShippingServicesEditor
    ? pickPreferredField(
      ebayShippingServiceFieldNames.filter((fieldName) => hasNormalizedFieldName(fieldName, ['Domestic Service 2', 'eBay Domestic Service 2'])),
      ['Domestic Service 2', 'eBay Domestic Service 2'],
      formValues,
    )
    : undefined;
  const internationalService1FieldName = hasEbayShippingServicesEditor
    ? pickPreferredField(
      ebayShippingServiceFieldNames.filter((fieldName) => hasNormalizedFieldName(fieldName, ['International Service 1', 'eBay International Service 1'])),
      ['International Service 1', 'eBay International Service 1'],
      formValues,
    )
    : undefined;
  const internationalService2FieldName = hasEbayShippingServicesEditor
    ? pickPreferredField(
      ebayShippingServiceFieldNames.filter((fieldName) => hasNormalizedFieldName(fieldName, ['International Service 2', 'eBay International Service 2'])),
      ['International Service 2', 'eBay International Service 2'],
      formValues,
    )
    : undefined;
  const ebayBodyHtmlFieldName = isEbayApprovalForm
    ? allFieldNames.find((fieldName) => isEbayBodyHtmlField(fieldName))
    : undefined;
  const ebayBodyHtmlTemplateFieldName = isEbayApprovalForm
    ? allFieldNames.find((fieldName) => isEbayBodyHtmlTemplateField(fieldName))
    : undefined;
  const [localEbayTemplateId, setLocalEbayTemplateId] = useState<EbayListingTemplateId>(DEFAULT_EBAY_LISTING_TEMPLATE_ID);

  useEffect(() => {
    const persistedTemplate = ebayBodyHtmlTemplateFieldName
      ? (originalFieldValues[ebayBodyHtmlTemplateFieldName] ?? '')
      : '';
    setLocalEbayTemplateId(normalizeEbayListingTemplateId(persistedTemplate));
  }, [ebayBodyHtmlTemplateFieldName, originalFieldValues, recordId]);

  useEffect(() => {
    if (!selectedEbayTemplateId) return;
    setLocalEbayTemplateId(normalizeEbayListingTemplateId(selectedEbayTemplateId));
  }, [selectedEbayTemplateId]);

  const resolvedEbayTemplateId = useMemo(() => {
    if (!isEbayApprovalForm) return DEFAULT_EBAY_LISTING_TEMPLATE_ID;

    if (selectedEbayTemplateId?.trim()) {
      return normalizeEbayListingTemplateId(selectedEbayTemplateId);
    }

    const rawTemplateValue = ebayBodyHtmlTemplateFieldName
      ? (formValues[ebayBodyHtmlTemplateFieldName] || originalFieldValues[ebayBodyHtmlTemplateFieldName] || '')
      : '';

    return rawTemplateValue.trim().length > 0
      ? normalizeEbayListingTemplateId(rawTemplateValue)
      : localEbayTemplateId;
  }, [
    ebayBodyHtmlTemplateFieldName,
    formValues,
    isEbayApprovalForm,
    localEbayTemplateId,
    originalFieldValues,
    selectedEbayTemplateId,
  ]);

  useEffect(() => {
    if (!isEbayApprovalForm) return;

    if (ebayBodyHtmlTemplateFieldName) {
      const currentTemplateValue = formValues[ebayBodyHtmlTemplateFieldName] ?? '';
      if (normalizeEbayListingTemplateId(currentTemplateValue) !== resolvedEbayTemplateId) {
        setFormValue(ebayBodyHtmlTemplateFieldName, resolvedEbayTemplateId);
      }
    }

    onEbayTemplateIdChange?.(resolvedEbayTemplateId);
  }, [
    ebayBodyHtmlTemplateFieldName,
    formValues,
    isEbayApprovalForm,
    onEbayTemplateIdChange,
    resolvedEbayTemplateId,
    setFormValue,
  ]);

  const ebayFormatFieldName = allFieldNames.find((fieldName) => isEbayFormatField(fieldName));
  const pinnedPreDescriptionFieldName = isEbayListingForm ? ebayFormatFieldName : undefined;

  return {
    domesticService1FieldName,
    domesticService2FieldName,
    ebayAttributesCandidateFieldNames,
    ebayAttributesFieldName,
    ebayAttributesSyncFieldNames,
    ebayBodyDescriptionFieldName,
    ebayBodyHtmlFieldName,
    ebayBodyHtmlTemplateFieldName,
    ebayDomesticShippingFeesFieldName,
    ebayDomesticShippingFlatFeeFieldName,
    ebayFormatFieldName,
    ebayInternationalShippingFeesFieldName,
    ebayInternationalShippingFlatFeeFieldName,
    ebayKeyFeaturesFieldName,
    ebayKeyFeaturesSyncFieldNames,
    ebayPackageTypeOptions,
    ebayShippingServiceFieldNames,
    ebayTestingNotesFieldName,
    hasEbayShippingServicesEditor,
    internationalService1FieldName,
    internationalService2FieldName,
    isEbayApprovalForm,
    pinnedPreDescriptionFieldName,
    resolvedEbayTemplateId,
  };
}