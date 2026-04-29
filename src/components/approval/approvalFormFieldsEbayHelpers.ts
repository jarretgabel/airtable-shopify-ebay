import { isShippingServiceField } from '@/stores/approvalStore';

export const SYNTHETIC_EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD = '__ebayDomesticShippingFlatFee__';
export const SYNTHETIC_EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD = '__ebayInternationalShippingFlatFee__';
export const EBAY_SEPARATED_SHIPPING_FEE_OPTIONS = ['Calculated', 'Flat'] as const;

export function isEbayPrimaryCategoryField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/g, '').trim();
  return normalized === 'ebay offer primary category id'
    || normalized === 'ebay_offer_primary_category_id'
    || normalized === 'ebay_offer_primarycategoryid'
    || normalized === 'ebay offer category id'
    || normalized === 'ebay_offer_category_id'
    || normalized === 'ebay_offer_categoryid'
    || normalized === 'category id'
    || normalized === 'category_id'
    || normalized === 'primary category id'
    || normalized === 'primary_category_id'
    || normalized === 'primary category'
    || normalized === 'primary_category'
    || normalized === 'primary category airtable'
    || normalized === 'primary_category_airtable';
}

export function isEbaySecondaryCategoryField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/g, '').trim();
  return normalized === 'ebay offer secondary category id'
    || normalized === 'ebay_offer_secondary_category_id'
    || normalized === 'ebay_offer_secondarycategoryid'
    || normalized === 'secondary category id'
    || normalized === 'secondary_category_id'
    || normalized === 'secondary category'
    || normalized === 'secondary_category'
    || normalized === 'secondary category airtable'
    || normalized === 'secondary_category_airtable';
}

export function isEbayPrimaryCategoryNameField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/g, '').trim();
  return normalized === 'primary category name'
    || normalized === 'primary_category_name'
    || normalized === 'ebay offer primary category name'
    || normalized === 'ebay_offer_primary_category_name'
    || normalized === 'ebay_offer_primarycategoryname';
}

export function isEbaySecondaryCategoryNameField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/g, '').trim();
  return normalized === 'secondary category name'
    || normalized === 'secondary_category_name'
    || normalized === 'ebay offer secondary category name'
    || normalized === 'ebay_offer_secondary_category_name'
    || normalized === 'ebay_offer_secondarycategoryname';
}

export function isEbayMarketplaceIdField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay offer marketplace id'
    || normalized === 'ebay_offer_marketplace_id'
    || normalized === 'ebay_offer_marketplaceid';
}

export function isEbayFormatField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay offer format'
    || normalized === 'ebay_offer_format'
    || normalized === 'ebay listing format'
    || normalized === 'ebay_listing_format'
    || normalized === 'listing format'
    || normalized === 'status'
    || (normalized.includes('listing') && normalized.includes('format'))
    || (normalized.includes('ebay') && normalized.includes('format') && !normalized.includes('body') && !normalized.includes('template'));
}

export function isEbayListingDurationField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay listing duration'
    || normalized === 'listing duration'
    || normalized === 'duration'
    || (normalized.includes('listing') && normalized.includes('duration'))
    || (normalized.includes('ebay') && normalized.includes('duration'));
}

export function getEbayListingDurationLabel(value: string): string {
  if (value === 'GTC') return 'Good Till Cancel';
  if (value === 'DAYS_7') return '7 Days';
  if (value === 'DAYS_10') return '10 Days';
  return value;
}

export function getEbayShippingTypeLabel(value: string): string {
  if (value === 'Calculated') return 'Calculated';
  if (value === 'CalculatedDomesticFlatInternational') return 'Calculated Domestic / Flat International';
  if (value === 'FlatDomesticCalculatedInternational') return 'Flat Domestic / Calculated International';
  if (value === 'Flat') return 'Flat';
  return value;
}

export function parseEbayShippingFeeSelections(value: string): { domestic: string; international: string } {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');

  if (!trimmed) return { domestic: '', international: '' };
  if (trimmed === 'CalculatedDomesticFlatInternational' || normalized === 'calculated domestic / flat international') {
    return { domestic: 'Calculated', international: 'Flat' };
  }
  if (trimmed === 'FlatDomesticCalculatedInternational' || normalized === 'flat domestic / calculated international') {
    return { domestic: 'Flat', international: 'Calculated' };
  }
  if (trimmed === 'Calculated' || normalized === 'calculated') {
    return { domestic: 'Calculated', international: 'Calculated' };
  }
  if (trimmed === 'Flat' || normalized === 'flat') {
    return { domestic: 'Flat', international: 'Flat' };
  }
  if (trimmed === 'NotSpecified' || normalized === 'not specified') {
    return { domestic: 'NotSpecified', international: 'NotSpecified' };
  }
  return { domestic: trimmed, international: trimmed };
}

