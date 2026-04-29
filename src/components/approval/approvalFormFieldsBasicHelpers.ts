import { CONDITION_FIELD, isShippingServiceField } from '@/stores/approvalStore';

export type EbayListingTemplateId = 'classic' | 'impact-slate' | 'impact-luxe';

export const DEFAULT_EBAY_LISTING_TEMPLATE_ID: EbayListingTemplateId = 'classic';

export function normalizeEbayListingTemplateId(value: string): EbayListingTemplateId {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return DEFAULT_EBAY_LISTING_TEMPLATE_ID;

  if (normalized === 'classic' || normalized.includes('insert') || normalized.includes('legacy') || normalized.includes('heritage')) {
    return 'classic';
  }

  if (normalized === 'impact-slate' || normalized === 'slate' || normalized.includes('impact slate')) {
    return 'impact-slate';
  }

  if (normalized === 'impact-luxe' || normalized === 'luxe' || normalized.includes('impact luxe')) {
    return 'impact-luxe';
  }

  return DEFAULT_EBAY_LISTING_TEMPLATE_ID;
}

export function normalizeEbayListingFormat(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

export function normalizeEbayListingDuration(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (trimmed === 'GOOD TILL CANCEL' || trimmed === 'GTC') return 'GTC';
  if (trimmed === '7 DAYS' || trimmed === 'DAYS_7') return 'DAYS_7';
  if (trimmed === '10 DAYS' || trimmed === 'DAYS_10') return 'DAYS_10';
  return value.trim();
}

export function getEbayPriceFieldLabel(listingFormat: string): string {
  const normalized = normalizeEbayListingFormat(listingFormat);
  if (normalized === 'AUCTION') return 'Starting Auction Price';
  if (normalized === 'FIXED_PRICE' || normalized === 'BUY_IT_NOW') return 'Buy It Now Price';
  return 'Buy It Now/Starting Bid Price';
}

export function toHumanReadableLabel(fieldName: string): string {
  if (fieldName === CONDITION_FIELD) return 'Condition';
  if (fieldName.trim().toLowerCase() === 'ebay offer price value') return 'eBay Price';
  if (fieldName.trim().toLowerCase() === 'ebay price') return 'eBay Price';
  if (fieldName.trim().toLowerCase() === 'buy it now usd') return 'eBay Price';
  if (fieldName.trim().toLowerCase() === 'starting bid usd') return 'eBay Price';
  if (fieldName.trim().toLowerCase() === 'shopify rest variant 1 price') return 'Shopify Price';
  if (fieldName.trim().toLowerCase() === 'shopify price') return 'Shopify Price';
  if (fieldName.trim().toLowerCase() === 'type') return 'Shopify Type';

  const withSpaces = fieldName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withSpaces) return fieldName;

  return withSpaces
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z0-9]+$/.test(word)) return word;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function isCurrencyLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const isShopifyPriceField = normalized.includes('shopify')
    && normalized.includes('price')
    && !normalized.includes('currency');
  const isGenericPriceField = normalized === 'price' || /^variant\s+\d+\s+price$/.test(normalized);
  const isShippingFlatFeeField = normalized.includes('shipping')
    && normalized.includes('flat')
    && (normalized.includes('fee') || normalized.includes('cost') || normalized.includes('rate'));

  return normalized === 'ebay offer price value'
    || normalized === 'ebay price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized.includes('handling cost')
    || isShippingFlatFeeField
    || isShopifyPriceField
    || isGenericPriceField;
}

export function isEbayHandlingCostField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized.includes('handling cost') || compact.includes('handlingcost');
}

export function isEbayGlobalShippingField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  return (normalized.includes('global') && normalized.includes('shipping'))
    || compact.includes('globalshipping')
    || compact.includes('globalshippingprogram');
}

export function isReadOnlyApprovalField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest product id' || normalized === 'shopify product id';
}

export function isShopifyTypeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'type' || normalized === 'shopify type';
}

export function isShopifyTypesFreeformField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === 'shopify types';
}

export function isShopifyTemplateVariantNameField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'shopify template variant name'
    || compact === 'shopifytemplatevariantname';
}

export function isShopifyOptionValuesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return /^shopify\s+(rest|graphql)?\s*option\s+\d+\s+value\s+\d+$/.test(normalized)
    || /^shopify_(rest|graphql)?_option_\d+_value_\d+$/.test(normalized)
    || /^shopify\s+option\s+values?(?:\s+\d+)?$/.test(normalized)
    || /^option\s+values?(?:\s+\d+)?$/.test(normalized)
    || normalized === 'shopify option values'
    || normalized === 'shopify_option_values'
    || compact === 'shopifyoptionvalues'
    || compact.startsWith('shopifyoptionvalues')
    || compact === 'optionvalues'
    || compact.startsWith('optionvalues');
}

