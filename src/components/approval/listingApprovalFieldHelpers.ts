import { SHIPPING_SERVICE_FIELD } from '@/stores/approvalStore';
import {
  EBAY_BODY_HTML_FIELD_CANDIDATES,
  EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  EBAY_DESCRIPTION_FIELD_CANDIDATES,
  EBAY_DURATION_FIELD_CANDIDATES,
  EBAY_FORMAT_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_TESTING_NOTES_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
  EBAY_VENDOR_FIELD_CANDIDATES,
} from './listingApprovalEbayConstants';

export function normalizeEbayListingFormat(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

export function getEbayPriceFieldLabel(listingFormat: string): string {
  const normalized = normalizeEbayListingFormat(listingFormat);
  if (normalized === 'AUCTION') return 'Starting Auction Price';
  if (normalized === 'FIXED_PRICE' || normalized === 'BUY_IT_NOW') return 'Buy It Now Price';
  return 'Buy It Now/Starting Bid Price';
}

export function toApprovalFieldLabel(fieldName: string, options?: { ebayListingFormat?: string }): string {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'ebay offer price value') {
    return getEbayPriceFieldLabel(options?.ebayListingFormat ?? '');
  }

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

export function normalizeFieldLookupKey(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isTitleLikeFieldName(fieldName: string): boolean {
  return fieldName.trim().toLowerCase().includes('title');
}

export function isPriceLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('price')
    || normalized === 'ebay price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price';
}

export function isShopifyCategoryLikeFieldName(fieldName: string): boolean {
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
}

export function findEbayPriceFieldName(fieldNames: string[]): string {
  const exact = fieldNames.find((name) =>
    EBAY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
  );
  if (exact) return exact;

  const fuzzy = fieldNames.find((name) => {
    const normalized = normalizeFieldLookupKey(name);
    return normalized === 'ebayprice'
      || normalized === 'ebayofferpricevalue'
      || normalized === 'ebayofferauctionstartpricevalue'
      || normalized.includes('buyitnowstartingbid')
      || normalized.includes('buyitnowstartingprice')
      || normalized.includes('startingbid')
      || normalized.includes('startingprice');
  });

  return fuzzy ?? '';
}

export function findEbayBodyHtmlFieldName(fieldNames: string[]): string {
  const exact = fieldNames.find((name) =>
    EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
  );
  if (exact) return exact;

  const fuzzy = fieldNames.find((name) => {
    const normalized = normalizeFieldLookupKey(name);
    return normalized === 'bodyhtml'
      || normalized.includes('ebaybodyhtml')
      || normalized.includes('bodyhtml');
  });

  return fuzzy ?? '';
}

export function isEbayBodyHtmlFieldName(fieldName: string): boolean {
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

export function isEbayBodyHtmlTemplateFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay body html template'
    || normalized === 'ebay listing template'
    || normalized === 'ebay template'
    || normalized === 'body html template'
    || normalized === 'listing template'
    || normalized === 'ebay_body_html_template'
    || normalized === 'ebay_listing_template';
}

export function isEbayBodyHtmlSyncTriggerFieldName(fieldName: string): boolean {
  const normalized = normalizeFieldLookupKey(fieldName);
  if (!normalized) return false;

  const titleAndDescriptionCandidates = [
    ...EBAY_TITLE_FIELD_CANDIDATES,
    ...EBAY_DESCRIPTION_FIELD_CANDIDATES,
  ];

  if (titleAndDescriptionCandidates.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  if (EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  if (EBAY_TESTING_NOTES_FIELD_CANDIDATES.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  return normalized.includes('keyfeature')
    || normalized.includes('featurevaluepair')
    || normalized.includes('keyvaluepair')
    || normalized.includes('featurepairs')
    || normalized.includes('keypairs')
    || normalized.includes('testingnotes');
}

export function isEbayHandlingCostFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized.includes('handling cost') || compact.includes('handlingcost');
}

export function isEbayGlobalShippingFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  return (normalized.includes('global') && normalized.includes('shipping'))
    || compact.includes('globalshipping')
    || compact.includes('globalshippingprogram');
}

export function isVendorFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return EBAY_VENDOR_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)
    || normalized === 'shopify rest vendor'
    || normalized === 'shopify vendor'
    || normalized === 'shopify graphql vendor'
    || normalized === 'shopify_rest_vendor';
}

export function isShopifyGraphqlCollectionIdsFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify graphql collection ids'
    || normalized === 'shopify graphql collection id'
    || normalized === 'shopify graphql collections json'
    || normalized === 'shopify_graphql_collection_ids'
    || normalized === 'shopify_graphql_collection_id'
    || normalized === 'shopify_graphql_collections_json'
    || /^shopify\s+graphql\s+collection\s+\d+\s+id$/.test(normalized)
    || /^shopify_graphql_collection_\d+_id$/.test(normalized);
}

export function isShopifyCompoundTagsField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest tags'
    || normalized === 'shopify tags'
    || normalized === 'shopify graphql tags'
    || normalized === 'shopify graphql tags json'
    || normalized === 'shopify_rest_tags'
    || normalized === 'shopify_tags'
    || normalized === 'shopify_graphql_tags'
    || normalized === 'shopify_graphql_tags_json'
    || normalized === 'tags';
}

export function isShopifySingleTagField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return /^shopify\s+(rest|graphql|extra)?\s*tag\s+\d+$/.test(normalized)
    || /^shopify_(rest|graphql|extra)?_tag_\d+$/.test(normalized);
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

export function isShopifyVariantBarcodeFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  const isVariantField = normalized.includes('variant') || compact.includes('variant');

  if (!isVariantField) return false;

  return normalized.includes('barcode') || compact.includes('barcode');
}

export function isShopifyOnlyFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'description') return false;
  if (normalized.includes('key feature')) return false;
  if (isShopifyCompoundTagsField(fieldName) || isShopifySingleTagField(fieldName)) return true;
  return normalized.includes('shopify')
    || normalized.includes('collection')
    || normalized.includes('published scope')
    || normalized.includes('published at')
    || normalized.includes('template suffix')
    || normalized.includes('metafield')
    || normalized === 'type'
    || normalized === 'product type';
}

export function normalizeCombinedFieldName(fieldName: string): string {
  return fieldName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isItemZipCodeField(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'item zip code'
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

export function isEbayAttributesFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'ebay inventory product aspects json'
    || normalized === 'ebay inventory product aspects'
    || normalized === 'ebay inventory aspects'
    || normalized === 'ebay product aspects'
    || normalized === 'ebay aspects'
    || compact === 'ebayinventoryproductaspectsjson'
    || compact === 'ebayinventoryproductaspects'
    || compact === 'ebayinventoryaspects'
    || compact === 'ebayproductaspects'
    || compact === 'ebayaspects';
}

export function isEbayOnlyFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  if (normalized === 'description') return false;
  if (normalized.includes('key feature')) return false;
  if (isEbayTestingNotesField(fieldName)) return true;
  if (fieldName === SHIPPING_SERVICE_FIELD) return true;
  return normalized.includes('ebay')
    || normalized.includes('buy it now')
    || normalized.includes('starting bid')
    || normalized === 'domestic shipping fees'
    || normalized === 'international shipping fees'
    || normalized.includes('listing duration')
    || normalized.includes('duration')
    || normalized.includes('listing format')
    || normalized.includes('format')
    || normalized.includes('shipping service')
    || isItemZipCodeField(fieldName)
    || isEbayAttributesFieldName(fieldName)
    || normalized.includes('primary category')
    || normalized.includes('secondary category')
    || normalized.includes('merchant location')
    || normalized.includes('fulfillment policy')
    || normalized.includes('payment policy')
    || normalized.includes('return policy');
}

export function isRemovedCombinedEbayPriceFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized === 'buy it now/starting bid'
    || normalized === 'buy it now / starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized === 'ebay buy it now/starting bid'
    || normalized === 'ebay buy it now / starting bid'
    || normalized === 'ebay buy it now/starting price'
    || normalized === 'ebay buy it now / starting price';
}

export function isGenericSharedKeyFeaturesFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json';
}

export function normalizeKeyFeatureLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

export function shouldMoveTestingEntryToSharedKeyFeatures(feature: string): boolean {
  const normalized = normalizeKeyFeatureLabel(feature);
  return normalized === 'brand' || normalized === 'cable size';
}

export function shouldSerializeKeyFeatureFieldAsJson(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('json') || normalized.endsWith('_json');
}