export function isEbayShippingTypeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'domestic shipping fees'
    || normalized === 'ebay domestic shipping fees'
    || normalized === 'domestic_shipping_fees'
    || normalized === 'ebay_domestic_shipping_fees';
}

export function isEbayInternationalShippingFeesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'international shipping fees'
    || normalized === 'ebay international shipping fees'
    || normalized === 'international_shipping_fees'
    || normalized === 'ebay_international_shipping_fees';
}

export function getSeparatedEbayShippingFeeValue(params: {
  fieldName: string;
  fieldValue: string;
  domesticFieldValue?: string;
}): string {
  const { fieldName, fieldValue, domesticFieldValue = '' } = params;

  if (isEbayInternationalShippingFeesField(fieldName)) {
    const ownSelections = parseEbayShippingFeeSelections(fieldValue);
    if (ownSelections.international) return ownSelections.international;
    return parseEbayShippingFeeSelections(domesticFieldValue).international;
  }

  return parseEbayShippingFeeSelections(fieldValue).domestic;
}

export function isEbayDomesticShippingFlatFeeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'domestic shipping flat fee'
    || normalized === 'ebay domestic shipping flat fee'
    || normalized === 'domestic shipping flat fee usd'
    || normalized === 'ebay domestic shipping flat fee usd'
    || normalized === 'domestic shipping flat rate'
    || normalized === 'ebay domestic shipping flat rate'
    || normalized === 'domestic shipping flat cost'
    || normalized === 'ebay domestic shipping flat cost'
    || normalized === 'domestic_shipping_flat_fee'
    || normalized === 'ebay_domestic_shipping_flat_fee'
    || normalized === 'domestic_shipping_flat_fee_usd'
    || normalized === 'ebay_domestic_shipping_flat_fee_usd'
    || normalized === 'domestic_shipping_flat_rate'
    || normalized === 'ebay_domestic_shipping_flat_rate'
    || normalized === 'domestic_shipping_flat_cost'
    || normalized === 'ebay_domestic_shipping_flat_cost'
    || compact === 'domesticshippingflatfee'
    || compact === 'ebaydomesticshippingflatfee'
    || compact === 'domesticshippingflatfeeusd'
    || compact === 'ebaydomesticshippingflatfeeusd'
    || compact === 'domesticshippingflatrate'
    || compact === 'ebaydomesticshippingflatrate'
    || compact === 'domesticshippingflatcost'
    || compact === 'ebaydomesticshippingflatcost'
    || (normalized.includes('domestic') && normalized.includes('shipping') && normalized.includes('flat') && (normalized.includes('fee') || normalized.includes('rate') || normalized.includes('cost')));
}

export function isEbayInternationalShippingFlatFeeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'international shipping flat fee'
    || normalized === 'ebay international shipping flat fee'
    || normalized === 'international shipping flat fee usd'
    || normalized === 'ebay international shipping flat fee usd'
    || normalized === 'international shipping flat rate'
    || normalized === 'ebay international shipping flat rate'
    || normalized === 'international shipping flat cost'
    || normalized === 'ebay international shipping flat cost'
    || normalized === 'international_shipping_flat_fee'
    || normalized === 'ebay_international_shipping_flat_fee'
    || normalized === 'international_shipping_flat_fee_usd'
    || normalized === 'ebay_international_shipping_flat_fee_usd'
    || normalized === 'international_shipping_flat_rate'
    || normalized === 'ebay_international_shipping_flat_rate'
    || normalized === 'international_shipping_flat_cost'
    || normalized === 'ebay_international_shipping_flat_cost'
    || compact === 'internationalshippingflatfee'
    || compact === 'ebayinternationalshippingflatfee'
    || compact === 'internationalshippingflatfeeusd'
    || compact === 'ebayinternationalshippingflatfeeusd'
    || compact === 'internationalshippingflatrate'
    || compact === 'ebayinternationalshippingflatrate'
    || compact === 'internationalshippingflatcost'
    || compact === 'ebayinternationalshippingflatcost'
    || (normalized.includes('international') && normalized.includes('shipping') && normalized.includes('flat') && (normalized.includes('fee') || normalized.includes('rate') || normalized.includes('cost')));
}

