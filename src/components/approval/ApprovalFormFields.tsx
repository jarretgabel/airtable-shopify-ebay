import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import {
  CONDITION_FIELD,
  getDropdownOptions,
  isAllowOffersField,
  isShippingServiceField,
} from '@/stores/approvalStore';
import { shopifyService } from '@/services/shopify';
import { buildShopifyBodyHtml } from '@/services/shopifyBodyHtml';
import { buildEbayBodyHtmlFromTemplate } from '@/services/ebayBodyHtml';
import { buildShopifyCollectionIdsFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
import { parseShopifyTagList, serializeShopifyTagsCsv, serializeShopifyTagsJson } from '@/services/shopifyTags';
import { EbayCategoriesSelect } from './EbayCategoriesSelect';
import { ImageUrlListEditor } from './ImageUrlListEditor';
import { ShopifyTaxonomyTypeSelect } from './ShopifyTaxonomyTypeSelect';
import { KeyFeaturesEditor } from './KeyFeaturesEditor';
import { ShopifyCollectionsSelect } from './ShopifyCollectionsSelect';
import { ShopifyTagsEditor } from './ShopifyTagsEditor';
import { ApprovalSelect } from './ApprovalSelect';
import { applyEbayCategoryIds, resolveEbaySelectedCategoryIds, resolveEbaySelectedCategoryNames } from './ebayCategoryFields';
import ebayListingInsertTemplate from '../../templates/ebay/ebay-listing-insert.html?raw';
import ebayListingImpactSlateTemplate from '../../templates/ebay/ebay-listing-impact-slate.html?raw';
import ebayListingImpactLuxeTemplate from '../../templates/ebay/ebay-listing-impact-luxe.html?raw';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const requiredBadgeClass = 'inline-block rounded-full border border-rose-400/45 bg-rose-500/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-rose-200';
const SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD = 'Shopify GraphQL Collection IDs';
type EbayListingTemplateId = 'classic' | 'impact-slate' | 'impact-luxe';

const DEFAULT_EBAY_LISTING_TEMPLATE_ID: EbayListingTemplateId = 'classic';

const EBAY_LISTING_TEMPLATES: ReadonlyArray<{
  id: EbayListingTemplateId;
  label: string;
  template: string;
}> = [
  {
    id: 'classic',
    label: 'Classic Heritage',
    template: ebayListingInsertTemplate,
  },
  {
    id: 'impact-slate',
    label: 'Impact Slate',
    template: ebayListingImpactSlateTemplate,
  },
  {
    id: 'impact-luxe',
    label: 'Impact Luxe',
    template: ebayListingImpactLuxeTemplate,
  },
] as const;

function normalizeEbayListingTemplateId(value: string): EbayListingTemplateId {
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

function resolveEbayListingTemplateHtml(templateId: EbayListingTemplateId): string {
  return EBAY_LISTING_TEMPLATES.find((option) => option.id === templateId)?.template ?? ebayListingInsertTemplate;
}

function normalizeEbayListingFormat(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function normalizeEbayListingDuration(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (trimmed === 'GOOD TILL CANCEL' || trimmed === 'GTC') return 'GTC';
  if (trimmed === '7 DAYS' || trimmed === 'DAYS_7') return 'DAYS_7';
  if (trimmed === '10 DAYS' || trimmed === 'DAYS_10') return 'DAYS_10';
  return value.trim();
}

function getEbayPriceFieldLabel(listingFormat: string): string {
  const normalized = normalizeEbayListingFormat(listingFormat);
  if (normalized === 'AUCTION') return 'Starting Auction Price';
  if (normalized === 'FIXED_PRICE' || normalized === 'BUY_IT_NOW') return 'Buy It Now Price';
  return 'Buy It Now/Starting Bid Price';
}

function toHumanReadableLabel(fieldName: string): string {
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

function isCurrencyLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const isShopifyPriceField = normalized.includes('shopify')
    && normalized.includes('price')
    && !normalized.includes('currency');
  const isGenericPriceField = normalized === 'price' || /^variant\s+\d+\s+price$/.test(normalized);

  return normalized === 'ebay offer price value'
    || normalized === 'ebay price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized.includes('handling cost')
    || isShopifyPriceField
    || isGenericPriceField;
}

function isEbayHandlingCostField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized.includes('handling cost')
    || compact.includes('handlingcost');
}

function isEbayGlobalShippingField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  return (normalized.includes('global') && normalized.includes('shipping'))
    || compact.includes('globalshipping')
    || compact.includes('globalshippingprogram');
}

function isReadOnlyApprovalField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest product id' || normalized === 'shopify product id';
}

function isShopifyTypeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'type' || normalized === 'shopify type';
}

function isShopifyTypesFreeformField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === 'shopify types';
}

function isShopifyTemplateVariantNameField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'shopify template variant name'
    || compact === 'shopifytemplatevariantname';
}

function isShopifyOptionValuesField(fieldName: string): boolean {
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

function isShopifyVariantOptionField(fieldName: string): boolean {
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

function isShopifyVariantStatusField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'shopify variant status'
    || normalized === 'shopify variant status active'
    || normalized === 'shopify_variant_status'
    || normalized === 'shopify_variant_status_active'
    || compact === 'shopifyvariantstatus'
    || compact === 'shopifyvariantstatusactive';
}

function isShopifyCompoundTagsField(fieldName: string): boolean {
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

function isShopifySingleTagField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return /^shopify\s+(rest|graphql|extra)?\s*tag\s+\d+$/.test(normalized)
    || /^shopify_(rest|graphql|extra)?_tag_\d+$/.test(normalized);
}

function isShopifyCompoundCollectionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'collection'
    || normalized === 'collections'
    || normalized === 'shopify collection'
    || normalized === 'shopify collections'
    || normalized === 'shopify collection id'
    || normalized === 'shopify collection ids'
    || normalized === 'shopify graphql collection id'
    || normalized === 'shopify graphql collection ids'
    || normalized === 'shopify graphql collections json'
    || normalized === 'shopify_collection'
    || normalized === 'shopify_collections'
    || normalized === 'shopify_collection_id'
    || normalized === 'shopify_collection_ids'
    || normalized === 'shopify_graphql_collection_id'
    || normalized === 'shopify_graphql_collection_ids'
    || normalized === 'shopify_graphql_collections_json';
}

function isShopifySingleCollectionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return /^shopify\s+graphql\s+collection\s+\d+\s+id$/.test(normalized)
    || /^shopify\s+collection\s+\d+\s+id$/.test(normalized)
    || /^collection\s+\d+\s+id$/.test(normalized)
    || /^shopify_graphql_collection_\d+_id$/.test(normalized)
    || /^shopify_collection_\d+_id$/.test(normalized)
    || /^collection_\d+_id$/.test(normalized);
}

