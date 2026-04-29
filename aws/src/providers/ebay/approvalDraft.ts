import { parseCategoryIds, parseCategoryIdsFromFields } from './approvalCategories.js';
import { collectImageUrlsFromFields, dedupeCaseInsensitive, parseImageUrls } from './approvalImages.js';
import { getField, getRawField, parseInteger, parseKeyFeatureEntries, type ApprovalFieldMap } from './approvalShared.js';

const EBAY_CONDITION_ENUMS = new Set([
  'NEW',
  'LIKE_NEW',
  'NEW_OTHER',
  'USED_EXCELLENT',
  'USED_VERY_GOOD',
  'USED_GOOD',
  'CERTIFIED_REFURBISHED',
  'SELLER_REFURBISHED',
  'FOR_PARTS_OR_NOT_WORKING',
]);

function parseEbayAspects(raw: unknown): Record<string, string[]> | undefined {
  const aspects = new Map<string, string[]>();
  const pushAspect = (name: string, value: string) => {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedValue = value.trim();
    if (!normalizedName || !normalizedValue) return;
    const existing = aspects.get(normalizedName) ?? [];
    if (!existing.some((entry) => entry.toLowerCase() === normalizedValue.toLowerCase())) {
      aspects.set(normalizedName, [...existing, normalizedValue]);
    }
  };
  const visit = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const record = entry as Record<string, unknown>;
        const name = typeof record.name === 'string' ? record.name : typeof record.feature === 'string' ? record.feature : typeof record.key === 'string' ? record.key : '';
        if (!name.trim()) return;
        const rawValues = record.values ?? record.value;
        if (Array.isArray(rawValues)) {
          rawValues.forEach((item) => {
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') pushAspect(name, String(item));
          });
          return;
        }
        if (typeof rawValues === 'string' || typeof rawValues === 'number' || typeof rawValues === 'boolean') pushAspect(name, String(rawValues));
      });
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([name, rawValue]) => {
        if (Array.isArray(rawValue)) {
          rawValue.forEach((entry) => {
            if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') pushAspect(name, String(entry));
          });
          return;
        }
        if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') pushAspect(name, String(rawValue));
      });
      return;
    }
    const text = typeof value === 'string' ? value.trim() : String(value).trim();
    if (!text) return;
    try {
      visit(JSON.parse(text));
      return;
    } catch {
      parseKeyFeatureEntries(text).forEach((entry) => pushAspect(entry.feature, entry.value));
    }
  };
  visit(raw);
  return aspects.size === 0 ? undefined : Object.fromEntries(aspects.entries());
}

function normalizeEbayCondition(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'USED_EXCELLENT';
  const upper = trimmed.toUpperCase();
  if (EBAY_CONDITION_ENUMS.has(upper)) return upper;
  const lower = trimmed.toLowerCase();
  if (lower === 'new') return 'NEW';
  if (lower === 'open box') return 'NEW_OTHER';
  if (lower === 'for parts or not working') return 'FOR_PARTS_OR_NOT_WORKING';
  if (lower === 'used') return 'USED_EXCELLENT';
  return 'USED_EXCELLENT';
}

function buildEbayProductAspects(rawExplicitAspects: unknown, brand: string, rawKeyFeatures: string): Record<string, string[]> | undefined {
  const explicitAspects = parseEbayAspects(rawExplicitAspects);
  if (explicitAspects) {
    if (!brand.trim()) return explicitAspects;
    const existingBrandValues = explicitAspects.Brand ?? [];
    if (existingBrandValues.some((value) => value.toLowerCase() === brand.trim().toLowerCase())) return explicitAspects;
    return { ...explicitAspects, Brand: [...existingBrandValues, brand.trim()].filter(Boolean) };
  }
  const aspects = new Map<string, string[]>();
  const pushAspect = (name: string, value: string) => {
    const normalizedName = name.trim();
    const normalizedValue = value.trim();
    if (!normalizedName || !normalizedValue) return;
    const existing = aspects.get(normalizedName) ?? [];
    if (!existing.some((entry) => entry.toLowerCase() === normalizedValue.toLowerCase())) {
      aspects.set(normalizedName, [...existing, normalizedValue]);
    }
  };
  if (brand.trim()) pushAspect('Brand', brand);
  parseKeyFeatureEntries(rawKeyFeatures).forEach((entry) => pushAspect(entry.feature, entry.value));
  return aspects.size === 0 ? undefined : Object.fromEntries(aspects.entries());
}

export interface EbayDraftPayloadBundle {
  inventoryItem: Record<string, unknown>;
  offer: Record<string, unknown>;
}