export function hasNormalizedFieldName(fieldName: string, candidates: string[]): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return candidates.some((candidate) => candidate.trim().toLowerCase() === normalized);
}

export function getCanonicalShippingServiceAlias(fieldName: string): string | null {
  const normalized = fieldName.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'ebay domestic service 1') return 'domestic service 1';
  if (normalized === 'ebay domestic service 2') return 'domestic service 2';
  if (normalized === 'ebay international service 1') return 'international service 1';
  if (normalized === 'ebay international service 2') return 'international service 2';
  return null;
}

export function isEbayShippingServiceFieldName(fieldName: string): boolean {
  return isShippingServiceField(fieldName) || getCanonicalShippingServiceAlias(fieldName) !== null;
}

export function isRemovedEbayField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return normalized === 'ebay domestic service 1';
}

export function normalizeEbayAdvancedFieldName(fieldName: string): string {
  return fieldName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/ebay/g, 'ebay')
    .replace(/international destinations/g, 'international destinations')
    .replace(/combined shipping discount profile/g, 'shipping discount profile')
    .replace(/combined shipping discount enabled/g, 'combined shipping discount enabled')
    .replace(/shipping discount profile/g, 'shipping discount profile')
    .replace(/combined shipping discount/g, 'combined shipping discount')
    .replace(/excluded locations/g, 'excluded locations')
    .replace(/handling time/g, 'handling time')
    .replace(/package type/g, 'package type')
    .replace(/package packaging type/g, 'package type')
    .replace(/ebay offer /g, '')
    .replace(/ebay inventory /g, '')
    .replace(/ebay /g, '')
    .replace(/offer /g, '')
    .replace(/inventory /g, '')
    .replace(/package or thick envelope/g, 'package/thick envelope')
    .replace(/package thick envelope/g, 'package/thick envelope')
    .replace(/package envelope/g, 'package/thick envelope')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isItemZipCodeField(fieldName: string): boolean {
  const normalized = normalizeEbayAdvancedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'item zip code'
    || normalized === 'item postal code'
    || normalized === 'location zip code'
    || normalized === 'location postal code'
    || normalized === 'zip code'
    || normalized === 'postal code'
    || compact === 'itemzipcode'
    || compact === 'zipcode'
    || compact === 'itempostalcode'
    || compact === 'postalcode'
    || compact === 'locationzipcode'
    || compact === 'locationpostalcode'
    || compact === 'itempostal'
    || compact === 'locationpostal';
}

export function getEbayAdvancedOptionDefaultValue(fieldName: string): string {
  const normalized = normalizeEbayAdvancedFieldName(fieldName);
  if (normalized === 'excluded locations') return 'none';
  if (normalized === 'handling time' || normalized === 'handling time days') return '3 days';
  if (normalized === 'package type') return 'Package/Thick Envelope';
  if (normalized === 'shipping discount profile') return 'Untitled Calculated Discount Profile (HighEndAudioAuctions)';
  return '';
}

export function isEbayAdvancedOptionField(fieldName: string): boolean {
  const normalized = normalizeEbayAdvancedFieldName(fieldName);
  return normalized === 'excluded locations'
    || normalized === 'handling time'
    || normalized === 'handling time days'
    || isItemZipCodeField(fieldName)
    || normalized === 'package type'
    || normalized === 'international destinations'
    || normalized === 'combined shipping discount'
    || normalized === 'combined shipping discount enabled'
    || normalized === 'shipping discount profile';
}

export function isEbayPackageTypeField(fieldName: string): boolean {
  return normalizeEbayAdvancedFieldName(fieldName) === 'package type';
}

export function isEbayCategoriesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/g, '').trim();

  if (
    normalized === 'category'
    || normalized === 'categories'
    || normalized === 'category ids'
    || normalized === 'category_ids'
    || normalized === 'category id'
    || normalized === 'category_id'
    || normalized === 'categories airtable'
    || normalized === 'category airtable'
  ) {
    return true;
  }

  if (normalized.includes('categor')) {
    if (normalized.includes('shopify') || normalized.includes('google') || normalized.includes('taxonomy') || normalized.includes('product type')) {
      return false;
    }

    return normalized.includes('ebay')
      || normalized.includes('id')
      || normalized.includes('json')
      || normalized.includes('primary')
      || normalized.includes('secondary')
      || normalized.includes('airtable')
      || normalized.includes('linked');
  }

  return false;
}

export function isLikelyDerivedAirtableField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('(from ')
    || normalized.includes('(lookup')
    || normalized.includes('(rollup')
    || normalized.includes('(formula');
}