export function isShopifyVariantOptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return /^shopify\s+(rest|graphql)?\s*variant\s+\d+\s+option\s+\d+$/.test(normalized)
    || /^shopify_(rest|graphql)?_variant_\d+_option_\d+$/.test(normalized)
    || /^variant\s+\d+\s+option\s+\d+$/.test(normalized)
    || /^variant\s+option(?:\s+\d+)?$/.test(normalized)
    || normalized === 'shopify variant option'
    || normalized === 'shopify_variant_option'
    || compact === 'shopifyvariantoption'
    || compact.startsWith('shopifyvariantoption')
    || compact === 'variantoption'
    || compact.startsWith('variantoption');
}

export function isShopifyVariantStatusField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'shopify variant status'
    || normalized === 'shopify variant status active'
    || normalized === 'shopify_variant_status'
    || normalized === 'shopify_variant_status_active'
    || compact === 'shopifyvariantstatus'
    || compact === 'shopifyvariantstatusactive';
}

export function isShopifyBodyDescriptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify body description'
    || normalized === 'shopify rest body description'
    || normalized === 'item description'
    || normalized === 'description'
    || normalized === 'shopify_body_description'
    || normalized === 'shopify_rest_body_description';
}

export function isEbayBodyDescriptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'description'
    || normalized === 'item description'
    || normalized === 'ebay inventory product description'
    || normalized === 'ebay_inventory_product_description';
}

export function isShopifyKeyFeaturesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'shopify body key features'
    || normalized === 'shopify rest body key features'
    || normalized === 'shopify body key features json'
    || normalized === 'shopify rest body key features json'
    || normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json'
    || normalized === 'shopify_body_key_features'
    || normalized === 'shopify_rest_body_key_features'
    || normalized === 'shopify_body_key_features_json'
    || normalized === 'shopify_rest_body_key_features_json') {
    return true;
  }

  const squashed = normalized.replace(/[^a-z0-9]/g, '');
  return squashed.includes('keyfeature')
    || squashed.includes('keyvaluepair')
    || squashed.includes('featurevaluepair')
    || squashed.includes('featurepairs')
    || squashed.includes('keypairs');
}

export function isGenericSharedKeyFeaturesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json';
}

export function isEbayKeyFeaturesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'ebay body key features'
    || normalized === 'ebay body key features json'
    || normalized === 'ebay listing key features'
    || normalized === 'ebay listing key features json'
    || normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json'
    || normalized === 'ebay_body_key_features'
    || normalized === 'ebay_body_key_features_json'
    || normalized === 'ebay_listing_key_features'
    || normalized === 'ebay_listing_key_features_json') {
    return true;
  }

  const squashed = normalized.replace(/[^a-z0-9]/g, '');
  return squashed.includes('ebaykeyfeature')
    || squashed.includes('keyfeature')
    || squashed.includes('keyvaluepair')
    || squashed.includes('featurevaluepair')
    || squashed.includes('featurepairs')
    || squashed.includes('keypairs');
}

export function isEbayTestingNotesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'testing notes'
    || normalized === 'testing notes json'
    || normalized === 'ebay testing notes'
    || normalized === 'ebay testing notes json'
    || normalized === 'ebay body testing notes'
    || normalized === 'ebay body testing notes json'
    || normalized === 'ebay listing testing notes'
    || normalized === 'ebay listing testing notes json'
    || normalized === 'testing_notes'
    || normalized === 'testing_notes_json'
    || normalized === 'ebay_testing_notes'
    || normalized === 'ebay_testing_notes_json'
    || normalized === 'ebay_body_testing_notes'
    || normalized === 'ebay_body_testing_notes_json'
    || normalized === 'ebay_listing_testing_notes'
    || normalized === 'ebay_listing_testing_notes_json'
    || compact === 'testingnotes'
    || compact === 'testingnotesjson'
    || compact === 'ebaytestingnotes'
    || compact === 'ebaytestingnotesjson'
    || compact === 'ebaybodytestingnotes'
    || compact === 'ebaybodytestingnotesjson'
    || compact === 'ebaylistingtestingnotes'
    || compact === 'ebaylistingtestingnotesjson';
}

export function isEbayAttributesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'ebay inventory product aspects json'
    || normalized === 'ebay inventory product aspects'
    || normalized === 'ebay inventory aspects'
    || normalized === 'ebay product aspects'
    || normalized === 'ebay aspects'
    || normalized === 'ebay_inventory_product_aspects_json'
    || normalized === 'ebay_inventory_product_aspects'
    || normalized === 'ebay_inventory_aspects'
    || compact === 'ebayinventoryproductaspectsjson'
    || compact === 'ebayinventoryproductaspects'
    || compact === 'ebayinventoryaspects'
    || compact === 'ebayproductaspects'
    || compact === 'ebayaspects';
}

export function isShopifyBodyHtmlPrimaryField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'shopify rest body html'
    || normalized === 'shopify body html'
    || normalized === 'shopify body (html)'
    || normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'shopify_rest_body_html'
    || compact === 'shopifybodyhtml';
}

export function isShopifyBodyHtmlTemplateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html template'
    || normalized === 'shopify body html template'
    || normalized === 'shopify_rest_body_html_template'
    || normalized === 'shopify_body_html_template';
}