export function serializeKeyFeatureEntries(
  entries: Array<{ feature: string; value: string }>,
  fieldName: string,
): string {
  const normalizedEntries = entries
    .map((entry) => ({
      feature: entry.feature.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.feature.length > 0 && entry.value.length > 0);

  if (normalizedEntries.length === 0) return '';

  if (shouldSerializeKeyFeatureFieldAsJson(fieldName)) {
    return JSON.stringify(normalizedEntries);
  }

  const escapeCsvCell = (cell: string): string => {
    if (!/[",\n\r]/.test(cell)) return cell;
    return `"${cell.replace(/"/g, '""')}"`;
  };

  return normalizedEntries
    .map((entry) => `${escapeCsvCell(entry.feature)},${escapeCsvCell(entry.value)}`)
    .join('\n');
}

export function isHiddenCombinedFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'images (comma separated) 2'
    || compact === 'imagescommaseparated2'
    || normalized === 'shopify approved'
    || normalized === 'ebay approved'
    || compact === 'shopifyapproved'
    || compact === 'ebayapproved'
    || normalized === 'primary category name'
    || normalized === 'secondary category name'
    || normalized === 'ebay offer primary category name'
    || normalized === 'ebay offer secondary category name';
}

export function isWorkflowOnlyListingFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  if (
    normalized === 'accepted at'
    || normalized === 'accepted by'
    || normalized === 'allocation mode'
    || normalized === 'allocation notes'
    || normalized === 'approved at'
    || normalized === 'approved by'
    || normalized === 'approved for publish at'
    || normalized === 'awaiting pre listing review at'
    || normalized === 'confirmed grand total'
    || normalized === 'offer amount'
    || normalized === 'paid amount'
    || normalized === "photo'd"
    || normalized === 'photographed at'
    || normalized === 'photographed by'
    || normalized === 'photography signed at'
    || normalized === 'photography signed by'
    || normalized === 'pick up id'
    || normalized === 'pre listing reviewed at'
    || normalized === 'pre listing reviewed by'
    || normalized === 'processing signed at'
    || normalized === 'processing signed by'
    || normalized === 'qualification complete'
    || normalized === 'qualification notes'
    || normalized === 'shipped at'
    || normalized === 'sold ready to ship at'
    || normalized === 'stale listing at'
    || normalized === 'stale recovery notes'
    || normalized === 'stale recovery status'
    || normalized === 'stale recovery updated at'
    || normalized === 'submission group id'
    || normalized === 'testing signed at'
    || normalized === 'testing signed by'
    || normalized === 'trash status'
    || normalized === 'workflow owner'
    || normalized === 'workflow owner assigned at'
    || normalized === 'workflow source'
    || normalized === 'workflow status'
    || normalized === 'listed at'
  ) {
    return true;
  }

  return compact === 'pickupid'
    || compact === 'photod'
    || compact === 'submissiongroupid'
    || compact === 'approvedat'
    || compact === 'approvedby'
    || compact === 'photographedat'
    || compact === 'photographedby'
    || normalized === 'jot form submission id'
    || compact === 'jotformsubmissionid'
    || normalized === 'workflow image metadata json'
    || normalized === 'workflow image metadata'
    || compact === 'workflowimagemetadatajson'
    || compact === 'workflowimagemetadata';
}

export function isSystemManagedListingFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  return normalized === 'e bay listing id'
    || normalized === 'e bay offer id'
    || normalized === 'shopify rest product id'
    || normalized === 'shopify product id'
    || compact === 'ebaylistingid'
    || compact === 'ebayofferid'
    || compact === 'shopifyrestproductid'
    || compact === 'shopifyproductid';
}

export function isInternalReferenceListingFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  return normalized === 'acquired from'
    || normalized === 'additional items'
    || normalized === 'arrival date'
    || normalized === 'cost'
    || normalized === 'customer cosmetic notes'
    || normalized === 'customer functional notes'
    || normalized === 'customer inclusion notes'
    || normalized === 'testing cosmetic notes'
    || normalized === 'photography cosmetic notes'
    || normalized === 'internal cosmetic notes'
    || normalized === 'internal functional notes'
    || normalized === 'internal inclusion notes'
    || normalized === 'inventory notes'
    || normalized === 'service notes'
    || normalized === 'seller email'
    || normalized === 'seller phone'
    || normalized === 'seller zip code'
    || normalized === 'seller location'
    || normalized === 'how did you hear'
    || normalized === 'mailing list opt in'
    || normalized === 'original owner'
    || normalized === 'smoke exposure'
    || compact === 'acquiredfrom'
    || compact === 'additionalitems'
    || compact === 'arrivaldate'
    || compact === 'customercosmeticnotes'
    || compact === 'customerfunctionalnotes'
    || compact === 'customerinclusionnotes'
    || compact === 'testingcosmeticnotes'
    || compact === 'photographycosmeticnotes'
    || compact === 'internalcosmeticnotes'
    || compact === 'internalfunctionalnotes'
    || compact === 'internalinclusionnotes'
    || compact === 'inventorynotes'
    || compact === 'servicenotes'
    || compact === 'selleremail'
    || compact === 'sellerphone'
    || compact === 'sellerzipcode'
    || compact === 'sellerlocation'
    || compact === 'howdidyouhear'
    || compact === 'mailinglistoptin'
    || compact === 'originalowner'
    || compact === 'smokeexposure';
}

function isNonListingRecordMetadataFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);

  return normalized === 'tested'
    || normalized === 'testing time'
    || normalized === 'service time'
    || normalized === 'shipping method'
    || normalized === 'unqualified reason'
    || normalized === 'status'
    || isShopifyVariantBarcodeFieldName(fieldName);
}

export function shouldIncludeSharedListingRecordFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);

  if (fieldName === SHIPPING_SERVICE_FIELD) return false;
  if (isNonListingRecordMetadataFieldName(fieldName)) return false;
  if (isRemovedCombinedEbayPriceFieldName(fieldName)) return false;
  if (isHiddenCombinedFieldName(fieldName)) return false;
  if (isWorkflowOnlyListingFieldName(fieldName)) return false;
  if (isSystemManagedListingFieldName(fieldName)) return false;
  if (isInternalReferenceListingFieldName(fieldName)) return false;
  if (isEbayAttributesFieldName(fieldName)) return false;
  if (isItemZipCodeField(fieldName)) return false;
  if (EBAY_FORMAT_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
  if (EBAY_DURATION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
  if (normalized === 'template name') return false;

  return true;
}

export function shouldIncludeShopifyListingRecordFieldName(fieldName: string): boolean {
  if (isNonListingRecordMetadataFieldName(fieldName)) return false;
  if (isHiddenCombinedFieldName(fieldName)) return false;
  if (isWorkflowOnlyListingFieldName(fieldName)) return false;
  if (isSystemManagedListingFieldName(fieldName)) return false;
  if (isInternalReferenceListingFieldName(fieldName)) return false;

  return isShopifyOnlyFieldName(fieldName) && !isEbayOnlyFieldName(fieldName);
}

export function shouldIncludeEbayListingRecordFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);

  if (isNonListingRecordMetadataFieldName(fieldName)) return false;
  if (isRemovedCombinedEbayPriceFieldName(fieldName)) return false;
  if (isHiddenCombinedFieldName(fieldName)) return false;
  if (isWorkflowOnlyListingFieldName(fieldName)) return false;
  if (isSystemManagedListingFieldName(fieldName)) return false;
  if (isInternalReferenceListingFieldName(fieldName)) return false;
  if (isEbayAttributesFieldName(fieldName)) return false;
  if (normalized.includes('primary category') || normalized.includes('secondary category')) return false;
  if (EBAY_FORMAT_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
  if (EBAY_DURATION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
  if (EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;

  return isEbayOnlyFieldName(fieldName) && !isShopifyOnlyFieldName(fieldName);
}

export function shouldIncludeListingRecordFieldName(
  fieldName: string,
  approvalChannel: 'shopify' | 'ebay' | 'combined',
): boolean {
  if (approvalChannel === 'shopify') {
    return shouldIncludeSharedListingRecordFieldName(fieldName) || shouldIncludeShopifyListingRecordFieldName(fieldName);
  }

  if (approvalChannel === 'ebay') {
    return shouldIncludeSharedListingRecordFieldName(fieldName) || shouldIncludeEbayListingRecordFieldName(fieldName);
  }

  return shouldIncludeSharedListingRecordFieldName(fieldName)
    || shouldIncludeShopifyListingRecordFieldName(fieldName)
    || shouldIncludeEbayListingRecordFieldName(fieldName);
}