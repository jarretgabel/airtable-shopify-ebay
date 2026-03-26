type ApprovalFieldMap = Record<string, unknown>;

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

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function getField(fields: ApprovalFieldMap, candidates: string[]): string {
  for (const candidate of candidates) {
    const direct = coerceToString(fields[candidate]);
    if (direct.length > 0) return direct;
  }

  const normalizedMap = new Map<string, unknown>();
  Object.entries(fields).forEach(([key, value]) => {
    normalizedMap.set(normalizeKey(key), value);
  });

  for (const candidate of candidates) {
    const value = coerceToString(normalizedMap.get(normalizeKey(candidate)));
    if (value.length > 0) return value;
  }

  return '';
}

function getRawField(fields: ApprovalFieldMap, candidates: string[]): unknown {
  const hasUsableValue = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return true;
  };

  for (const candidate of candidates) {
    const direct = fields[candidate];
    if (hasUsableValue(direct)) return direct;
  }

  const normalizedMap = new Map<string, unknown>();
  Object.entries(fields).forEach(([key, value]) => {
    normalizedMap.set(normalizeKey(key), value);
  });

  for (const candidate of candidates) {
    const value = normalizedMap.get(normalizeKey(candidate));
    if (hasUsableValue(value)) return value;
  }

  return undefined;
}

function parseInteger(raw: string, fallback: number): number {
  const parsed = parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseImageUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const imageLike = item as Record<string, unknown>;
          const src = imageLike.src;
          if (typeof src === 'string' && src.trim()) return src.trim();

          const directUrl = imageLike.url;
          if (typeof directUrl === 'string' && directUrl.trim()) return directUrl.trim();

          const thumbnails = imageLike.thumbnails;
          if (thumbnails && typeof thumbnails === 'object') {
            const thumbnailsObj = thumbnails as Record<string, unknown>;
            const largeThumb = thumbnailsObj.large;
            if (largeThumb && typeof largeThumb === 'object') {
              const largeUrl = (largeThumb as Record<string, unknown>).url;
              if (typeof largeUrl === 'string' && largeUrl.trim()) return largeUrl.trim();
            }
            const fullThumb = thumbnailsObj.full;
            if (fullThumb && typeof fullThumb === 'object') {
              const fullUrl = (fullThumb as Record<string, unknown>).url;
              if (typeof fullUrl === 'string' && fullUrl.trim()) return fullUrl.trim();
            }
          }
        }
        return '';
      })
      .filter(Boolean);
  }

  if (raw && typeof raw === 'object') {
    const rawObject = raw as Record<string, unknown>;
    const nestedImages = rawObject.attachments ?? rawObject.images ?? rawObject.items ?? rawObject.data;
    if (Array.isArray(nestedImages)) {
      const parsedNested = parseImageUrls(nestedImages);
      if (parsedNested.length > 0) return parsedNested;
    }

    const parsedObject = parseImageUrls([raw]);
    if (parsedObject.length > 0) return parsedObject;
  }

  const text = coerceToString(raw);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parseImageUrls(parsed);
    }
    if (parsed && typeof parsed === 'object') {
      return parseImageUrls([parsed]);
    }
  } catch {
    // fall through
  }

  return text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectImageUrlsFromFields(fields: ApprovalFieldMap): string[] {
  const collected: string[] = [];

  Object.entries(fields).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    const looksLikeExplicitImageList =
      normalized.includes('ebayinventoryproductimageurls')
      || normalized.includes('photourls')
      || normalized.includes('imageurls')
      || normalized === 'images'
      || normalized === 'image'
      || normalized === 'imagescommaseparated';
    const looksLikeIndexedImageUrl =
      (normalized.includes('ebayinventoryproductimageurl') || normalized.includes('imageurl') || normalized.includes('photourl'))
      && /\d+$/.test(normalized);

    if (!looksLikeExplicitImageList && !looksLikeIndexedImageUrl) return;

    collected.push(...parseImageUrls(value));
  });

  return dedupeCaseInsensitive(collected);
}

function parseCategoryIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    return raw
      .map((item) => String(item ?? '').trim())
      .filter((value) => {
        if (!value) return false;
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  const text = coerceToString(raw);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parseCategoryIds(parsed);
    }
  } catch {
    // fall through
  }

  const seen = new Set<string>();
  return text
    .split(/[\n,;|]/)
    .map((item) => item.trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isGenericCategoryFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (!normalized.includes('categor')) return false;
  if (normalized.includes('shopify') || normalized.includes('google') || normalized.includes('taxonomy') || normalized.includes('product type')) {
    return false;
  }

  return normalized === 'categories'
    || normalized === 'category'
    || normalized === 'categories airtable'
    || normalized === 'category airtable'
    || normalized === 'category ids'
    || normalized === 'category id'
    || normalized === 'category_ids'
    || normalized === 'category_id'
    || normalized === 'primary category'
    || normalized === 'secondary category'
    || normalized === 'primary category airtable'
    || normalized === 'secondary category airtable'
    || normalized === 'primary category id'
    || normalized === 'secondary category id'
    || normalized === 'primary_category'
    || normalized === 'secondary_category'
    || normalized === 'primary_category_id'
    || normalized === 'secondary_category_id'
    || normalized.includes('ebay')
    || normalized.includes('airtable')
    || normalized.includes('linked');
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

export interface EbayDraftPayloadBundle {
  inventoryItem: Record<string, unknown>;
  offer: Record<string, unknown>;
}

export function buildEbayDraftPayloadBundleFromApprovalFields(fields: ApprovalFieldMap): EbayDraftPayloadBundle {
  const sku = getField(fields, ['eBay Inventory SKU', 'SKU']) || 'SAMPLE-SKU';
  const title = getField(fields, ['eBay Inventory Product Title', 'Item Title', 'Title']) || 'Untitled Listing';
  const description = getField(fields, [
    'Body HTML',
    'Body (HTML)',
    'body_html',
    'eBay Body HTML',
    'ebay_body_html',
    'eBay Inventory Product Description',
    'Item Description',
    'Description',
  ]);
  const brand = getField(fields, ['eBay Inventory Product Brand', 'Brand']);
  const mpn = getField(fields, ['eBay Inventory Product MPN', 'MPN']);
  const condition = normalizeEbayCondition(getField(fields, [
    '__Condition__',
    'Item Condition',
    'Condition',
    'eBay Inventory Condition',
  ]));
  const conditionDescription = getField(fields, ['eBay Inventory Condition Description']);
  const quantity = parseInteger(getField(fields, ['eBay Inventory Ship To Location Quantity', 'Quantity', 'Qty']), 1);
  const imageUrls = parseImageUrls(getRawField(fields, [
    'eBay Inventory Product Image URLs JSON',
    'eBay Inventory Product ImageURLs JSON',
    'eBay Inventory Product Image URLs',
    'eBay Inventory Product Image URL',
    'eBay Inventory Product Image URL 1',
    'eBay Inventory Product Image URL 2',
    'eBay Inventory Product Image URL 3',
    'ebay_inventory_product_imageurls_json',
    'ebay_inventory_product_imageurls',
    'ebay_inventory_product_imageurl',
    'ebay_inventory_product_imageurl_1',
    'ebay_inventory_product_imageurl_2',
    'ebay_inventory_product_imageurl_3',
    'Photo URLs (comma-separated)',
    'Photo URLs',
      'Images (comma-separated)',
    'photo_urls',
    'Shopify REST Images JSON',
    'shopify_rest_images_json',
    'Shopify Images JSON',
    'shopify_images_json',
    'Images',
    'images',
    'Image URL',
    'Image URLs',
    'image_url',
    'image_urls',
  ]));
  const fallbackImageUrls = collectImageUrlsFromFields(fields);
  const resolvedImageUrls = dedupeCaseInsensitive([
    ...imageUrls,
    ...fallbackImageUrls,
  ]);

  const marketplaceId = getField(fields, ['eBay Offer Marketplace ID']) || 'EBAY_US';
  const format = getField(fields, ['eBay Offer Format']) || 'FIXED_PRICE';
  const categoryIdsFromCategoriesField = parseCategoryIds(getRawField(fields, [
    'Categories',
    'categories',
  ]));
  const fallbackCategoryIds = categoryIdsFromCategoriesField.length === 0
    ? dedupeCaseInsensitive(
      Object.entries(fields)
        .filter(([fieldName]) => isGenericCategoryFieldName(fieldName))
        .flatMap(([, value]) => parseCategoryIds(value)),
    )
    : [];
  const primaryCategoryFromField = getField(fields, [
    'eBay Offer Primary Category ID',
    'eBay Offer PrimaryCategoryID',
    'Primary Category ID',
    'Primary Category',
    'Primary Category Airtable',
    'primary_category',
    'primary_category_airtable',
    'eBay Offer Category ID',
    'ebay_offer_category_id',
    'ebay_offer_primary_category_id',
    'ebay_offer_primarycategoryid',
    'primary_category_id',
    'category_id',
  ]);
  const secondaryCategoryFromField = getField(fields, [
    'eBay Offer SecondaryCategoryID',
    'Secondary Category ID',
    'Secondary Category',
    'Secondary Category Airtable',
    'secondary_category',
    'secondary_category_airtable',
    'eBay Offer Secondary Category ID',
    'ebay_offer_secondary_category_id',
    'ebay_offer_secondarycategoryid',
    'secondary_category_id',
  ]);

  const categoryId = categoryIdsFromCategoriesField[0] || primaryCategoryFromField || fallbackCategoryIds[0] || '3276';
  const secondaryCategoryId = categoryIdsFromCategoriesField[1] || secondaryCategoryFromField || fallbackCategoryIds[1];
  const listingDuration = getField(fields, ['eBay Offer Listing Duration']) || 'GTC';
  const priceValue = getField(fields, [
    'eBay Offer Price Value',
    'eBay Offer Auction Start Price Value',
    'Buy It Now/Starting Bid',
    'Buy It Now USD',
    'Starting Bid USD',
    'Price',
  ]) || '0.00';
  const currency = getField(fields, ['eBay Offer Price Currency', 'eBay Offer Auction Start Price Currency']) || 'USD';
  const isAuction = format.trim().toUpperCase() === 'AUCTION';
  const quantityLimitPerBuyer = parseInteger(getField(fields, ['eBay Offer Quantity Limit Per Buyer']), 1);

  const inventoryItem: Record<string, unknown> = {
    sku,
    product: {
      title,
      description,
      imageUrls: resolvedImageUrls,
      brand: brand || undefined,
      mpn: mpn || undefined,
      aspects: brand ? { Brand: [brand] } : undefined,
    },
    condition,
    conditionDescription: conditionDescription || undefined,
    availability: {
      shipToLocationAvailability: {
        quantity,
      },
    },
  };

  const offer: Record<string, unknown> = {
    sku,
    marketplaceId,
    format,
    availableQuantity: quantity,
    categoryId,
    secondaryCategoryId: secondaryCategoryId || undefined,
    listingDescription: description || undefined,
    listingDuration,
    pricingSummary: isAuction
      ? { auctionStartPrice: { value: priceValue, currency } }
      : { price: { value: priceValue, currency } },
    quantityLimitPerBuyer,
    includeCatalogProductDetails: false,
  };

  return {
    inventoryItem,
    offer,
  };
}
