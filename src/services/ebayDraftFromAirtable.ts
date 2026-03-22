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
  for (const candidate of candidates) {
    const direct = fields[candidate];
    if (direct !== null && direct !== undefined) return direct;
  }

  const normalizedMap = new Map<string, unknown>();
  Object.entries(fields).forEach(([key, value]) => {
    normalizedMap.set(normalizeKey(key), value);
  });

  for (const candidate of candidates) {
    const value = normalizedMap.get(normalizeKey(candidate));
    if (value !== null && value !== undefined) return value;
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
          const src = (item as Record<string, unknown>).src;
          return typeof src === 'string' ? src.trim() : '';
        }
        return '';
      })
      .filter(Boolean);
  }

  const text = coerceToString(raw);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parseImageUrls(parsed);
    }
  } catch {
    // fall through
  }

  return text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
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
  const description = getField(fields, ['eBay Inventory Product Description', 'Item Description', 'Description']);
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
    'eBay Inventory Product ImageURLs JSON',
    'ebay_inventory_product_imageurls_json',
    'Image URL',
    'Image URLs',
    'image_url',
    'image_urls',
  ]));

  const marketplaceId = getField(fields, ['eBay Offer Marketplace ID']) || 'EBAY_US';
  const format = getField(fields, ['eBay Offer Format']) || 'FIXED_PRICE';
  const categoryId = getField(fields, ['eBay Offer Category ID']) || '3276';
  const listingDuration = getField(fields, ['eBay Offer Listing Duration']) || 'GTC';
  const priceValue = getField(fields, ['eBay Offer Price Value', 'Price']) || '0.00';
  const currency = getField(fields, ['eBay Offer Price Currency']) || 'USD';
  const quantityLimitPerBuyer = parseInteger(getField(fields, ['eBay Offer Quantity Limit Per Buyer']), 1);

  const inventoryItem: Record<string, unknown> = {
    sku,
    product: {
      title,
      description,
      imageUrls,
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
    listingDescription: description || undefined,
    listingDuration,
    pricingSummary: {
      price: {
        value: priceValue,
        currency,
      },
    },
    quantityLimitPerBuyer,
    includeCatalogProductDetails: false,
  };

  return {
    inventoryItem,
    offer,
  };
}
