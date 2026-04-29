import { useMemo } from 'react';
import {
  isEbayCategoriesField,
  isEbayMarketplaceIdField,
  isEbayPrimaryCategoryField,
  isEbayPrimaryCategoryNameField,
  isEbaySecondaryCategoryField,
  isEbaySecondaryCategoryNameField,
  isLikelyDerivedAirtableField,
} from './approvalFormFieldsEbayHelpers';
import { applyEbayCategoryIds, resolveEbaySelectedCategoryIds, resolveEbaySelectedCategoryNames } from './ebayCategoryFields';
import { pickPreferredField } from './approvalFormFieldsImageHelpers';
import type { ApprovalFormFieldSetupParams } from './approvalFormFieldSetupTypes';

type UseApprovalFormEbayCategorySetupParams = Pick<ApprovalFormFieldSetupParams,
  'isCombinedApproval'
  | 'allFieldNames'
  | 'writableFieldNames'
  | 'formValues'
  | 'originalFieldValues'
  | 'setFormValue'
>;

export function useApprovalFormEbayCategorySetup({
  isCombinedApproval,
  allFieldNames,
  writableFieldNames,
  formValues,
  originalFieldValues,
  setFormValue,
}: UseApprovalFormEbayCategorySetupParams) {
  const formCategoryFields = Object.keys(formValues).filter(
    (fieldName) => isEbayCategoriesField(fieldName) && !isLikelyDerivedAirtableField(fieldName),
  );
  const writableCategoryFields = writableFieldNames.filter(
    (fieldName) => isEbayCategoriesField(fieldName) && !isLikelyDerivedAirtableField(fieldName),
  );
  const allCategoryFields = allFieldNames.filter(
    (fieldName) => isEbayCategoriesField(fieldName) && !isLikelyDerivedAirtableField(fieldName),
  );
  const categoryFieldCandidates = Array.from(new Set([
    ...formCategoryFields,
    ...allCategoryFields,
    ...writableCategoryFields,
  ]));
  const ebayCategoriesFieldName = pickPreferredField(
    categoryFieldCandidates,
    ['categories', 'Categories'],
    formValues,
  );
  const formValueFieldNames = Object.keys(formValues);
  const ebayPrimaryCategoryFieldName = writableFieldNames.find(
    (fieldName) => isEbayPrimaryCategoryField(fieldName) && !isLikelyDerivedAirtableField(fieldName),
  )
    ?? allFieldNames.find((fieldName) => isEbayPrimaryCategoryField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    ?? formValueFieldNames.find((fieldName) => isEbayPrimaryCategoryField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    ?? writableFieldNames.find((fieldName) => isEbayPrimaryCategoryField(fieldName))
    ?? allFieldNames.find((fieldName) => isEbayPrimaryCategoryField(fieldName))
    ?? formValueFieldNames.find((fieldName) => isEbayPrimaryCategoryField(fieldName));
  const ebaySecondaryCategoryFieldName = writableFieldNames.find(
    (fieldName) => isEbaySecondaryCategoryField(fieldName) && !isLikelyDerivedAirtableField(fieldName),
  )
    ?? allFieldNames.find((fieldName) => isEbaySecondaryCategoryField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    ?? formValueFieldNames.find((fieldName) => isEbaySecondaryCategoryField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    ?? writableFieldNames.find((fieldName) => isEbaySecondaryCategoryField(fieldName))
    ?? allFieldNames.find((fieldName) => isEbaySecondaryCategoryField(fieldName))
    ?? formValueFieldNames.find((fieldName) => isEbaySecondaryCategoryField(fieldName));
  const ebayPrimaryCategoryNameFieldName = writableFieldNames.find(
    (fieldName) => isEbayPrimaryCategoryNameField(fieldName) && !isLikelyDerivedAirtableField(fieldName),
  )
    ?? allFieldNames.find((fieldName) => isEbayPrimaryCategoryNameField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    ?? formValueFieldNames.find((fieldName) => isEbayPrimaryCategoryNameField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    ?? writableFieldNames.find((fieldName) => isEbayPrimaryCategoryNameField(fieldName))
    ?? allFieldNames.find((fieldName) => isEbayPrimaryCategoryNameField(fieldName))
    ?? formValueFieldNames.find((fieldName) => isEbayPrimaryCategoryNameField(fieldName));
  const ebaySecondaryCategoryNameFieldName = writableFieldNames.find(
    (fieldName) => isEbaySecondaryCategoryNameField(fieldName) && !isLikelyDerivedAirtableField(fieldName),
  )
    ?? allFieldNames.find((fieldName) => isEbaySecondaryCategoryNameField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    ?? formValueFieldNames.find((fieldName) => isEbaySecondaryCategoryNameField(fieldName) && !isLikelyDerivedAirtableField(fieldName))
    ?? writableFieldNames.find((fieldName) => isEbaySecondaryCategoryNameField(fieldName))
    ?? allFieldNames.find((fieldName) => isEbaySecondaryCategoryNameField(fieldName))
    ?? formValueFieldNames.find((fieldName) => isEbaySecondaryCategoryNameField(fieldName));
  const fallbackCategoryTargetFieldName = formValueFieldNames.find(
    (fieldName) => (
      isEbayCategoriesField(fieldName)
      || isEbayPrimaryCategoryField(fieldName)
      || isEbaySecondaryCategoryField(fieldName)
    ) && !isLikelyDerivedAirtableField(fieldName),
  );
  const effectiveEbayCategoriesFieldName = ebayCategoriesFieldName
    ?? fallbackCategoryTargetFieldName
    ?? 'categories';
  const ebayMarketplaceIdFieldName = allFieldNames.find((fieldName) => isEbayMarketplaceIdField(fieldName));
  const isEbayListingForm = allFieldNames.some((fieldName) => {
    const normalized = fieldName.toLowerCase();
    return normalized.startsWith('ebay ') || normalized.startsWith('ebay_');
  });
  const hasEbayCategoryEditor = isEbayListingForm && !isCombinedApproval;
  const ebayMarketplaceId = (ebayMarketplaceIdFieldName ? formValues[ebayMarketplaceIdFieldName] : undefined)?.trim() || 'EBAY_US';
  const ebayCategorySourceValues = useMemo(() => {
    const merged: Record<string, string> = { ...originalFieldValues };

    Object.entries(formValues).forEach(([fieldName, value]) => {
      if (value.trim().length > 0) {
        merged[fieldName] = value;
        return;
      }

      if (!(fieldName in merged)) {
        merged[fieldName] = value;
      }
    });

    return merged;
  }, [formValues, originalFieldValues]);
  const ebaySelectedCategoryIds = useMemo(() => resolveEbaySelectedCategoryIds(ebayCategorySourceValues, {
    categoriesFieldName: ebayCategoriesFieldName,
    primaryCategoryFieldName: ebayPrimaryCategoryFieldName,
    secondaryCategoryFieldName: ebaySecondaryCategoryFieldName,
  }), [ebayCategoriesFieldName, ebayPrimaryCategoryFieldName, ebaySecondaryCategoryFieldName, ebayCategorySourceValues]);
  const ebaySelectedCategoryNames = useMemo(() => resolveEbaySelectedCategoryNames(ebayCategorySourceValues, {
    categoriesFieldName: ebayCategoriesFieldName,
    primaryCategoryNameFieldName: ebayPrimaryCategoryNameFieldName,
    secondaryCategoryNameFieldName: ebaySecondaryCategoryNameFieldName,
  }), [ebayCategoriesFieldName, ebayPrimaryCategoryNameFieldName, ebaySecondaryCategoryNameFieldName, ebayCategorySourceValues]);
  const ebaySelectedCategoryDisplayValues = useMemo(
    () => (ebaySelectedCategoryIds.length > 0 ? ebaySelectedCategoryIds : ebaySelectedCategoryNames),
    [ebaySelectedCategoryIds, ebaySelectedCategoryNames],
  );
  const hasSecondaryEbayCategory = ebaySelectedCategoryDisplayValues.length > 1
    && ebaySelectedCategoryDisplayValues[1].trim().length > 0;
  const setEbayCategoryIds = (nextIds: string[]) => {
    applyEbayCategoryIds(nextIds, {
      categoriesFieldName: effectiveEbayCategoriesFieldName,
      primaryCategoryFieldName: ebayPrimaryCategoryFieldName,
      secondaryCategoryFieldName: ebaySecondaryCategoryFieldName,
    }, setFormValue);
  };
  const hasCanonicalConditionField = allFieldNames.some((fieldName) => fieldName.trim().toLowerCase() === 'condition');

  return {
    ebayCategoriesFieldName,
    ebayMarketplaceId,
    ebaySelectedCategoryDisplayValues,
    effectiveEbayCategoriesFieldName,
    hasCanonicalConditionField,
    hasEbayCategoryEditor,
    hasSecondaryEbayCategory,
    isEbayListingForm,
    setEbayCategoryIds,
  };
}