import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import {
  CONDITION_FIELD_CANDIDATES,
  SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES,
  SHOPIFY_BODY_HTML_FIELD_CANDIDATES,
  SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  SHOPIFY_PRICE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalShopifyConstants';
import {
  EBAY_BODY_HTML_FIELD_CANDIDATES,
  EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  EBAY_CATEGORIES_FIELD_CANDIDATES,
  EBAY_DESCRIPTION_FIELD_CANDIDATES,
  EBAY_DURATION_FIELD_CANDIDATES,
  EBAY_FORMAT_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_TESTING_NOTES_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
  type EbayListingTemplateId,
} from '@/components/approval/listingApprovalEbayConstants';
import {
  findEbayBodyHtmlFieldName,
  isEbayOnlyFieldName,
  isGenericSharedKeyFeaturesFieldName,
  isHiddenCombinedFieldName,
  isItemZipCodeField,
  isRemovedCombinedEbayPriceFieldName,
  isShopifyOnlyFieldName,
} from '@/components/approval/listingApprovalFieldHelpers';
import { CONDITION_FIELD, toFormValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';
import { useListingApprovalCombinedFieldSync } from '@/components/approval/useListingApprovalCombinedFieldSync';

interface UseListingApprovalCombinedFieldStateParams {
  records: AirtableRecord[];
  selectedRecordId: ApprovalTabViewModel['selectedRecordId'];
  allFieldNames: string[];
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  selectedEbayTemplateId: EbayListingTemplateId;
  setSelectedEbayTemplateId: Dispatch<SetStateAction<EbayListingTemplateId>>;
}

export function useListingApprovalCombinedFieldState({
  records,
  selectedRecordId,
  allFieldNames,
  approvalChannel,
  isCombinedApproval,
  formValues,
  setFormValue,
  setSelectedEbayTemplateId,
}: UseListingApprovalCombinedFieldStateParams) {
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

  const selectedRecordFieldNames = useMemo(() => {
    const names = new Set<string>(allFieldNames);
    Object.keys(selectedRecord?.fields ?? {}).forEach((fieldName) => names.add(fieldName));
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [allFieldNames, selectedRecord]);

  const combinedDescriptionFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    const exact = selectedRecordFieldNames.find((fieldName) => fieldName.trim().toLowerCase() === 'description');
    if (exact) return exact;
    return selectedRecordFieldNames.find((fieldName) =>
      SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase())
      || EBAY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    ) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedSharedKeyFeaturesFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    const exact = selectedRecordFieldNames.find((fieldName) => isGenericSharedKeyFeaturesFieldName(fieldName));
    if (exact) return exact;

    const shopifySpecific = selectedRecordFieldNames.find((fieldName) =>
      SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase())
      && !EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    );
    if (shopifySpecific) return shopifySpecific;

    return selectedRecordFieldNames.find((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      if (normalized.includes('ebay')) return false;
      return normalized.includes('key feature') || normalized === 'features' || normalized === 'features json';
    }) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedSharedKeyFeaturesSyncFieldNames = useMemo(() => {
    if (!isCombinedApproval || !combinedSharedKeyFeaturesFieldName) return [] as string[];

    return selectedRecordFieldNames.filter((fieldName) => {
      if (fieldName === combinedSharedKeyFeaturesFieldName) return false;

      const normalized = fieldName.trim().toLowerCase();
      if (normalized.includes('ebay')) return false;

      return SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)
        || normalized.includes('key feature')
        || normalized === 'features'
        || normalized === 'features json';
    });
  }, [combinedSharedKeyFeaturesFieldName, isCombinedApproval, selectedRecordFieldNames]);

  const combinedShopifyBodyHtmlFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    return selectedRecordFieldNames.find((fieldName) =>
      SHOPIFY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    ) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedEbayBodyHtmlFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    return findEbayBodyHtmlFieldName(selectedRecordFieldNames);
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedShopifyBodyHtmlValue = useMemo(
    () => (combinedShopifyBodyHtmlFieldName ? (formValues[combinedShopifyBodyHtmlFieldName] ?? '') : ''),
    [combinedShopifyBodyHtmlFieldName, formValues],
  );

  const combinedEbayBodyHtmlValue = useMemo(
    () => (combinedEbayBodyHtmlFieldName ? (formValues[combinedEbayBodyHtmlFieldName] ?? '') : ''),
    [combinedEbayBodyHtmlFieldName, formValues],
  );

  const combinedEbayTitleFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    return selectedRecordFieldNames.find((fieldName) =>
      EBAY_TITLE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    ) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedEbayTestingNotesFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    const testingNotesField = selectedRecordFieldNames.find((fieldName) =>
      EBAY_TESTING_NOTES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    );
    if (testingNotesField) return testingNotesField;

    return selectedRecordFieldNames.find((fieldName) =>
      !isGenericSharedKeyFeaturesFieldName(fieldName)
      && EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    ) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  useListingApprovalCombinedFieldSync({
    allFieldNames,
    approvalChannel,
    isCombinedApproval,
    formValues,
    setFormValue,
    combinedSharedKeyFeaturesFieldName,
    combinedEbayTestingNotesFieldName,
    setSelectedEbayTemplateId,
  });

  const combinedShopifyOnlyFieldNames = useMemo(() => {
    if (!isCombinedApproval) return [] as string[];
    const normalizedShopifyPriceCandidates = new Set(SHOPIFY_PRICE_FIELD_CANDIDATES.map((candidate) => candidate.toLowerCase()));
    const shopifyPriceFields = selectedRecordFieldNames.filter((fieldName) =>
      normalizedShopifyPriceCandidates.has(fieldName.toLowerCase()),
    );

    const chosenShopifyPriceFieldName = (() => {
      if (shopifyPriceFields.length <= 1) return '';

      const firstWithValue = shopifyPriceFields.find((fieldName) => {
        const currentValue = formValues[fieldName];
        if (typeof currentValue === 'string' && currentValue.trim().length > 0) return true;

        const recordValue = selectedRecord?.fields[fieldName];
        return toFormValue(recordValue).trim().length > 0;
      });

      return firstWithValue ?? shopifyPriceFields[0] ?? '';
    })();

    return selectedRecordFieldNames.filter((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      if (isHiddenCombinedFieldName(fieldName)) return false;
      if (!isShopifyOnlyFieldName(fieldName) || isEbayOnlyFieldName(fieldName)) return false;
      if (chosenShopifyPriceFieldName && shopifyPriceFields.includes(fieldName) && fieldName !== chosenShopifyPriceFieldName) return false;
      if (normalized === 'product type') return false;
      if (SHOPIFY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      return true;
    });
  }, [formValues, isCombinedApproval, selectedRecord, selectedRecordFieldNames]);

  const combinedEbayOnlyFieldNames = useMemo(() => {
    if (!isCombinedApproval) return [] as string[];
    return selectedRecordFieldNames.filter((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      if (isRemovedCombinedEbayPriceFieldName(fieldName)) return false;
      if (isHiddenCombinedFieldName(fieldName)) return false;
      if (!isEbayOnlyFieldName(fieldName) || isShopifyOnlyFieldName(fieldName)) return false;
      if (normalized.includes('primary category') || normalized.includes('secondary category')) return false;
      if (EBAY_FORMAT_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_DURATION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      return true;
    });
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedSharedFieldNames = useMemo(() => {
    if (!isCombinedApproval) return allFieldNames;
    const shopifyOnlySet = new Set(combinedShopifyOnlyFieldNames.map((fieldName) => fieldName.toLowerCase()));
    const ebayOnlySet = new Set(combinedEbayOnlyFieldNames.map((fieldName) => fieldName.toLowerCase()));
    const conditionCandidateSet = new Set(CONDITION_FIELD_CANDIDATES.map((fieldName) => fieldName.toLowerCase()));

    return selectedRecordFieldNames.filter((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      if (isRemovedCombinedEbayPriceFieldName(fieldName)) return false;

      const isCombinedEbayPriceField = EBAY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)
        || normalized.includes('buy it now')
        || normalized.includes('starting bid')
        || normalized === 'ebay offer price value'
        || normalized === 'ebay offer auction start price value';

      if (isHiddenCombinedFieldName(fieldName)) return false;
      if (shopifyOnlySet.has(normalized) || ebayOnlySet.has(normalized)) return false;
      if (isItemZipCodeField(fieldName)) return false;
      if (isCombinedEbayPriceField) return false;
      if (EBAY_FORMAT_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_DURATION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_CATEGORIES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (normalized === 'template name') return false;
      if (combinedDescriptionFieldName && normalized === combinedDescriptionFieldName.toLowerCase()) return false;
      if (combinedSharedKeyFeaturesFieldName && normalized === combinedSharedKeyFeaturesFieldName.toLowerCase()) return false;
      if (SHOPIFY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (conditionCandidateSet.has(normalized) && allFieldNames.includes(CONDITION_FIELD) && fieldName !== CONDITION_FIELD) return false;
      return true;
    });
  }, [
    allFieldNames,
    combinedDescriptionFieldName,
    combinedEbayOnlyFieldNames,
    combinedSharedKeyFeaturesFieldName,
    combinedShopifyOnlyFieldNames,
    isCombinedApproval,
    selectedRecordFieldNames,
  ]);

  return {
    combinedDescriptionFieldName,
    combinedEbayBodyHtmlFieldName,
    combinedEbayBodyHtmlValue,
    combinedEbayOnlyFieldNames,
    combinedEbayTestingNotesFieldName,
    combinedEbayTitleFieldName,
    combinedSharedFieldNames,
    combinedSharedKeyFeaturesFieldName,
    combinedSharedKeyFeaturesSyncFieldNames,
    combinedShopifyBodyHtmlFieldName,
    combinedShopifyBodyHtmlValue,
    combinedShopifyOnlyFieldNames,
    selectedRecord,
    selectedRecordFieldNames,
  };
}