function getShopifySingleCollectionFieldIndex(fieldName: string): number {
  const normalized = fieldName.trim().toLowerCase();
  const match = normalized.match(/collection(?:_|\s+)(\d+)(?:_|\s+)id$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizeShopifyCollectionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const embeddedGidMatch = trimmed.match(/gid:\/\/shopify\/Collection\/\d+/i);
  if (embeddedGidMatch) return embeddedGidMatch[0];
  if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Collection/${trimmed}`;
  return '';
}

function parseShopifyCollectionIds(raw: unknown): string[] {
  const values: string[] = [];

  const parseEntry = (entry: unknown) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      values.push(String(entry));
      return;
    }

    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    const candidate = record.collectionId
      ?? record.collection_id
      ?? record.collectionGid
      ?? record.collection_gid
      ?? record.admin_graphql_api_id
      ?? record.gid
      ?? record.id;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      values.push(String(candidate));
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(parseEntry);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsed.forEach(parseEntry);
        } else {
          parseEntry(parsed);
          values.push(...trimmed.split(/[\n,;|]/).map((token) => token.trim()).filter(Boolean));
        }
      } catch {
        values.push(...trimmed.split(/[\n,;|]/).map((token) => token.trim()).filter(Boolean));
      }
    }
  }

  const seen = new Set<string>();
  return values
    .map(normalizeShopifyCollectionId)
    .filter((collectionId) => {
      if (!collectionId) return false;
      const key = collectionId.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseShopifyCollectionDisplayNames(raw: unknown): string[] {
  const values: string[] = [];

  const parseEntry = (entry: unknown) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      values.push(String(entry));
      return;
    }

    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    const candidate = record.title ?? record.name ?? record.collectionTitle ?? record.collection_name;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      values.push(String(candidate));
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(parseEntry);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach(parseEntry);
      } else {
        values.push(...trimmed.split(/[\n,]/).map((token) => token.trim()).filter(Boolean));
      }
    } catch {
      values.push(...trimmed.split(/[\n,]/).map((token) => token.trim()).filter(Boolean));
    }
  }

  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      // Ignore values that are clearly collection IDs; display-name hydration should only search by labels.
      if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(value)) return false;
      if (/^\d+$/.test(value)) return false;
      return true;
    })
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isEbayPrimaryCategoryField(fieldName: string): boolean {
  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
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

function isEbaySecondaryCategoryField(fieldName: string): boolean {
  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
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

function isEbayPrimaryCategoryNameField(fieldName: string): boolean {
  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
  return normalized === 'primary category name'
    || normalized === 'primary_category_name'
    || normalized === 'ebay offer primary category name'
    || normalized === 'ebay_offer_primary_category_name'
    || normalized === 'ebay_offer_primarycategoryname';
}

function isEbaySecondaryCategoryNameField(fieldName: string): boolean {
  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
  return normalized === 'secondary category name'
    || normalized === 'secondary_category_name'
    || normalized === 'ebay offer secondary category name'
    || normalized === 'ebay_offer_secondary_category_name'
    || normalized === 'ebay_offer_secondarycategoryname';
}

function isEbayMarketplaceIdField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay offer marketplace id'
    || normalized === 'ebay_offer_marketplace_id'
    || normalized === 'ebay_offer_marketplaceid';
}

function isEbayFormatField(fieldName: string): boolean {
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

function isEbayListingDurationField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay listing duration'
    || normalized === 'listing duration'
    || normalized === 'duration'
    || (normalized.includes('listing') && normalized.includes('duration'))
    || (normalized.includes('ebay') && normalized.includes('duration'));
}

function getEbayListingDurationLabel(value: string): string {
  if (value === 'GTC') return 'Good Till Cancel';
  if (value === 'DAYS_7') return '7 Days';
  if (value === 'DAYS_10') return '10 Days';
  return value;
}

function getEbayShippingTypeLabel(value: string): string {
  if (value === 'Calculated') return 'Calculated';
  if (value === 'CalculatedDomesticFlatInternational') return 'Calculated Domestic / Flat International';
  if (value === 'Flat') return 'Flat';
  if (value === 'FlatDomesticCalculatedInternational') return 'Flat Domestic / Calculated International';
  if (value === 'FreightFlat') return 'Freight';
  if (value === 'NotSpecified') return 'Not Specified';
  return value;
}

function isEbayShippingTypeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'domestic shipping fees'
    || normalized === 'ebay domestic shipping fees'
    || normalized === 'domestic_shipping_fees'
    || normalized === 'ebay_domestic_shipping_fees';
}

function isEbayCategoriesField(fieldName: string): boolean {
  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();

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

function isLikelyDerivedAirtableField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('(from ')
    || normalized.includes('(lookup')
    || normalized.includes('(rollup')
    || normalized.includes('(formula');
}

function isShopifyCollectionJsonField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('collections json') || normalized.endsWith('_collections_json');
}

function isSingularCollectionAliasField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'collection'
    || normalized === 'shopify collection'
    || normalized === 'shopify collection id'
    || normalized === 'shopify graphql collection id'
    || normalized === 'shopify_collection'
    || normalized === 'shopify_collection_id'
    || normalized === 'shopify_graphql_collection_id';
}

function isCollectionDisplayNameField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'collections'
    || normalized === 'shopify collections'
    || normalized === 'shopify_collections';
}

function choosePreferredShopifyCompoundCollectionField(fieldNames: string[]): string | null {
  const preferredOrder = [
    'Collections',
    'Shopify Collection IDs',
    'Shopify GraphQL Collection IDs',
    'Shopify GraphQL Collections JSON',
    'shopify_collection_ids',
    'shopify_graphql_collection_ids',
    'shopify_graphql_collections_json',
  ];

  const lowerMap = new Map(fieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName]));
  for (const candidate of preferredOrder) {
    const match = lowerMap.get(candidate.toLowerCase());
    if (match) return match;
  }

  return fieldNames[0] ?? null;
}

function choosePreferredShopifyDisplayCollectionField(fieldNames: string[]): string | null {
  const preferredOrder = [
    'Collections',
  ];

  const lowerMap = new Map(fieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName]));
  for (const candidate of preferredOrder) {
    const match = lowerMap.get(candidate.toLowerCase());
    if (match) return match;
  }

  return fieldNames[0] ?? null;
}

function choosePreferredShopifyIdCollectionField(fieldNames: string[]): string | null {
  const preferredOrder = [
    'Shopify Collection IDs',
    'Shopify GraphQL Collection IDs',
    'Shopify GraphQL Collections JSON',
    'shopify_collection_ids',
    'shopify_graphql_collection_ids',
    'shopify_graphql_collections_json',
  ];

  const lowerMap = new Map(fieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName]));
  for (const candidate of preferredOrder) {
    const match = lowerMap.get(candidate.toLowerCase());
    if (match) return match;
  }

  return fieldNames[0] ?? null;
}

interface ShopifyCollectionFieldStrategy {
  sourceSingleFields: string[];
  sourceCompoundFields: string[];
  writeSingleFields: string[];
  writeCompoundFields: string[];
}

function resolveShopifyCollectionFieldStrategy(params: {
  formValues: Record<string, string>;
  singleFieldNames: string[];
  compoundFieldNames: string[];
  writableFieldNames: string[];
}): ShopifyCollectionFieldStrategy {
  const { formValues, singleFieldNames, compoundFieldNames, writableFieldNames } = params;
  const writableLookup = new Set(writableFieldNames.map((fieldName) => fieldName.toLowerCase()));
  const writableSingles = singleFieldNames.filter((fieldName) => {
    if (!writableLookup.has(fieldName.toLowerCase())) return false;
    return !isSingularCollectionAliasField(fieldName);
  });
  const writableCompounds = compoundFieldNames.filter((fieldName) => {
    if (!writableLookup.has(fieldName.toLowerCase())) return false;
    return !isSingularCollectionAliasField(fieldName);
  });
  const writableDisplayCompounds = writableCompounds.filter((fieldName) => isCollectionDisplayNameField(fieldName));
  const writableIdCompounds = writableCompounds.filter((fieldName) => !isCollectionDisplayNameField(fieldName));

  if (writableCompounds.length > 0) {
    const preferredDisplayCompound = choosePreferredShopifyDisplayCollectionField(writableDisplayCompounds);
    const preferredIdCompound = choosePreferredShopifyIdCollectionField(writableIdCompounds);
    const orderedWritableCompounds = Array.from(new Set([
      preferredDisplayCompound,
      preferredIdCompound,
      ...writableCompounds,
    ].filter((fieldName): fieldName is string => Boolean(fieldName))));

    return {
      sourceSingleFields: singleFieldNames,
      sourceCompoundFields: compoundFieldNames,
      writeSingleFields: writableSingles,
      writeCompoundFields: orderedWritableCompounds,
    };
  }

  if (writableSingles.length > 0) {
    return {
      sourceSingleFields: writableSingles,
      sourceCompoundFields: [],
      writeSingleFields: writableSingles,
      writeCompoundFields: [],
    };
  }

  const singleFieldsWithValues = singleFieldNames.filter((fieldName) => parseShopifyCollectionIds(formValues[fieldName] ?? '').length > 0);
  const compoundFieldsWithValues = compoundFieldNames.filter((fieldName) => parseShopifyCollectionIds(formValues[fieldName] ?? '').length > 0);

  if (compoundFieldsWithValues.length > 0) {
    const preferredCompound = choosePreferredShopifyCompoundCollectionField(compoundFieldsWithValues)
      ?? compoundFieldsWithValues[0];
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [preferredCompound],
    };
  }

  if (singleFieldsWithValues.length > 0) {
    return {
      sourceSingleFields: singleFieldNames,
      sourceCompoundFields: [],
      writeSingleFields: singleFieldNames,
      writeCompoundFields: [],
    };
  }

  const canonicalCollectionsField = compoundFieldNames.find((fieldName) => fieldName.trim().toLowerCase() === 'collections') ?? 'Collections';

  const preferredCompound = choosePreferredShopifyCompoundCollectionField(compoundFieldNames);
  if (preferredCompound) {
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [canonicalCollectionsField],
    };
  }

  return {
    sourceSingleFields: singleFieldNames,
    sourceCompoundFields: [],
    writeSingleFields: singleFieldNames,
    writeCompoundFields: [canonicalCollectionsField],
  };
}

function getShopifySingleTagFieldIndex(fieldName: string): number {
  const normalized = fieldName.trim().toLowerCase();
  const match = normalized.match(/tag(?:_|\s+)(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function isShopifyTagsJsonField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('tags json') || normalized.endsWith('_tags_json');
}

function choosePreferredShopifyCompoundTagField(fieldNames: string[]): string | null {
  const preferredOrder = [
    'Tags',
    'tags',
    'Shopify REST Tags',
    'Shopify Tags',
    'shopify_rest_tags',
    'shopify_tags',
    'Shopify GraphQL Tags JSON',
    'shopify_graphql_tags_json',
    'Shopify GraphQL Tags',
    'shopify_graphql_tags',
  ];

  const lowerMap = new Map(fieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName]));
  for (const candidate of preferredOrder) {
    const match = lowerMap.get(candidate.toLowerCase());
    if (match) return match;
  }

  return fieldNames[0] ?? null;
}

interface ShopifyTagFieldStrategy {
  sourceSingleFields: string[];
  sourceCompoundFields: string[];
  writeSingleFields: string[];
  writeCompoundFields: string[];
}

function resolveShopifyTagFieldStrategy(params: {
  formValues: Record<string, string>;
  singleFieldNames: string[];
  compoundFieldNames: string[];
  writableFieldNames: string[];
}): ShopifyTagFieldStrategy {
  const { formValues, singleFieldNames, compoundFieldNames, writableFieldNames } = params;
  const writableLookup = new Set(writableFieldNames.map((fieldName) => fieldName.toLowerCase()));
  const writableSingles = singleFieldNames.filter((fieldName) => writableLookup.has(fieldName.toLowerCase()));
  const writableCompounds = compoundFieldNames.filter((fieldName) => writableLookup.has(fieldName.toLowerCase()));

  if (writableCompounds.length > 0) {
    const preferredCompound = choosePreferredShopifyCompoundTagField(writableCompounds)
      ?? writableCompounds[0];
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [preferredCompound],
    };
  }

  if (writableSingles.length > 0) {
    return {
      sourceSingleFields: writableSingles,
      sourceCompoundFields: [],
      writeSingleFields: writableSingles,
      writeCompoundFields: [],
    };
  }

  const singleFieldsWithValues = singleFieldNames.filter((fieldName) => parseShopifyTagList(formValues[fieldName] ?? '').length > 0);
  const compoundFieldsWithValues = compoundFieldNames.filter((fieldName) => parseShopifyTagList(formValues[fieldName] ?? '').length > 0);

  if (compoundFieldsWithValues.length > 0) {
    const preferredCompound = choosePreferredShopifyCompoundTagField(compoundFieldsWithValues)
      ?? compoundFieldsWithValues[0];
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [preferredCompound],
    };
  }

  if (singleFieldsWithValues.length > 0) {
    return {
      sourceSingleFields: singleFieldNames,
      sourceCompoundFields: [],
      writeSingleFields: singleFieldNames,
      writeCompoundFields: [],
    };
  }

  const preferredCompound = choosePreferredShopifyCompoundTagField(compoundFieldNames);
  if (preferredCompound) {
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [preferredCompound],
    };
  }

  return {
    sourceSingleFields: singleFieldNames,
    sourceCompoundFields: [],
    writeSingleFields: singleFieldNames,
    writeCompoundFields: [],
  };
}

function isShopifyBodyDescriptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify body description'
    || normalized === 'shopify rest body description'
    || normalized === 'item description'
    || normalized === 'description'
    || normalized === 'shopify_body_description'
    || normalized === 'shopify_rest_body_description';
}

function isEbayBodyDescriptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'description'
    || normalized === 'item description'
    || normalized === 'ebay inventory product description'
    || normalized === 'ebay_inventory_product_description';
}

function isShopifyKeyFeaturesField(fieldName: string): boolean {
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

function isEbayKeyFeaturesField(fieldName: string): boolean {
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

function isShopifyBodyHtmlPrimaryField(fieldName: string): boolean {
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

function isShopifyBodyHtmlTemplateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html template'
    || normalized === 'shopify body html template'
    || normalized === 'shopify_rest_body_html_template'
    || normalized === 'shopify_body_html_template';
}

function isEbayBodyHtmlField(fieldName: string): boolean {
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

function isEbayBodyHtmlTemplateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay body html template'
    || normalized === 'ebay listing template'
    || normalized === 'ebay template'
    || normalized === 'body html template'
    || normalized === 'listing template'
    || normalized === 'ebay_body_html_template'
    || normalized === 'ebay_listing_template';
}

function isLegacyShopifySingleImageField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();

  // Human-readable naming variants from Airtable templates.
  if (/^shopify\s+rest\s+image(\s+\d+)?\s+(src|position|alt|alt\s+text)$/.test(normalized)) return true;

  // API-style snake_case naming variants.
  if (/^shopify_rest_image(_\d+)?_(src|position|alt|alt_text)$/.test(normalized)) return true;

  // Generic legacy image position fields that should not be edited directly.
  if (normalized === 'image position' || normalized === 'image_position') return true;
  if (/^image\s+position\s+\d+$/.test(normalized)) return true;
  if (/^image_position_\d+$/.test(normalized)) return true;
  if (/^image\s+\d+\s+position$/.test(normalized)) return true;
  if (/^image_\d+_position$/.test(normalized)) return true;

  // Generic legacy image alt fields that should not be edited directly.
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

function isHiddenApprovalField(fieldName: string): boolean {
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

function isBooleanLikeValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'false';
}

function isShopifyVariantBooleanField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  const isVariantField = normalized.includes('variant') || compact.includes('variant');
  if (!isVariantField) return false;

  const isTaxableField = normalized.includes('taxable') || compact.includes('taxable');
  const isRequiresShippingField = normalized.includes('requires shipping') || normalized.includes('requires_shipping') || compact.includes('requiresshipping');

  return isTaxableField || isRequiresShippingField;
}

function normalizeImageFieldName(fieldName: string): string {
  return fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
}

function isGenericImageUrlField(fieldName: string): boolean {
  const normalized = normalizeImageFieldName(fieldName);
  return normalized === 'images'
    || normalized === 'image url'
    || normalized === 'image urls'
    || normalized === 'image-url'
    || normalized === 'image-urls'
    || normalized === 'image_url'
    || normalized === 'image_urls'
    || /^image\s+url\s+\d+$/.test(normalized)
    || /^image\s+urls\s+\d+$/.test(normalized)
    || /^image-url-\d+$/.test(normalized)
    || /^image-urls-\d+$/.test(normalized)
    || /^image_url_\d+$/.test(normalized)
    || /^image_urls_\d+$/.test(normalized)
    || /^image\s+\d+\s+url$/.test(normalized)
    || /^image\s+\d+\s+urls$/.test(normalized)
    || /^image-\d+-url$/.test(normalized)
    || /^image-\d+-urls$/.test(normalized)
    || /^image_\d+_url$/.test(normalized)
    || /^image_\d+_urls$/.test(normalized);
}

function isGenericImagePositionField(fieldName: string): boolean {
  const normalized = normalizeImageFieldName(fieldName);
  return normalized === 'image position'
    || normalized === 'image_position'
    || /^image\s+position\s+\d+$/.test(normalized)
    || /^image_position_\d+$/.test(normalized)
    || /^image\s+\d+\s+position$/.test(normalized)
    || /^image_\d+_position$/.test(normalized);
}

function isGenericImageAltField(fieldName: string): boolean {
  const normalized = normalizeImageFieldName(fieldName);
  return normalized === 'image alt'
    || normalized === 'images alt'
    || normalized === 'image_alt'
    || normalized === 'images_alt'
    || normalized === 'image alt text'
    || normalized === 'images alt text'
    || normalized === 'image_alt_text'
    || normalized === 'images_alt_text'
    || /^image\s+alt\s+\d+$/.test(normalized)
    || /^image_alt_\d+$/.test(normalized)
    || /^image\s+alt\s+text\s+\d+$/.test(normalized)
    || /^image_alt_text_\d+$/.test(normalized)
    || /^image\s+\d+\s+alt$/.test(normalized)
    || /^image_\d+_alt$/.test(normalized)
    || /^image\s+\d+\s+alt\s+text$/.test(normalized)
    || /^image_\d+_alt_text$/.test(normalized);
}

function isGenericImageScalarField(fieldName: string): boolean {
  return isGenericImageUrlField(fieldName)
    || isGenericImagePositionField(fieldName)
    || isGenericImageAltField(fieldName);
}

function isHiddenCombinedFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'images (comma separated) 2'
    || compact === 'imagescommaseparated2'
    || normalized === 'shopify approved'
    || normalized === 'ebay approved'
    || compact === 'shopifyapproved'
    || compact === 'ebayapproved';
}

function isShopifyImagePayloadField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest images json'
    || normalized === 'shopify images json'
    || normalized === 'shopify_rest_images_json'
    || normalized === 'shopify_images_json'
    || normalized === 'shopify rest images'
    || normalized === 'shopify images'
    || normalized === 'shopify_rest_images'
    || normalized === 'shopify_images';
}

function isEbayInventoryImageUrlsField(fieldName: string): boolean {
  const normalized = normalizeImageFieldName(fieldName);
  return normalized === 'ebay inventory product image urls json'
    || normalized === 'ebay inventory product imageurls json'
    || normalized === 'ebay_inventory_product_imageurls_json';
}

function isEbayPhotoCountMaxField(fieldName: string): boolean {
  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();

  return normalized === 'photo count max'
    || normalized === 'photo_count_max'
    || normalized === 'ebay photo count max'
    || normalized === 'ebay_photo_count_max';
}

interface ImageEditorRow {
  src: string;
  alt: string;
}

function parseImageEditorRows(raw: string): ImageEditorRow[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
      const values = Array.isArray(parsed) ? parsed : [parsed];
      return values
        .map((item) => {
          if (typeof item === 'string') {
            return { src: item.trim(), alt: '' };
          }

          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            const directUrl = typeof record.url === 'string' ? record.url.trim() : '';
            const thumbnailLarge =
              record.thumbnails
              && typeof record.thumbnails === 'object'
              && (record.thumbnails as Record<string, unknown>).large
              && typeof (record.thumbnails as Record<string, unknown>).large === 'object'
                ? ((record.thumbnails as Record<string, unknown>).large as Record<string, unknown>).url
                : '';
            return {
              src:
                (typeof record.src === 'string' ? record.src.trim() : '')
                || directUrl
                || (typeof thumbnailLarge === 'string' ? thumbnailLarge.trim() : ''),
              alt: typeof record.alt === 'string' ? record.alt.trim() : '',
            };
          }

          return { src: '', alt: '' };
        })
        .filter((row) => row.src.length > 0 || row.alt.length > 0);
    }
  } catch {
    // fall back to plain-text parsing
  }

  return trimmed
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((src) => ({ src, alt: '' }));
}

function toCommaSeparatedImageValues(values: string[]): string {
  return values.map((value) => value.trim()).join(', ');
}

function pickPreferredField(
  candidates: string[],
  preferredNames: string[],
  values: Record<string, string>,
): string | undefined {
  if (candidates.length === 0) return undefined;

  const preferredLookup = preferredNames.map((name) => name.toLowerCase());
  const hasValue = (fieldName: string) => (values[fieldName] ?? '').trim().length > 0;

  for (const preferredName of preferredLookup) {
    const match = candidates.find((fieldName) => fieldName.toLowerCase() === preferredName && hasValue(fieldName));
    if (match) return match;
  }

  const firstWithValue = candidates.find((fieldName) => hasValue(fieldName));
  if (firstWithValue) return firstWithValue;

  for (const preferredName of preferredLookup) {
    const match = candidates.find((fieldName) => fieldName.toLowerCase() === preferredName);
    if (match) return match;
  }

  return candidates[0];
}

/**
 * Returns true for fields that store a list of image URLs — either as a
 * JSON array of strings or as a JSON array of Shopify image objects { src, alt, position }.
 * These fields get the drag-and-droppable ImageUrlListEditor instead of a textarea.
 */
function isImageUrlListField(fieldName: string): boolean {
  const n = fieldName.trim().toLowerCase();
  // Shopify REST/GraphQL images JSON  (e.g. "Shopify REST Images JSON", "shopify_rest_images_json")
  if (/shopify\s*(rest|graphql)?\s*images?\s*json/.test(n)) return true;
  if (n === 'shopify_rest_images_json' || n === 'shopify_images_json') return true;

  // Shopify list-style images fields without explicit "JSON" suffix.
  if (n === 'shopify rest images' || n === 'shopify images') return true;
  if (n === 'shopify_rest_images' || n === 'shopify_images') return true;

  // Generic Airtable field used by the Shopify listing detail page.
  // Value is commonly a comma-separated list that ImageUrlListEditor can parse.
  if (isGenericImageUrlField(fieldName)) return true;

  // eBay inventory product image URLs JSON
  if (/ebay\s*inventory\s*product\s*image\s*url/.test(n)) return true;
  if (n === 'ebay_inventory_product_imageurls_json') return true;
  return false;
}

interface ApprovalFormFieldsProps {
  recordId?: string;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  forceShowShopifyCollectionsEditor?: boolean;
  isCombinedApproval?: boolean;
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
  onBodyHtmlPreviewChange?: (value: string) => void;
  selectedEbayTemplateId?: string;
  onEbayTemplateIdChange?: (templateId: EbayListingTemplateId) => void;
}

function isScalarImageField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (!normalized.includes('image')) return false;
  if (isImageUrlListField(fieldName)) return false;
  return /(url|src|position|alt|alt\s+text|alt_text)/.test(normalized);
}

function isConditionMirrorSourceField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'item condition'
    || normalized === 'shopify condition'
    || normalized === 'shopify rest condition'
    || normalized === 'ebay inventory condition';
}

function isTitleLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('title');
}

function isPriceLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('price')
    || normalized === 'ebay price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price';
}

function isEbayPriceFieldAlias(fieldName: string): boolean {
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

function isFormatLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'listing format'
    || normalized === 'ebay offer format'
    || normalized === 'status';
}

function prioritizeTitleBeforePrice(fieldNames: string[], approvalChannel?: 'shopify' | 'ebay' | 'combined'): string[] {
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

export function ApprovalFormFields({
  recordId,
  approvalChannel,
  forceShowShopifyCollectionsEditor = false,
  isCombinedApproval = false,
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

  const isShopifyCategoryLikeField = (fieldName: string): boolean => {
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
  };

  const matchesRequiredFieldGroup = (fieldName: string, normalizedRequiredNames: string[]): boolean => {
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
  };

  const isForcedEbayPriceRequiredField = (fieldName: string): boolean => {
    if (!hasEbayRequiredPriceField) return false;
    if (approvalChannel !== 'ebay' && approvalChannel !== 'combined') return false;
    return isEbayPriceFieldAlias(fieldName);
  };

  const isRequiredField = (fieldName: string): boolean => (
    matchesRequiredFieldGroup(fieldName, normalizedRequiredFieldNames)
    || isForcedEbayPriceRequiredField(fieldName)
  );
  const isShopifyRequiredField = (fieldName: string): boolean => matchesRequiredFieldGroup(fieldName, normalizedShopifyRequiredFieldNames);
  const isEbayRequiredField = (fieldName: string): boolean => (
    matchesRequiredFieldGroup(fieldName, normalizedEbayRequiredFieldNames)
    || isForcedEbayPriceRequiredField(fieldName)
  );
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
  }, [allFieldNames, approvalChannel, normalizedRequiredFieldNames]);
  const requiredOrderedFieldNames = useMemo(
    () => orderedFieldNames.filter((fieldName) => isRequiredField(fieldName)),
    [orderedFieldNames, normalizedRequiredFieldNames],
  );
  const optionalOrderedFieldNames = useMemo(
    () => orderedFieldNames.filter((fieldName) => !isRequiredField(fieldName)),
    [orderedFieldNames, normalizedRequiredFieldNames],
  );
  const isEbayListingForm = allFieldNames.some((fieldName) => {
    const normalized = fieldName.toLowerCase();
    return normalized.startsWith('ebay ') || normalized.startsWith('ebay_');
  });
  const ebayFormatFieldName = allFieldNames.find((fieldName) => isEbayFormatField(fieldName));
  const pinnedPreDescriptionFieldName = isEbayListingForm ? ebayFormatFieldName : undefined;
  const ebayListingFormat = ebayFormatFieldName ? (formValues[ebayFormatFieldName] ?? '') : '';
  const toFieldLabel = (fieldName: string): string => {
    if (isEbayListingForm && fieldName.trim().toLowerCase() === 'ebay offer price value') {
      return getEbayPriceFieldLabel(ebayListingFormat);
    }

    const baseLabel = toHumanReadableLabel(fieldName);
    return baseLabel;
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

  const preferredShopifyPriceFieldName = useMemo(
    () => pickPreferredField(
      allFieldNames.filter((fieldName) => {
        const normalized = fieldName.trim().toLowerCase();
        return normalized === 'shopify rest variant 1 price'
          || normalized === 'shopify variant 1 price'
          || normalized === 'shopify_rest_variant_1_price'
          || normalized === 'shopify price'
          || normalized === 'price';
      }),
      [
        'Shopify REST Variant 1 Price',
        'Shopify Variant 1 Price',
        'shopify_rest_variant_1_price',
        'Shopify Price',
        'Price',
      ],
      formValues,
    ),
    [allFieldNames, formValues],
  );

  const imageUrlSourceField = pickPreferredField(
    allFieldNames.filter((fieldName) => !isHiddenCombinedFieldName(fieldName) && isGenericImageUrlField(fieldName)),
    ['Images', 'images', 'Image URLs', 'image_urls', 'Image URL', 'image_url'],
    formValues,
  );
  const imageAltTextSourceField = pickPreferredField(
    allFieldNames.filter((fieldName) => isGenericImageAltField(fieldName)),
    ['Images Alt Text', 'images_alt_text', 'Image Alt Text', 'image_alt_text'],
    formValues,
  );
  const shopifyImagePayloadFieldName = pickPreferredField(
    allFieldNames.filter((fieldName) => isShopifyImagePayloadField(fieldName)),
    [
      'Shopify REST Images JSON',
      'shopify_rest_images_json',
      'Shopify Images JSON',
      'shopify_images_json',
      'Shopify REST Images',
      'shopify_rest_images',
      'Shopify Images',
      'shopify_images',
    ],
    formValues,
  );
  const useCombinedImageAltEditor = Boolean(
    (isEbayListingForm || isCombinedApproval)
    && imageUrlSourceField
    && imageAltTextSourceField
    && imageUrlSourceField !== imageAltTextSourceField,
  );
  const combinedImageEditorValue = useCombinedImageAltEditor
    ? JSON.stringify((() => {
      const urlRows = parseImageEditorRows(formValues[imageUrlSourceField ?? ''] ?? '');
      const altParts = (formValues[imageAltTextSourceField ?? ''] ?? '')
        .split(/[\n,]/)
        .map((part) => part.trim());
      const rowCount = Math.max(urlRows.length, altParts.filter((part) => part.length > 0).length);

      if (rowCount === 0) return [] as Array<{ src: string; alt: string }>;

      return Array.from({ length: rowCount }, (_unused, index) => ({
        src: urlRows[index]?.src ?? '',
        alt: altParts[index] ?? urlRows[index]?.alt ?? '',
      }));
    })())
    : '';
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
  }, [originalFieldValues, formValues]);
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
  const setEbayCategoryIds = (nextIds: string[]) => {
    applyEbayCategoryIds(nextIds, {
      categoriesFieldName: effectiveEbayCategoriesFieldName,
      primaryCategoryFieldName: ebayPrimaryCategoryFieldName,
      secondaryCategoryFieldName: ebaySecondaryCategoryFieldName,
    }, setFormValue);
  };
  const hasCanonicalConditionField = allFieldNames.some((fieldName) => fieldName.trim().toLowerCase() === 'condition');
  const isShopifyApprovalForm = approvalChannel === 'shopify';
  const isEbayApprovalForm = approvalChannel === 'ebay';
  useEffect(() => {
    if (!isEbayApprovalForm) return;

    const nextPrimaryCategoryName = ebaySelectedCategoryNames[0] ?? '';
    const nextSecondaryCategoryName = ebaySelectedCategoryNames[1] ?? '';

    if (ebayPrimaryCategoryNameFieldName && nextPrimaryCategoryName && (formValues[ebayPrimaryCategoryNameFieldName] ?? '').trim() !== nextPrimaryCategoryName) {
      setFormValue(ebayPrimaryCategoryNameFieldName, nextPrimaryCategoryName);
    }

    if (ebaySecondaryCategoryNameFieldName && nextSecondaryCategoryName && (formValues[ebaySecondaryCategoryNameFieldName] ?? '').trim() !== nextSecondaryCategoryName) {
      setFormValue(ebaySecondaryCategoryNameFieldName, nextSecondaryCategoryName);
    }
  }, [
    ebayPrimaryCategoryNameFieldName,
    ebaySecondaryCategoryNameFieldName,
    ebaySelectedCategoryNames,
    formValues,
    isEbayApprovalForm,
    setFormValue,
  ]);
  const shopifyBodyDescriptionFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyDescriptionField(fieldName))
    : undefined;
  const ebayBodyDescriptionFieldName = isEbayApprovalForm
    ? allFieldNames.find((fieldName) => isEbayBodyDescriptionField(fieldName))
    : undefined;
  const shopifyKeyFeaturesFieldName = (!isCombinedApproval && isShopifyApprovalForm)
    ? allFieldNames.find((fieldName) => isShopifyKeyFeaturesField(fieldName))
    : undefined;
  const ebayKeyFeaturesFieldName = (!isCombinedApproval && isEbayApprovalForm)
    ? allFieldNames.find((fieldName) => isEbayKeyFeaturesField(fieldName))
    : undefined;
  const shopifyBodyHtmlFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyHtmlPrimaryField(fieldName))
    : undefined;
  const shopifyBodyHtmlTemplateFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyHtmlTemplateField(fieldName))
    : undefined;
  const ebayBodyHtmlFieldName = isEbayApprovalForm
    ? allFieldNames.find((fieldName) => isEbayBodyHtmlField(fieldName))
    : undefined;
  const ebayBodyHtmlTemplateFieldName = isEbayApprovalForm
    ? allFieldNames.find((fieldName) => isEbayBodyHtmlTemplateField(fieldName))
    : undefined;
  const ebayTitleFieldName = isEbayApprovalForm
    ? pickPreferredField(
      allFieldNames.filter((fieldName) => isTitleLikeField(fieldName)),
      [
        'eBay Inventory Product Title',
        'eBay Product Title',
        'eBay Title',
        'Title',
        'title',
      ],
      formValues,
    )
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
  const activeBodyDescriptionFieldName = shopifyBodyDescriptionFieldName ?? ebayBodyDescriptionFieldName;
  const shopifyCompoundTagFieldNames = useMemo(
    () => allFieldNames.filter((fieldName) => isShopifyCompoundTagsField(fieldName)),
    [allFieldNames],
  );
  const shopifySingleTagFieldNames = useMemo(
    () => allFieldNames
      .filter((fieldName) => isShopifySingleTagField(fieldName))
      .sort((left, right) => getShopifySingleTagFieldIndex(left) - getShopifySingleTagFieldIndex(right)),
    [allFieldNames],
  );
  const shopifyTagStrategy = useMemo(
    () => resolveShopifyTagFieldStrategy({
      formValues,
      singleFieldNames: shopifySingleTagFieldNames,
      compoundFieldNames: shopifyCompoundTagFieldNames,
      writableFieldNames,
    }),
    [formValues, shopifyCompoundTagFieldNames, shopifySingleTagFieldNames, writableFieldNames],
  );
  const hasShopifyTagEditor = shopifyCompoundTagFieldNames.length > 0 || shopifySingleTagFieldNames.length > 0;
  const shopifyTagValues = useMemo(() => {
    const compoundTags = shopifyTagStrategy.sourceCompoundFields.flatMap((fieldName) => parseShopifyTagList(formValues[fieldName] ?? ''));
    const singleTags = shopifyTagStrategy.sourceSingleFields.flatMap((fieldName) => parseShopifyTagList(formValues[fieldName] ?? ''));
    return parseShopifyTagList([...singleTags, ...compoundTags]);
  }, [formValues, shopifyTagStrategy.sourceCompoundFields, shopifyTagStrategy.sourceSingleFields]);

  const shopifyCompoundCollectionFieldNames = useMemo(
    () => allFieldNames.filter((fieldName) => isShopifyCompoundCollectionField(fieldName)),
    [allFieldNames],
  );
  const shopifySingleCollectionFieldNames = useMemo(
    () => allFieldNames
      .filter((fieldName) => isShopifySingleCollectionField(fieldName))
      .sort((left, right) => getShopifySingleCollectionFieldIndex(left) - getShopifySingleCollectionFieldIndex(right)),
    [allFieldNames],
  );
  const shopifyCollectionStrategy = useMemo(
    () => resolveShopifyCollectionFieldStrategy({
      formValues,
      singleFieldNames: shopifySingleCollectionFieldNames,
      compoundFieldNames: shopifyCompoundCollectionFieldNames,
      writableFieldNames,
    }),
    [formValues, shopifyCompoundCollectionFieldNames, shopifySingleCollectionFieldNames, writableFieldNames],
  );
  const hasShopifyCollectionEditor = forceShowShopifyCollectionsEditor
    || shopifyCompoundCollectionFieldNames.length > 0
    || shopifySingleCollectionFieldNames.length > 0;
  const shopifyCollectionSourceFieldNames = useMemo(
    () => Array.from(new Set([
      ...shopifyCompoundCollectionFieldNames,
      ...shopifySingleCollectionFieldNames,
      SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
    ])),
    [shopifyCompoundCollectionFieldNames, shopifySingleCollectionFieldNames],
  );
  const shopifyCollectionIds = useMemo(() => {
    const collectionSourceFields = Object.fromEntries(
      shopifyCollectionSourceFieldNames.map((fieldName) => [fieldName, formValues[fieldName] ?? '']),
    );
    return buildShopifyCollectionIdsFromApprovalFields(collectionSourceFields);
  }, [formValues, shopifyCollectionSourceFieldNames]);
  const shopifyCollectionDisplayNames = useMemo(() => {
    return shopifyCollectionSourceFieldNames
      .flatMap((fieldName) => {
        const rawValue = formValues[fieldName] ?? '';
        const parsedNames = parseShopifyCollectionDisplayNames(rawValue);
        if (parsedNames.length === 0) return [];

        // Some schemas use singular "Collection" for IDs and others for display names.
        // Keep names only when this field is explicitly display-oriented or currently has no parseable IDs.
        if (!isCollectionDisplayNameField(fieldName) && parseShopifyCollectionIds(rawValue).length > 0) {
          return [];
        }

        return parsedNames;
      });
  }, [formValues, shopifyCollectionSourceFieldNames]);
  const [collectionEditorFallbackIds, setCollectionEditorFallbackIds] = useState<string[]>([]);
  const [collectionEditorLabelsById, setCollectionEditorLabelsById] = useState<Record<string, string>>({});
  const collectionHydrationAttemptKeyRef = useRef<string>('');
  const effectiveShopifyCollectionIds = shopifyCollectionIds.length > 0
    ? shopifyCollectionIds
    : collectionEditorFallbackIds;

  const shopifyCollectionDisplayNamesKey = useMemo(
    () => `${recordId ?? ''}::${shopifyCollectionDisplayNames.map((name) => name.trim().toLowerCase()).filter(Boolean).join('|')}`,
    [recordId, shopifyCollectionDisplayNames],
  );

  useEffect(() => {
    collectionHydrationAttemptKeyRef.current = '';
    setCollectionEditorFallbackIds([]);
    setCollectionEditorLabelsById({});
  }, [recordId]);

  useEffect(() => {
    if (shopifyCollectionIds.length > 0) {
      setCollectionEditorFallbackIds(shopifyCollectionIds);
    }
  }, [shopifyCollectionIds]);

  useEffect(() => {
    if (shopifyCollectionIds.length > 0 || shopifyCollectionDisplayNames.length === 0) return;

    const attemptKey = shopifyCollectionDisplayNamesKey;
    if (!attemptKey || collectionHydrationAttemptKeyRef.current === attemptKey) return;
    collectionHydrationAttemptKeyRef.current = attemptKey;

    let cancelled = false;
    void (async () => {
      const resolvedIds: string[] = [];
      const resolvedLabels: Record<string, string> = {};

      for (const name of shopifyCollectionDisplayNames) {
        try {
          const matches = await shopifyService.searchCollections(name, 25);
          const normalizedName = name.trim().toLowerCase();
          const exactMatch = matches.find((match) => match.title.trim().toLowerCase() === normalizedName);
          const chosen = exactMatch ?? (matches.length === 1 ? matches[0] : null);
          if (!chosen) continue;
          if (!resolvedIds.includes(chosen.id)) {
            resolvedIds.push(chosen.id);
          }
          resolvedLabels[chosen.id] = chosen.title;
        } catch {
          // Keep hydration resilient; unresolved names remain in the Collections text field.
        }
      }

      if (cancelled || resolvedIds.length === 0) return;
      setCollectionEditorFallbackIds(resolvedIds);
      setCollectionEditorLabelsById((current) => ({ ...current, ...resolvedLabels }));

      const nextPreviewValue = JSON.stringify(resolvedIds);
      if ((formValues[SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD] ?? '') !== nextPreviewValue) {
        setFormValue(SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD, nextPreviewValue);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formValues, setFormValue, shopifyCollectionDisplayNames, shopifyCollectionDisplayNamesKey, shopifyCollectionIds.length]);

  function setShopifyTagValues(nextTags: string[]) {
    const normalizedTags = parseShopifyTagList(nextTags);

    shopifyTagStrategy.writeSingleFields.forEach((fieldName, index) => {
      setFormValue(fieldName, normalizedTags[index] ?? '');
    });

    shopifyTagStrategy.writeCompoundFields.forEach((fieldName) => {
      const fieldKind = fieldKinds[fieldName] ?? 'text';
      setFormValue(
        fieldName,
        normalizedTags.length === 0
          ? ''
          : fieldKind === 'json' || isShopifyTagsJsonField(fieldName)
          ? serializeShopifyTagsJson(normalizedTags)
          : serializeShopifyTagsCsv(normalizedTags),
      );
    });
  }

  function setShopifyCollectionIds(nextCollectionIds: string[], collectionLabelsById: Record<string, string> = {}) {
    const normalizedCollections = parseShopifyCollectionIds(nextCollectionIds);
    setCollectionEditorFallbackIds(normalizedCollections);
    const canonicalCollectionsFieldName = allFieldNames.find((fieldName) => fieldName.trim().toLowerCase() === 'collections') ?? 'Collections';

    const effectiveCollectionLabelsById: Record<string, string> = {
      ...collectionEditorLabelsById,
      ...collectionLabelsById,
    };
    setCollectionEditorLabelsById(effectiveCollectionLabelsById);

    const normalizedCollectionLabels = normalizedCollections
      .map((collectionId) => effectiveCollectionLabelsById[collectionId]?.trim() ?? '')
      .filter(Boolean);

    shopifyCollectionStrategy.writeSingleFields.forEach((fieldName, index) => {
      if (isSingularCollectionAliasField(fieldName)) return;

      if (isCollectionDisplayNameField(fieldName)) {
        const fieldKind = fieldKinds[fieldName] ?? 'text';
        const nextSingleLabel = normalizedCollectionLabels[index] ?? '';
        if (fieldKind === 'json') {
          const nextSingle = nextSingleLabel ? [nextSingleLabel] : [];
          setFormValue(fieldName, nextSingle.length > 0 ? JSON.stringify(nextSingle) : '');
          return;
        }

        setFormValue(fieldName, nextSingleLabel);
        return;
      }

      setFormValue(fieldName, normalizedCollections[index] ?? '');
    });


    const canonicalCollectionsFieldKind = fieldKinds[canonicalCollectionsFieldName] ?? 'text';
    const writeCanonicalAsDisplayNames = isCollectionDisplayNameField(canonicalCollectionsFieldName);
    if (normalizedCollections.length === 0) {
      setFormValue(canonicalCollectionsFieldName, '');
    } else if (writeCanonicalAsDisplayNames) {
      if (canonicalCollectionsFieldKind === 'json') {
        setFormValue(canonicalCollectionsFieldName, normalizedCollectionLabels.length > 0 ? JSON.stringify(normalizedCollectionLabels) : '');
      } else {
        setFormValue(canonicalCollectionsFieldName, normalizedCollectionLabels.join(', '));
      }
    } else if (canonicalCollectionsFieldKind === 'json' || isShopifyCollectionJsonField(canonicalCollectionsFieldName)) {
      setFormValue(canonicalCollectionsFieldName, JSON.stringify(normalizedCollections));
    } else {
      setFormValue(canonicalCollectionsFieldName, normalizedCollections.join(', '));
    }
    const writtenCollectionFields = new Set<string>([
      ...shopifyCollectionStrategy.writeSingleFields,
      ...shopifyCollectionStrategy.writeCompoundFields,
    ].map((fieldName) => fieldName.toLowerCase()));

    shopifyCollectionStrategy.writeCompoundFields.forEach((fieldName) => {
      const fieldKind = fieldKinds[fieldName] ?? 'text';

      if (normalizedCollections.length === 0) {
        setFormValue(fieldName, '');
        return;
      }

      if (isCollectionDisplayNameField(fieldName)) {
        if (fieldKind === 'json') {
          setFormValue(fieldName, normalizedCollectionLabels.length > 0 ? JSON.stringify(normalizedCollectionLabels) : '');
          return;
        }

        setFormValue(
          fieldName,
          normalizedCollectionLabels.join(', '),
        );
        return;
      }

      if (fieldKind === 'json' || isShopifyCollectionJsonField(fieldName)) {
        setFormValue(fieldName, JSON.stringify(normalizedCollections));
        return;
      }

      setFormValue(
        fieldName,
        normalizedCollections.join(', '),
      );
    });

    const fallbackIdField = [
      ...shopifyCollectionStrategy.sourceCompoundFields,
      ...shopifyCollectionStrategy.sourceSingleFields,
      ...shopifyCompoundCollectionFieldNames,
      ...shopifySingleCollectionFieldNames,
    ].find((fieldName) => {
      const normalizedName = fieldName.trim().toLowerCase();
      return !isCollectionDisplayNameField(fieldName) && !writtenCollectionFields.has(normalizedName);
    });

    if (fallbackIdField) {
      if (isSingularCollectionAliasField(fallbackIdField)) {
        setFormValue(
          SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
          normalizedCollections.length > 0 ? JSON.stringify(normalizedCollections) : '',
        );
        return;
      }

      const fieldKind = fieldKinds[fallbackIdField] ?? 'text';

      if (normalizedCollections.length === 0) {
        setFormValue(fallbackIdField, '');
      } else if (fieldKind === 'json' || isShopifyCollectionJsonField(fallbackIdField)) {
        setFormValue(fallbackIdField, JSON.stringify(normalizedCollections));
      } else {
        setFormValue(
          fallbackIdField,
          normalizedCollections.join(', '),
        );
      }
    }
    setFormValue(
      SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
      normalizedCollections.length > 0 ? JSON.stringify(normalizedCollections) : '',
    );

  }

  const derivedBodyHtmlPreview = useMemo(() => {
    if (isShopifyApprovalForm) {
      if (!shopifyBodyDescriptionFieldName && !shopifyKeyFeaturesFieldName) return '';

      const descriptionValue = shopifyBodyDescriptionFieldName ? (formValues[shopifyBodyDescriptionFieldName] ?? '') : '';
      const keyFeaturesValue = shopifyKeyFeaturesFieldName ? (formValues[shopifyKeyFeaturesFieldName] ?? '') : '';
      const templateValue = shopifyBodyHtmlTemplateFieldName
        ? (originalFieldValues[shopifyBodyHtmlTemplateFieldName] ?? '')
        : shopifyBodyHtmlFieldName
          ? (originalFieldValues[shopifyBodyHtmlFieldName] ?? '')
          : '';

      return buildShopifyBodyHtml(descriptionValue, keyFeaturesValue, templateValue);
    }

    if (isEbayApprovalForm) {
      const titleValue = ebayTitleFieldName ? (formValues[ebayTitleFieldName] ?? '') : '';
      const descriptionValue = ebayBodyDescriptionFieldName ? (formValues[ebayBodyDescriptionFieldName] ?? '') : '';
      const keyFeaturesValue = ebayKeyFeaturesFieldName ? (formValues[ebayKeyFeaturesFieldName] ?? '') : '';
      const templateHtml = resolveEbayListingTemplateHtml(resolvedEbayTemplateId);

      return buildEbayBodyHtmlFromTemplate(
        templateHtml,
        titleValue,
        descriptionValue,
        keyFeaturesValue,
      );
    }

    return '';
  }, [
    ebayBodyDescriptionFieldName,
    ebayBodyHtmlFieldName,
    ebayBodyHtmlTemplateFieldName,
    ebayKeyFeaturesFieldName,
    ebayTitleFieldName,
    formValues,
    isEbayApprovalForm,
    isShopifyApprovalForm,
    originalFieldValues,
    shopifyBodyDescriptionFieldName,
    shopifyBodyHtmlFieldName,
    shopifyBodyHtmlTemplateFieldName,
    shopifyKeyFeaturesFieldName,
    resolvedEbayTemplateId,
  ]);

  useEffect(() => {
    if (!shopifyBodyHtmlFieldName) return;

    const nextBodyHtml = derivedBodyHtmlPreview;
    const currentBodyHtml = formValues[shopifyBodyHtmlFieldName] ?? '';

    if (currentBodyHtml !== nextBodyHtml) {
      setFormValue(shopifyBodyHtmlFieldName, nextBodyHtml);
    }
  }, [
    derivedBodyHtmlPreview,
    setFormValue,
    shopifyBodyHtmlFieldName,
    formValues,
  ]);

  useEffect(() => {
    if (!ebayBodyHtmlFieldName) return;

    const nextBodyHtml = derivedBodyHtmlPreview;
    const currentBodyHtml = formValues[ebayBodyHtmlFieldName] ?? '';

    if (currentBodyHtml !== nextBodyHtml) {
      setFormValue(ebayBodyHtmlFieldName, nextBodyHtml);
    }
  }, [derivedBodyHtmlPreview, ebayBodyHtmlFieldName, formValues, setFormValue]);

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

  function renderStandardField(fieldName: string): JSX.Element | null {
    if (isCombinedApproval && isHiddenCombinedFieldName(fieldName)) return null;
    if (isEbayHandlingCostField(fieldName)) return null;
    if (isEbayGlobalShippingField(fieldName)) return null;
    if (isShopifyTypesFreeformField(fieldName)) return null;
    if (approvalChannel === 'shopify' && isShopifyVariantStatusField(fieldName)) return null;
    if (approvalChannel === 'shopify' && (isShopifyTemplateVariantNameField(fieldName) || isShopifyOptionValuesField(fieldName) || isShopifyVariantOptionField(fieldName))) return null;
    // Allow shipping services in eBay-specific sections; hide in shared/Shopify sections
    if (isShippingServiceField(fieldName) && approvalChannel !== 'ebay') return null;
    if (fieldName === approvedFieldName) return null;
    if (isHiddenApprovalField(fieldName)) return null;
    if (hasShopifyTagEditor && (isShopifyCompoundTagsField(fieldName) || isShopifySingleTagField(fieldName))) return null;
    if (hasShopifyCollectionEditor && (isShopifyCompoundCollectionField(fieldName) || isShopifySingleCollectionField(fieldName))) return null;
    if (shopifyBodyDescriptionFieldName && fieldName === shopifyBodyDescriptionFieldName) return null;
    if (ebayBodyDescriptionFieldName && fieldName === ebayBodyDescriptionFieldName) return null;
    if (shopifyBodyHtmlFieldName && fieldName === shopifyBodyHtmlFieldName) return null;
    if (shopifyBodyHtmlTemplateFieldName && fieldName === shopifyBodyHtmlTemplateFieldName) return null;
    if (ebayBodyHtmlFieldName && fieldName === ebayBodyHtmlFieldName) return null;
    if (ebayBodyHtmlTemplateFieldName && fieldName === ebayBodyHtmlTemplateFieldName) return null;
    // Suppress all key features fields - they're handled by dedicated editors
    if (isShopifyKeyFeaturesField(fieldName) || isEbayKeyFeaturesField(fieldName)) return null;
    if (shopifyKeyFeaturesFieldName && fieldName === shopifyKeyFeaturesFieldName) return null;
    if (ebayKeyFeaturesFieldName && fieldName === ebayKeyFeaturesFieldName) return null;
    if (hasEbayCategoryEditor && (
      isEbayPrimaryCategoryField(fieldName)
      || isEbaySecondaryCategoryField(fieldName)
      || fieldName === ebayCategoriesFieldName
      || fieldName === effectiveEbayCategoriesFieldName
    )) return null;
    // Suppress image list fields from channel-specific sections (they belong in shared section)
    if (approvalChannel === 'shopify') {
      if (isImageUrlListField(fieldName)) return null;
    }
    if (approvalChannel === 'ebay') {
      if (isImageUrlListField(fieldName)) return null;
    }
    if (isEbayInventoryImageUrlsField(fieldName)) return null;
    if (isEbayPhotoCountMaxField(fieldName)) return null;
    // Exclude non-preferred Shopify price fields to avoid duplicates
    if (preferredShopifyPriceFieldName) {
      const normalized = fieldName.trim().toLowerCase();
      const isPriceCandidate = normalized === 'shopify rest variant 1 price'
        || normalized === 'shopify variant 1 price'
        || normalized === 'shopify_rest_variant_1_price'
        || normalized === 'shopify price'
        || normalized === 'price';
      if (isPriceCandidate && fieldName !== preferredShopifyPriceFieldName) {
        return null;
      }
    }
    if (approvalChannel === 'shopify' && imageUrlSourceField && fieldName === imageUrlSourceField) return null;
    if (isCombinedApproval && imageUrlSourceField && fieldName === imageUrlSourceField) return null;
    if (isGenericImageScalarField(fieldName)) return null;
    if (useCombinedImageAltEditor && fieldName === imageAltTextSourceField) return null;
    if (suppressImageScalarFields && isScalarImageField(fieldName)) return null;
    if (hasCanonicalConditionField && fieldName.trim().toLowerCase() !== 'condition' && isConditionMirrorSourceField(fieldName)) return null;
    // Exclude 'Shopify Type' variants except those handled by the special type editor
    const normalizedType = fieldName.trim().toLowerCase();
    if (normalizedType.includes('shopify') && normalizedType.includes('type') && normalizedType !== 'shopify types' && !isShopifyTypeField(fieldName)) return null;

    const value = formValues[fieldName] ?? '';
    const kind = fieldKinds[fieldName] ?? 'text';
    const readOnlyField = isReadOnlyApprovalField(fieldName);
    const inputDisabled = saving || readOnlyField;
    const isLongText = kind === 'json' || value.length > 120;
    const booleanLike = isBooleanLikeValue(value);
    const isListingFormatField = isEbayFormatField(fieldName);
    const isListingDurationField = isEbayListingDurationField(fieldName);
    const dropdownOptions = isListingFormatField
      ? listingFormatOptions
      : (isListingDurationField && listingDurationOptions)
        ? listingDurationOptions
        : getDropdownOptions(fieldName);

    if (isAllowOffersField(fieldName) || isShopifyVariantBooleanField(fieldName) || kind === 'boolean' || booleanLike) {
      const normalizedBooleanValue = value.trim().toLowerCase() === 'true' ? 'true' : 'false';
      return (
        <label key={fieldName} className="flex flex-col gap-2">
          {renderFieldLabel(fieldName)}
          <ApprovalSelect
            selectClassName={getSelectClassName(fieldName)}
            value={normalizedBooleanValue}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setFormValue(fieldName, event.target.value)}
            disabled={inputDisabled}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </ApprovalSelect>
        </label>
      );
    }

    if (dropdownOptions) {
      const optionSet = new Set(dropdownOptions);
      const options = value && !optionSet.has(value) && !optionSet.has(normalizeEbayListingDuration(value)) ? [value, ...dropdownOptions] : dropdownOptions;
      const isListingDurationField = isEbayListingDurationField(fieldName);
      const isShippingTypeField = isEbayShippingTypeField(fieldName);
      const normalizedValue = isListingDurationField ? normalizeEbayListingDuration(value) : value;
      const displayValue = isListingDurationField
        ? getEbayListingDurationLabel(normalizedValue)
        : isShippingTypeField
          ? getEbayShippingTypeLabel(normalizedValue)
          : normalizedValue;

      return (
        <label key={fieldName} className="flex flex-col gap-2">
          {renderFieldLabel(fieldName)}
          <ApprovalSelect
            selectClassName={getSelectClassName(fieldName)}
            value={displayValue}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const selectedLabel = event.target.value;
              const storeValue = isListingDurationField
                ? normalizeEbayListingDuration(selectedLabel)
                : isShippingTypeField
                  ? options.find((option) => getEbayShippingTypeLabel(option) === selectedLabel) ?? selectedLabel
                  : selectedLabel;
              setFormValue(fieldName, storeValue);
            }}
            disabled={inputDisabled}
          >
            <option value="">Select an option</option>
            {options.map((option: string) => (
              <option
                key={option}
                value={isListingDurationField ? getEbayListingDurationLabel(option) : isShippingTypeField ? getEbayShippingTypeLabel(option) : option}
              >
                {isListingDurationField ? getEbayListingDurationLabel(option) : isShippingTypeField ? getEbayShippingTypeLabel(option) : option}
              </option>
            ))}
          </ApprovalSelect>
        </label>
      );
    }

    if (isShopifyTypeField(fieldName)) {
      return (
        <ShopifyTaxonomyTypeSelect
          key={fieldName}
          fieldName={fieldName}
          label={toFieldLabel(fieldName)}
          required={isRequiredField(fieldName)}
          value={value}
          onChange={(nextValue) => setFormValue(fieldName, nextValue)}
          disabled={inputDisabled}
        />
      );
    }

    if (isImageUrlListField(fieldName)) {
      return (
        <ImageUrlListEditor
          key={fieldName}
          fieldLabel={isRequiredField(fieldName) ? `${toFieldLabel(fieldName)} (Required)` : toFieldLabel(fieldName)}
          value={value}
          onChange={(newValue) => setFormValue(fieldName, newValue)}
          disabled={inputDisabled}
        />
      );
    }

    if (isLongText) {
      return (
        <label key={fieldName} className="col-span-1 flex flex-col gap-2 md:col-span-2">
          {renderFieldLabel(fieldName)}
          <textarea
            className={getInputClassName(fieldName, 'min-h-[110px] resize-y font-mono leading-[1.4]')}
            value={value}
            onChange={(event) => setFormValue(fieldName, event.target.value)}
            disabled={inputDisabled}
          />
        </label>
      );
    }

    return (
      <label key={fieldName} className="flex flex-col gap-2">
        {renderFieldLabel(fieldName)}
        {isCurrencyLikeField(fieldName) ? (
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">$</span>
            <input
              className={getInputClassName(fieldName, 'pl-7')}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={value}
              onChange={(event) => setFormValue(fieldName, event.target.value)}
              disabled={inputDisabled}
            />
          </div>
        ) : (
          <input
            className={getInputClassName(fieldName)}
            type={kind === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(event) => setFormValue(fieldName, event.target.value)}
            disabled={inputDisabled}
          />
        )}
      </label>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {requiredOrderedFieldNames
        .filter((fieldName) => fieldName !== pinnedPreDescriptionFieldName)
        .map(renderStandardField)}

      {pinnedPreDescriptionFieldName && renderStandardField(pinnedPreDescriptionFieldName)}

      {imageUrlSourceField && (
        <ImageUrlListEditor
          key={imageUrlSourceField}
          fieldLabel="Images"
          value={useCombinedImageAltEditor ? combinedImageEditorValue : (formValues[imageUrlSourceField] ?? '')}
          onChange={(newValue) => {
            const parsedRows = parseImageEditorRows(newValue);
            const normalizedRows = parsedRows
              .map((row, index) => ({
                src: row.src.trim(),
                alt: row.alt.trim(),
                position: index + 1,
              }))
              .filter((row) => row.src.length > 0);

            if (!useCombinedImageAltEditor || !imageAltTextSourceField) {
              setFormValue(imageUrlSourceField, newValue);
              if (shopifyImagePayloadFieldName && shopifyImagePayloadFieldName !== imageUrlSourceField) {
                setFormValue(
                  shopifyImagePayloadFieldName,
                  normalizedRows.length > 0 ? JSON.stringify(normalizedRows) : '',
                );
              }
              return;
            }

            const urls = normalizedRows.map((row) => row.src);
            const alts = parsedRows.map((row) => row.alt.trim());

            setFormValue(imageUrlSourceField, toCommaSeparatedImageValues(urls));
            setFormValue(imageAltTextSourceField, toCommaSeparatedImageValues(alts));
            if (shopifyImagePayloadFieldName && shopifyImagePayloadFieldName !== imageUrlSourceField) {
              setFormValue(
                shopifyImagePayloadFieldName,
                normalizedRows.length > 0 ? JSON.stringify(normalizedRows) : '',
              );
            }
          }}
          disabled={saving || isReadOnlyApprovalField(imageUrlSourceField)}
        />
      )}

      {activeBodyDescriptionFieldName && (
        <label className="col-span-1 flex flex-col gap-2 md:col-span-2">
          {renderSpecialLabel('Description', activeBodyDescriptionFieldName)}
          <textarea
            className={`${inputBaseClass} min-h-[110px] resize-y leading-[1.4]`}
            value={formValues[activeBodyDescriptionFieldName] ?? ''}
            onChange={(event) => setFormValue(activeBodyDescriptionFieldName, event.target.value)}
            placeholder={isEbayApprovalForm
              ? 'Listing description saved to Airtable Description and mirrored into Body HTML'
              : 'Short product description used in listing body HTML'}
            disabled={saving}
          />
        </label>
      )}

      {shopifyKeyFeaturesFieldName && (
        <KeyFeaturesEditor
          keyFeaturesFieldName={shopifyKeyFeaturesFieldName}
          keyFeaturesValue={formValues[shopifyKeyFeaturesFieldName] ?? ''}
          setFormValue={setFormValue}
          disabled={saving}
        />
      )}

      {ebayKeyFeaturesFieldName && (
        <KeyFeaturesEditor
          keyFeaturesFieldName={ebayKeyFeaturesFieldName}
          keyFeaturesValue={formValues[ebayKeyFeaturesFieldName] ?? ''}
          setFormValue={setFormValue}
          disabled={saving}
          label="Key Features"
        />
      )}

      {hasShopifyTagEditor && (
        <ShopifyTagsEditor
          tags={shopifyTagValues}
          onChange={setShopifyTagValues}
          disabled={saving}
          maxTags={shopifyTagStrategy.writeSingleFields.length > 0 ? shopifyTagStrategy.writeSingleFields.length : undefined}
        />
      )}

      {hasShopifyCollectionEditor && (
        <ShopifyCollectionsSelect
          fieldName={shopifyCollectionStrategy.writeCompoundFields[0] ?? shopifyCollectionStrategy.writeSingleFields[0] ?? 'Collections'}
          label="Collections"
          value={effectiveShopifyCollectionIds}
          labelsById={collectionEditorLabelsById}
          onChange={setShopifyCollectionIds}
          disabled={saving}
        />
      )}

      {hasEbayCategoryEditor && (
        <EbayCategoriesSelect
          fieldName={effectiveEbayCategoriesFieldName}
          label="eBay Categories"
          marketplaceId={ebayMarketplaceId}
          value={ebaySelectedCategoryDisplayValues}
          onChange={setEbayCategoryIds}
          disabled={saving}
        />
      )}



      {optionalOrderedFieldNames
        .filter((fieldName) => fieldName !== pinnedPreDescriptionFieldName)
        .map(renderStandardField)}
    </div>
  );
}
