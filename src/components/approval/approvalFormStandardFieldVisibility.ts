import { SHIPPING_SERVICE_FIELD, isAllowOffersField, isShippingServiceField } from '@/stores/approvalStore';

import {
  isBooleanLikeValue,
  isConditionMirrorSourceField,
  isScalarImageField,
} from './approvalFormFieldsSharedHelpers';
import {
  isEbayGlobalShippingField,
  isEbayHandlingCostField,
  isEbayKeyFeaturesField,
} from './approvalFormFieldsEbayHelpersBasic';
import {
  isHiddenApprovalField,
  isShopifyKeyFeaturesField,
  isShopifyOptionValuesField,
  isShopifyTemplateVariantNameField,
  isShopifyTypeField,
  isShopifyTypesFreeformField,
  isShopifyVariantBooleanField,
  isShopifyVariantOptionField,
  isShopifyVariantStatusField,
} from './approvalFormFieldsShopifyHelpersBasic';
import {
  getCanonicalShippingServiceAlias,
  isEbayAdvancedOptionField,
  isEbayDomesticShippingFlatFeeField,
  isEbayInternationalShippingFeesField,
  isEbayInternationalShippingFlatFeeField,
  isEbayPrimaryCategoryField,
  isEbaySecondaryCategoryField,
  isEbayShippingServiceFieldName,
  isEbayShippingTypeField,
  isRemovedEbayField,
} from './approvalFormFieldsEbayHelpers';
import {
  isEbayInventoryImageUrlsField,
  isEbayPhotoCountMaxField,
  isGenericImageScalarField,
  isHiddenCombinedFieldName,
  isImageUrlListField,
} from './approvalFormFieldsImageHelpers';
import {
  isShopifyCompoundCollectionField,
  isShopifyCompoundTagsField,
  isShopifySingleCollectionField,
  isShopifySingleTagField,
} from './approvalFormFieldsShopifyHelpers';

export interface ApprovalFormStandardFieldVisibilityParams {
  fieldName: string;
  allowAdvancedOptionField?: boolean;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  allFieldNames: string[];
  hasEbayShippingServicesEditor: boolean;
  approvedFieldName: string;
  hasShopifyTagEditor: boolean;
  hasShopifyCollectionEditor: boolean;
  shopifyBodyDescriptionFieldName?: string;
  ebayBodyDescriptionFieldName?: string;
  shopifyBodyHtmlFieldName?: string;
  shopifyBodyHtmlTemplateFieldName?: string;
  ebayBodyHtmlFieldName?: string;
  ebayBodyHtmlTemplateFieldName?: string;
  shopifyKeyFeaturesFieldName?: string;
  ebayKeyFeaturesFieldName?: string;
  ebayTestingNotesFieldName?: string;
  ebayAttributesCandidateFieldNames: string[];
  hasEbayCategoryEditor: boolean;
  ebayCategoriesFieldName?: string;
  effectiveEbayCategoriesFieldName: string;
  preferredShopifyPriceFieldName?: string;
  imageUrlSourceField?: string;
  useCombinedImageAltEditor: boolean;
  imageAltTextSourceField?: string;
  suppressImageScalarFields: boolean;
  hasCanonicalConditionField: boolean;
}

