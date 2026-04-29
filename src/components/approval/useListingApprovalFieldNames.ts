import { useMemo } from 'react';
import {
  EBAY_ATTRIBUTES_FIELD_CANDIDATES,
  EBAY_CATEGORIES_FIELD_CANDIDATES,
  EBAY_DESCRIPTION_FIELD_CANDIDATES,
  EBAY_DOMESTIC_SHIPPING_FEES_FIELD_CANDIDATES,
  EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD_CANDIDATES,
  EBAY_DURATION_FIELD_CANDIDATES,
  EBAY_FORMAT_FIELD_CANDIDATES,
  EBAY_IMAGE_LIST_FIELD_CANDIDATES,
  EBAY_INTERNATIONAL_SHIPPING_FEES_FIELD_CANDIDATES,
  EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD_CANDIDATES,
  EBAY_PRIMARY_CATEGORY_FIELD_CANDIDATES,
  EBAY_PRIMARY_CATEGORY_NAME_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_SECONDARY_CATEGORY_FIELD_CANDIDATES,
  EBAY_SECONDARY_CATEGORY_NAME_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalEbayConstants';
import {
  findEbayBodyHtmlFieldName,
  findEbayPriceFieldName,
} from '@/components/approval/listingApprovalFieldHelpers';
import {
  CONDITION_FIELD_CANDIDATES,
  SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES,
  SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  SHOPIFY_IMAGE_LIST_FIELD_CANDIDATES,
  SHOPIFY_PRICE_FIELD_CANDIDATES,
  SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES,
  SHOPIFY_TITLE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalShopifyConstants';
import { CONDITION_FIELD, SHIPPING_SERVICE_FIELD } from '@/stores/approvalStore';

interface UseListingApprovalFieldNamesParams {
  records: Array<{ fields: Record<string, unknown> }>;
  approvalChannel: 'shopify' | 'ebay' | 'combined';
}

export function useListingApprovalFieldNames({
  records,
  approvalChannel,
}: UseListingApprovalFieldNamesParams) {
  const actualFieldNames = useMemo(() => {
    const names = new Set<string>();
    records.forEach((record) => {
      Object.keys(record.fields).forEach((fieldName) => names.add(fieldName));
    });

    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [records]);

  const allFieldNames = useMemo(() => {
    const names = new Set<string>(actualFieldNames);

    const conditionExistingNames = Array.from(names);
    const conditionExistingLower = new Set(conditionExistingNames.map((name) => name.toLowerCase()));
    const preferredConditionField = conditionExistingNames.find((name) =>
      CONDITION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
    ) ?? CONDITION_FIELD_CANDIDATES.find((candidate) => !conditionExistingLower.has(candidate.toLowerCase()));
    if (preferredConditionField) {
      names.add(preferredConditionField);
    }

    if (approvalChannel === 'shopify' || approvalChannel === 'combined') {
      const existingNames = Array.from(names);
      const existingLower = new Set(existingNames.map((name) => name.toLowerCase()));

      const preferredTitleField = existingNames.find((name) =>
        SHOPIFY_TITLE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_TITLE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredTitleField) names.add(preferredTitleField);

      const preferredPriceField = existingNames.find((name) =>
        SHOPIFY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_PRICE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredPriceField) names.add(preferredPriceField);

      const preferredProductTypeField = existingNames.find((name) =>
        SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredProductTypeField) names.add(preferredProductTypeField);

      names.add('Collections');

      const preferredImageField = existingNames.find((name) =>
        SHOPIFY_IMAGE_LIST_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_IMAGE_LIST_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredImageField) names.add(preferredImageField);

      const preferredDescriptionField = existingNames.find((name) =>
        SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDescriptionField) names.add(preferredDescriptionField);

      const preferredKeyFeaturesField = existingNames.find((name) =>
        SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredKeyFeaturesField) names.add(preferredKeyFeaturesField);
    }

    if (approvalChannel === 'ebay' || approvalChannel === 'combined') {
      const existingNames = Array.from(names);
      const existingLower = new Set(existingNames.map((name) => name.toLowerCase()));

      const preferredTitleField = existingNames.find((name) =>
        EBAY_TITLE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_TITLE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredTitleField) names.add(preferredTitleField);

      const preferredPriceField = findEbayPriceFieldName(existingNames)
        || EBAY_PRICE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredPriceField) names.add(preferredPriceField);

      const preferredImageField = existingNames.find((name) =>
        EBAY_IMAGE_LIST_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_IMAGE_LIST_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredImageField) names.add(preferredImageField);

      const preferredDescriptionField = existingNames.find((name) =>
        EBAY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DESCRIPTION_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDescriptionField) names.add(preferredDescriptionField);

      const preferredBodyHtmlField = findEbayBodyHtmlFieldName(existingNames);
      if (preferredBodyHtmlField) names.add(preferredBodyHtmlField);

      const preferredAttributesField = existingNames.find((name) =>
        EBAY_ATTRIBUTES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_ATTRIBUTES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredAttributesField) names.add(preferredAttributesField);

      const preferredFormatField = existingNames.find((name) =>
        EBAY_FORMAT_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_FORMAT_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredFormatField) names.add(preferredFormatField);

      const preferredDurationField = existingNames.find((name) =>
        EBAY_DURATION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DURATION_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDurationField) names.add(preferredDurationField);

      const preferredDomesticShippingFeesField = existingNames.find((name) =>
        EBAY_DOMESTIC_SHIPPING_FEES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DOMESTIC_SHIPPING_FEES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDomesticShippingFeesField) names.add(preferredDomesticShippingFeesField);

      const preferredInternationalShippingFeesField = existingNames.find((name) =>
        EBAY_INTERNATIONAL_SHIPPING_FEES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_INTERNATIONAL_SHIPPING_FEES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredInternationalShippingFeesField) names.add(preferredInternationalShippingFeesField);

      const preferredDomesticShippingFlatFeeField = existingNames.find((name) =>
        EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDomesticShippingFlatFeeField) names.add(preferredDomesticShippingFlatFeeField);

      const preferredInternationalShippingFlatFeeField = existingNames.find((name) =>
        EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredInternationalShippingFlatFeeField) names.add(preferredInternationalShippingFlatFeeField);

      const preferredPrimaryCategoryField = existingNames.find((name) =>
        EBAY_PRIMARY_CATEGORY_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredPrimaryCategoryField) names.add(preferredPrimaryCategoryField);

      const preferredSecondaryCategoryField = existingNames.find((name) =>
        EBAY_SECONDARY_CATEGORY_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredSecondaryCategoryField) names.add(preferredSecondaryCategoryField);

      const preferredPrimaryCategoryNameField = existingNames.find((name) =>
        EBAY_PRIMARY_CATEGORY_NAME_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_PRIMARY_CATEGORY_NAME_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredPrimaryCategoryNameField) names.add(preferredPrimaryCategoryNameField);

      const preferredSecondaryCategoryNameField = existingNames.find((name) =>
        EBAY_SECONDARY_CATEGORY_NAME_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_SECONDARY_CATEGORY_NAME_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredSecondaryCategoryNameField) names.add(preferredSecondaryCategoryNameField);

      const preferredCategoriesField = existingNames.find((name) =>
        EBAY_CATEGORIES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredCategoriesField) names.add(preferredCategoriesField);

      const hasAnyCategoryField = Array.from(names).some((name) => {
        const normalized = name.trim().toLowerCase();
        return normalized === 'categories'
          || normalized === 'category ids'
          || normalized === 'category_ids'
          || normalized === 'ebay offer primary category id'
          || normalized === 'ebay_offer_primary_category_id'
          || normalized === 'ebay_offer_primarycategoryid'
          || normalized === 'ebay offer category id'
          || normalized === 'ebay_offer_category_id'
          || normalized === 'ebay_offer_categoryid'
          || normalized === 'primary category'
          || normalized === 'primary category id'
          || normalized === 'primary_category'
          || normalized === 'primary_category_id'
          || normalized === 'ebay offer secondary category id'
          || normalized === 'ebay_offer_secondary_category_id'
          || normalized === 'ebay_offer_secondarycategoryid'
          || normalized === 'secondary category'
          || normalized === 'secondary category id'
          || normalized === 'secondary_category'
          || normalized === 'secondary_category_id';
      });

      if (!hasAnyCategoryField) {
        names.add('categories');
      }

      names.add(SHIPPING_SERVICE_FIELD);
    }

    names.add(CONDITION_FIELD);
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [actualFieldNames, approvalChannel]);

  return {
    actualFieldNames,
    allFieldNames,
  };
}