export function buildEbayDraftPayloadBundleFromApprovalFields(fields: ApprovalFieldMap): EbayDraftPayloadBundle {
  const sku = getField(fields, ['eBay Inventory SKU', 'SKU']) || 'SAMPLE-SKU';
  const title = getField(fields, ['eBay Inventory Product Title', 'Item Title', 'Title']) || 'Untitled Listing';
  const description = getField(fields, ['Body HTML', 'Body (HTML)', 'body_html', 'eBay Body HTML', 'ebay_body_html', 'eBay Inventory Product Description', 'Item Description', 'Description']);
  const brand = getField(fields, ['eBay Inventory Product Brand', 'Brand']);
  const mpn = getField(fields, ['eBay Inventory Product MPN', 'MPN']);
  const explicitAspects = getRawField(fields, ['eBay Inventory Product Aspects JSON', 'eBay Inventory Product Aspects', 'eBay Inventory Aspects', 'eBay Product Aspects', 'eBay Aspects', 'ebay_inventory_product_aspects_json', 'ebay_inventory_product_aspects', 'ebay_inventory_aspects']);
  const rawKeyFeatures = getField(fields, ['Key Features (Key, Value)', 'eBay Body Key Features JSON', 'eBay Body Key Features', 'eBay Listing Key Features JSON', 'eBay Listing Key Features', 'Key Features JSON', 'Key Features', 'Features JSON', 'Features', 'ebay_body_key_features_json', 'ebay_body_key_features', 'ebay_listing_key_features_json', 'ebay_listing_key_features']);
  const condition = normalizeEbayCondition(getField(fields, ['__Condition__', 'Item Condition', 'Condition', 'eBay Inventory Condition']));
  const conditionDescription = getField(fields, ['eBay Inventory Condition Description']);
  const quantity = parseInteger(getField(fields, ['eBay Inventory Ship To Location Quantity', 'Quantity', 'Qty']), 1);
  const imageUrls = parseImageUrls(getRawField(fields, ['eBay Inventory Product Image URLs JSON', 'eBay Inventory Product ImageURLs JSON', 'eBay Inventory Product Image URLs', 'eBay Inventory Product Image URL', 'eBay Inventory Product Image URL 1', 'eBay Inventory Product Image URL 2', 'eBay Inventory Product Image URL 3', 'ebay_inventory_product_imageurls_json', 'ebay_inventory_product_imageurls', 'ebay_inventory_product_imageurl', 'ebay_inventory_product_imageurl_1', 'ebay_inventory_product_imageurl_2', 'ebay_inventory_product_imageurl_3', 'Photo URLs (comma-separated)', 'Photo URLs', 'Images (comma-separated)', 'photo_urls', 'Shopify REST Images JSON', 'shopify_rest_images_json', 'Shopify Images JSON', 'shopify_images_json', 'Images', 'images', 'Image URL', 'Image URLs', 'image_url', 'image_urls']));
  const fallbackImageUrls = collectImageUrlsFromFields(fields);
  const resolvedImageUrls = dedupeCaseInsensitive([...imageUrls, ...fallbackImageUrls]);
  const marketplaceId = getField(fields, ['eBay Offer Marketplace ID']) || 'EBAY_US';
  const format = getField(fields, ['eBay Offer Format']) || 'FIXED_PRICE';
  const categoryIdsFromCategoriesField = parseCategoryIds(getRawField(fields, ['Categories', 'categories']));
  const fallbackCategoryIds = categoryIdsFromCategoriesField.length === 0 ? dedupeCaseInsensitive(parseCategoryIdsFromFields(fields)) : [];
  const primaryCategoryFromField = getField(fields, ['eBay Offer Primary Category ID', 'eBay Offer PrimaryCategoryID', 'Primary Category ID', 'Primary Category', 'Primary Category Airtable', 'primary_category', 'primary_category_airtable', 'eBay Offer Category ID', 'ebay_offer_category_id', 'ebay_offer_primary_category_id', 'ebay_offer_primarycategoryid', 'primary_category_id', 'category_id']);
  const secondaryCategoryFromField = getField(fields, ['eBay Offer SecondaryCategoryID', 'Secondary Category ID', 'Secondary Category', 'Secondary Category Airtable', 'secondary_category', 'secondary_category_airtable', 'eBay Offer Secondary Category ID', 'ebay_offer_secondary_category_id', 'ebay_offer_secondarycategoryid', 'secondary_category_id']);
  const categoryId = categoryIdsFromCategoriesField[0] || primaryCategoryFromField || fallbackCategoryIds[0] || '3276';
  const secondaryCategoryId = categoryIdsFromCategoriesField[1] || secondaryCategoryFromField || fallbackCategoryIds[1];
  const listingDuration = getField(fields, ['eBay Offer Listing Duration', 'eBay Listing Duration', 'Listing Duration', 'Duration', 'ebay_offer_listingDuration', 'ebay_offer_listing_duration']) || 'GTC';
  const priceValue = getField(fields, ['eBay Offer Price Value', 'eBay Offer Auction Start Price Value', 'Buy It Now/Starting Bid', 'Buy It Now USD', 'Starting Bid USD', 'Price']) || '0.00';
  const currency = getField(fields, ['eBay Offer Price Currency', 'eBay Offer Auction Start Price Currency']) || 'USD';
  const isAuction = format.trim().toUpperCase() === 'AUCTION';
  const quantityLimitPerBuyer = parseInteger(getField(fields, ['eBay Offer Quantity Limit Per Buyer']), 1);
  return {
    inventoryItem: {
      sku,
      product: {
        title,
        description,
        imageUrls: resolvedImageUrls,
        brand: brand || undefined,
        mpn: mpn || undefined,
        aspects: buildEbayProductAspects(explicitAspects, brand, rawKeyFeatures),
      },
      condition,
      conditionDescription: conditionDescription || undefined,
      availability: {
        shipToLocationAvailability: {
          quantity,
        },
      },
    },
    offer: {
      sku,
      marketplaceId,
      format,
      availableQuantity: quantity,
      categoryId,
      secondaryCategoryId: secondaryCategoryId || undefined,
      listingDescription: description || undefined,
      listingDuration,
      pricingSummary: isAuction ? { auctionStartPrice: { value: priceValue, currency } } : { price: { value: priceValue, currency } },
      quantityLimitPerBuyer,
      includeCatalogProductDetails: false,
    },
  };
}