export function shouldHideApprovalFormStandardField({
  fieldName,
  allowAdvancedOptionField = false,
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
}: ApprovalFormStandardFieldVisibilityParams): boolean {
  if (isCombinedApproval && isHiddenCombinedFieldName(fieldName)) return true;
  if (isRemovedEbayField(fieldName)) return true;
  if (!allowAdvancedOptionField && approvalChannel === 'ebay' && isEbayAdvancedOptionField(fieldName)) return true;

  const canonicalShippingServiceAlias = getCanonicalShippingServiceAlias(fieldName);
  if (
    canonicalShippingServiceAlias
    && allFieldNames.some((candidateFieldName) => candidateFieldName.trim().toLowerCase() === canonicalShippingServiceAlias)
  ) {
    return true;
  }

  if (isEbayHandlingCostField(fieldName)) return true;
  if (isEbayGlobalShippingField(fieldName)) return true;
  if (isEbayDomesticShippingFlatFeeField(fieldName)) return true;
  if (isEbayInternationalShippingFlatFeeField(fieldName)) return true;
  if (isEbayShippingTypeField(fieldName)) return true;
  if (isEbayInternationalShippingFeesField(fieldName)) return true;
  if (isShopifyTypesFreeformField(fieldName)) return true;
  if (approvalChannel === 'shopify' && isShopifyVariantStatusField(fieldName)) return true;
  if (approvalChannel === 'shopify' && (isShopifyTemplateVariantNameField(fieldName) || isShopifyOptionValuesField(fieldName) || isShopifyVariantOptionField(fieldName))) return true;
  if (approvalChannel === 'ebay' && hasEbayShippingServicesEditor && (isEbayShippingServiceFieldName(fieldName) || fieldName === SHIPPING_SERVICE_FIELD)) return true;
  if (isShippingServiceField(fieldName) && approvalChannel !== 'ebay') return true;
  if (fieldName === approvedFieldName) return true;
  if (isHiddenApprovalField(fieldName)) return true;
  if (hasShopifyTagEditor && (isShopifyCompoundTagsField(fieldName) || isShopifySingleTagField(fieldName))) return true;
  if (hasShopifyCollectionEditor && (isShopifyCompoundCollectionField(fieldName) || isShopifySingleCollectionField(fieldName))) return true;
  if (shopifyBodyDescriptionFieldName && fieldName === shopifyBodyDescriptionFieldName) return true;
  if (ebayBodyDescriptionFieldName && fieldName === ebayBodyDescriptionFieldName) return true;
  if (shopifyBodyHtmlFieldName && fieldName === shopifyBodyHtmlFieldName) return true;
  if (shopifyBodyHtmlTemplateFieldName && fieldName === shopifyBodyHtmlTemplateFieldName) return true;
  if (ebayBodyHtmlFieldName && fieldName === ebayBodyHtmlFieldName) return true;
  if (ebayBodyHtmlTemplateFieldName && fieldName === ebayBodyHtmlTemplateFieldName) return true;
  if (isShopifyKeyFeaturesField(fieldName) || isEbayKeyFeaturesField(fieldName)) return true;
  if (shopifyKeyFeaturesFieldName && fieldName === shopifyKeyFeaturesFieldName) return true;
  if (ebayKeyFeaturesFieldName && fieldName === ebayKeyFeaturesFieldName) return true;
  if (ebayTestingNotesFieldName && fieldName === ebayTestingNotesFieldName) return true;
  if (ebayAttributesCandidateFieldNames.includes(fieldName)) return true;

  if (hasEbayCategoryEditor && (
    isEbayPrimaryCategoryField(fieldName)
    || isEbaySecondaryCategoryField(fieldName)
    || fieldName === ebayCategoriesFieldName
    || fieldName === effectiveEbayCategoriesFieldName
  )) return true;

  if (approvalChannel === 'shopify' && isImageUrlListField(fieldName)) return true;
  if (approvalChannel === 'ebay' && isImageUrlListField(fieldName)) return true;
  if (isEbayInventoryImageUrlsField(fieldName)) return true;
  if (isEbayPhotoCountMaxField(fieldName)) return true;

  if (preferredShopifyPriceFieldName) {
    const normalized = fieldName.trim().toLowerCase();
    const isPriceCandidate = normalized === 'shopify rest variant 1 price'
      || normalized === 'shopify variant 1 price'
      || normalized === 'shopify_rest_variant_1_price'
      || normalized === 'shopify price'
      || normalized === 'price';
    if (isPriceCandidate && fieldName !== preferredShopifyPriceFieldName) {
      return true;
    }
  }

  if (approvalChannel === 'shopify' && imageUrlSourceField && fieldName === imageUrlSourceField) return true;
  if (isCombinedApproval && imageUrlSourceField && fieldName === imageUrlSourceField) return true;
  if (isGenericImageScalarField(fieldName)) return true;
  if (useCombinedImageAltEditor && fieldName === imageAltTextSourceField) return true;
  if (suppressImageScalarFields && isScalarImageField(fieldName, isImageUrlListField)) return true;
  if (hasCanonicalConditionField && fieldName.trim().toLowerCase() !== 'condition' && isConditionMirrorSourceField(fieldName)) return true;

  const normalizedType = fieldName.trim().toLowerCase();
  return normalizedType.includes('shopify')
    && normalizedType.includes('type')
    && normalizedType !== 'shopify types'
    && !isShopifyTypeField(fieldName);
}

export function isApprovalFieldBooleanLike(fieldName: string, kind: 'boolean' | 'number' | 'json' | 'text', value: string): boolean {
  return isAllowOffersField(fieldName) || isShopifyVariantBooleanField(fieldName) || kind === 'boolean' || isBooleanLikeValue(value);
}