export function isEbayBodyHtmlField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'ebay body html'
    || normalized === 'ebay body (html)'
    || normalized === 'ebay_body_html'
    || compact === 'ebaybodyhtml';
}

export function isEbayBodyHtmlTemplateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay body html template'
    || normalized === 'ebay listing template'
    || normalized === 'ebay template'
    || normalized === 'body html template'
    || normalized === 'listing template'
    || normalized === 'ebay_body_html_template'
    || normalized === 'ebay_listing_template';
}

export function isLegacyShopifySingleImageField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (/^shopify\s+rest\s+image(\s+\d+)?\s+(src|position|alt|alt\s+text)$/.test(normalized)) return true;
  if (/^shopify_rest_image(_\d+)?_(src|position|alt|alt_text)$/.test(normalized)) return true;
  if (normalized === 'image position' || normalized === 'image_position') return true;
  if (/^image\s+position\s+\d+$/.test(normalized)) return true;
  if (/^image_position_\d+$/.test(normalized)) return true;
  if (/^image\s+\d+\s+position$/.test(normalized)) return true;
  if (/^image_\d+_position$/.test(normalized)) return true;
  if (normalized === 'image alt' || normalized === 'image_alt') return true;
  if (normalized === 'image alt text' || normalized === 'image_alt_text') return true;
  if (/^image\s+alt\s+\d+$/.test(normalized)) return true;
  if (/^image_alt_\d+$/.test(normalized)) return true;
  if (/^image\s+alt\s+text\s+\d+$/.test(normalized)) return true;
  if (/^image_alt_text_\d+$/.test(normalized)) return true;
  if (/^image\s+\d+\s+alt$/.test(normalized)) return true;
  if (/^image_\d+_alt$/.test(normalized)) return true;
  if (/^image\s+\d+\s+alt\s+text$/.test(normalized)) return true;
  if (/^image_\d+_alt_text$/.test(normalized)) return true;
  return false;
}

export function isHiddenApprovalField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest product id'
    || normalized === 'shopify product id'
    || normalized === 'shopify rest vendor'
    || normalized === 'shopify vendor'
    || normalized === 'vendor'
    || normalized === 'published'
    || normalized === 'shopify published'
    || normalized === 'shopify rest published at'
    || normalized === 'shopify published at'
    || normalized === 'shopify rest published scope'
    || normalized === 'shopify published scope'
    || isLegacyShopifySingleImageField(fieldName);
}

export function isBooleanLikeValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'false';
}

export function isShopifyVariantBooleanField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  const isVariantField = normalized.includes('variant') || compact.includes('variant');
  if (!isVariantField) return false;

  const isTaxableField = normalized.includes('taxable') || compact.includes('taxable');
  const isRequiresShippingField = normalized.includes('requires shipping') || normalized.includes('requires_shipping') || compact.includes('requiresshipping');

  return isTaxableField || isRequiresShippingField;
}

export function isScalarImageField(fieldName: string, isImageUrlListField: (fieldName: string) => boolean): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (!normalized.includes('image')) return false;
  if (isImageUrlListField(fieldName)) return false;
  return /(url|src|position|alt|alt\s+text|alt_text)/.test(normalized);
}

export function isConditionMirrorSourceField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'item condition'
    || normalized === 'shopify condition'
    || normalized === 'shopify rest condition'
    || normalized === 'ebay inventory condition';
}

export function isTitleLikeField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase().includes('title');
}

export function isPriceLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('price')
    || normalized === 'ebay price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price';
}

export function isEbayPriceFieldAlias(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'price'
    || normalized === 'ebay offer price value'
    || normalized === 'ebay offer auction start price value'
    || normalized === 'ebay price'
    || normalized === 'ebay buy it now/starting bid'
    || normalized === 'ebay buy it now / starting bid'
    || normalized === 'ebay buy it now/starting price'
    || normalized === 'ebay buy it now / starting price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized.includes('buy it now')
    || normalized.includes('starting bid')
    || normalized.includes('starting price');
}

export function isFormatLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'listing format'
    || normalized === 'ebay offer format'
    || normalized === 'status';
}

export function prioritizeTitleBeforePrice(fieldNames: string[], approvalChannel?: 'shopify' | 'ebay' | 'combined'): string[] {
  return [...fieldNames].sort((left, right) => {
    const getPriority = (fieldName: string): number => {
      if (isTitleLikeField(fieldName)) return 0;
      if (isPriceLikeField(fieldName)) return 1;
      if (approvalChannel === 'ebay' && isFormatLikeField(fieldName)) return 2;
      return 3;
    };

    return getPriority(left) - getPriority(right);
  });
}

export function isEbayShippingServiceFieldName(fieldName: string, getCanonicalShippingServiceAlias: (fieldName: string) => string | null): boolean {
  return isShippingServiceField(fieldName) || getCanonicalShippingServiceAlias(fieldName) !== null;
}