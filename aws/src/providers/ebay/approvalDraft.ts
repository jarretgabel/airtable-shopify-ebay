import { parseCategoryIds, parseCategoryIdsFromFields } from './approvalCategories.js';
import { collectImageUrlsFromFields, dedupeCaseInsensitive, parseImageUrls } from './approvalImages.js';
import { getField, getRawField, parseInteger, parseKeyFeatureEntries, type ApprovalFieldMap } from './approvalShared.js';
import { getIncludedWorkflowImages, parseWorkflowImageMetadata } from '../../shared/workflowImages.js';

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

function inferModelFromTitle(title: string, brand: string): string {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return '';
  const withoutBrand = brand.trim()
    ? trimmedTitle.replace(new RegExp(`^${brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '')
    : trimmedTitle;
  const lead = withoutBrand.split(/\s[-|:/]\s|\s-\s|\||\//)[0]?.trim() ?? withoutBrand;
  const token = lead.split(/\s+/).find((part) => /[a-z0-9]/i.test(part) && /\d/.test(part)) ?? '';
  return token.replace(/^[^a-z0-9]+|[^a-z0-9.-]+$/gi, '').trim();
}

function extractFirstScalarString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = extractFirstScalarString(entry);
      if (candidate) return candidate;
    }
  }
  return '';
}

function normalizeTypeValue(type: string): string {
  const trimmed = type.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('>')) return trimmed;
  return trimmed.split('>').map((part) => part.trim()).filter(Boolean).at(-1) ?? trimmed;
}

function ensureHtmlDescription(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped.replace(/\r?\n/g, '<br />')}</p>`;
}

function extractHtmlBodyFragment(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const bodyMatch = trimmed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1]?.trim() || trimmed;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function toInventoryDescription(listingHtml: string, fallbackTitle: string): string {
  const fragment = extractHtmlBodyFragment(listingHtml);
  const text = decodeHtmlEntities(
    fragment
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  const resolved = text || fallbackTitle.trim() || 'Listing description';
  return resolved.length > 4000 ? resolved.slice(0, 4000) : resolved;
}

function normalizeConnectivityValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (/\b(bluetooth|wi\s*-?\s*fi|wifi|wireless|airplay|chromecast)\b/.test(lower)) return 'Wireless';
  if (/\b(wired|rca|xlr|aux|ethernet|coax|optical|phono|banana)\b/.test(lower)) return 'Wired';
  return trimmed;
}

function inferConnectivityValue(explicitConnectivity: string, title: string, type: string, rawKeyFeatures: string): string {
  const explicit = normalizeConnectivityValue(explicitConnectivity);
  if (explicit) return explicit;

  const context = `${title} ${type} ${rawKeyFeatures}`.toLowerCase();
  if (/\b(bluetooth|wi\s*-?\s*fi|wifi|wireless|airplay|chromecast)\b/.test(context)) return 'Wireless';
  if (/\b(receiver|amplifier|preamp|pre-amp|power amp|integrated|turntable|phono|cd player|cassette|dac|stereo)\b/.test(context)) return 'Wired';
  return '';
}

function buildEbayProductAspects(rawExplicitAspects: unknown, brand: string, model: string, mpn: string, type: string, connectivity: string, rawKeyFeatures: string): Record<string, string[]> | undefined {
  const explicitAspects = parseEbayAspects(rawExplicitAspects);
  if (explicitAspects) {
    const merged = { ...explicitAspects };

    if (brand.trim()) {
      const brandKey = Object.keys(merged).find((name) => name.toLowerCase() === 'brand') ?? 'Brand';
      const existingBrandValues = merged[brandKey] ?? [];
      if (!existingBrandValues.some((value) => value.toLowerCase() === brand.trim().toLowerCase())) {
        merged[brandKey] = [...existingBrandValues, brand.trim()].filter(Boolean);
      }
    }

    if (model.trim()) {
      const modelKey = Object.keys(merged).find((name) => name.toLowerCase() === 'model') ?? 'Model';
      const existingModelValues = merged[modelKey] ?? [];
      if (!existingModelValues.some((value) => value.toLowerCase() === model.trim().toLowerCase())) {
        merged[modelKey] = [...existingModelValues, model.trim()].filter(Boolean);
      }
    }

    if (mpn.trim()) {
      const mpnKey = Object.keys(merged).find((name) => name.toLowerCase() === 'mpn') ?? 'MPN';
      const existingMpnValues = merged[mpnKey] ?? [];
      if (!existingMpnValues.some((value) => value.toLowerCase() === mpn.trim().toLowerCase())) {
        merged[mpnKey] = [...existingMpnValues, mpn.trim()].filter(Boolean);
      }
    }

    if (type.trim()) {
      const typeKey = Object.keys(merged).find((name) => name.toLowerCase() === 'type') ?? 'Type';
      const existingTypeValues = merged[typeKey] ?? [];
      if (!existingTypeValues.some((value) => value.toLowerCase() === type.trim().toLowerCase())) {
        merged[typeKey] = [...existingTypeValues, type.trim()].filter(Boolean);
      }
    }

    if (connectivity.trim()) {
      const connectivityKey = Object.keys(merged).find((name) => name.toLowerCase() === 'connectivity') ?? 'Connectivity';
      const existingConnectivityValues = merged[connectivityKey] ?? [];
      if (!existingConnectivityValues.some((value) => value.toLowerCase() === connectivity.trim().toLowerCase())) {
        merged[connectivityKey] = [...existingConnectivityValues, connectivity.trim()].filter(Boolean);
      }
    }

    return merged;
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
  if (model.trim()) pushAspect('Model', model);
  if (mpn.trim()) pushAspect('MPN', mpn);
  if (type.trim()) pushAspect('Type', type);
  if (connectivity.trim()) pushAspect('Connectivity', connectivity);
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
  const listingRawDescription = getField(fields, ['Ebay Body (HTML)', 'Ebay Body HTML', 'eBay Body HTML', 'ebay_body_html', 'eBay Body (HTML)', 'Body HTML', 'Body (HTML)', 'body_html', 'eBay Inventory Product Description', 'Item Description', 'Description']);
  const listingDescription = ensureHtmlDescription(listingRawDescription);
  const inventoryRawDescription = getField(fields, ['Description', 'Item Description', 'eBay Inventory Product Description']);
  const inventoryDescription = toInventoryDescription(inventoryRawDescription || listingDescription, title);
  const brand = getField(fields, ['eBay Inventory Product Brand', 'Brand', 'Make']);
  const mpn = getField(fields, ['eBay Inventory Product MPN', 'MPN', 'Manufacturer Part Number', 'Part Number']);
  const model = getField(fields, ['eBay Inventory Product Model', 'Model', 'Item Model']);
  const typeFromEbayOrCoreFields = extractFirstScalarString(getRawField(fields, [
    'eBay Inventory Product Type',
    'eBay Product Type',
    'Type',
    'Component Type',
    'Product Type',
  ]));
  const typeFromShopifyFallback = getField(fields, [
    'Shopify Type',
    'Shopify Product Type',
    'Shopify REST Product Type',
    'Shopify GraphQL Product Type',
  ]);
  const type = normalizeTypeValue(typeFromEbayOrCoreFields || typeFromShopifyFallback);
  const resolvedModel = model || mpn || inferModelFromTitle(title, brand);
  const resolvedMpn = mpn || resolvedModel;
  const explicitAspects = getRawField(fields, ['eBay Inventory Product Aspects JSON', 'eBay Inventory Product Aspects', 'eBay Inventory Aspects', 'eBay Product Aspects', 'eBay Aspects', 'ebay_inventory_product_aspects_json', 'ebay_inventory_product_aspects', 'ebay_inventory_aspects']);
  const rawKeyFeatures = getField(fields, ['Key Features (Key, Value)', 'eBay Body Key Features JSON', 'eBay Body Key Features', 'eBay Listing Key Features JSON', 'eBay Listing Key Features', 'Key Features JSON', 'Key Features', 'Features JSON', 'Features', 'ebay_body_key_features_json', 'ebay_body_key_features', 'ebay_listing_key_features_json', 'ebay_listing_key_features']);
  const connectivityFromFields = extractFirstScalarString(getRawField(fields, [
    'eBay Inventory Product Connectivity',
    'eBay Product Connectivity',
    'Connectivity',
    'Connection Type',
    'Audio Connectivity',
    'Network Connectivity',
    'Wireless',
    'Bluetooth',
    'Wi-Fi',
    'WiFi',
    'Wifi',
  ]));
  const connectivity = inferConnectivityValue(connectivityFromFields, title, type, rawKeyFeatures);
  const condition = normalizeEbayCondition(getField(fields, ['__Condition__', 'Item Condition', 'Condition', 'eBay Inventory Condition']));
  const conditionDescription = getField(fields, ['eBay Inventory Condition Description']);
  const quantity = parseInteger(getField(fields, ['eBay Inventory Ship To Location Quantity', 'Quantity', 'Qty']), 1);
  const workflowImageUrls = getIncludedWorkflowImages(parseWorkflowImageMetadata(getRawField(fields, [
    'Workflow Image Metadata JSON',
    'Workflow Image Metadata',
    'workflow_image_metadata_json',
    'workflow_image_metadata',
  ]))).map((record) => record.url);
  const imageUrls = parseImageUrls(getRawField(fields, ['eBay Inventory Product Image URLs JSON', 'eBay Inventory Product ImageURLs JSON', 'eBay Inventory Product Image URLs', 'eBay Inventory Product Image URL', 'eBay Inventory Product Image URL 1', 'eBay Inventory Product Image URL 2', 'eBay Inventory Product Image URL 3', 'ebay_inventory_product_imageurls_json', 'ebay_inventory_product_imageurls', 'ebay_inventory_product_imageurl', 'ebay_inventory_product_imageurl_1', 'ebay_inventory_product_imageurl_2', 'ebay_inventory_product_imageurl_3', 'Photo URLs (comma-separated)', 'Photo URLs', 'Images (comma-separated)', 'photo_urls', 'Shopify REST Images JSON', 'shopify_rest_images_json', 'Shopify Images JSON', 'shopify_images_json', 'Images', 'images', 'Image URL', 'Image URLs', 'image_url', 'image_urls']));
  const fallbackImageUrls = collectImageUrlsFromFields(fields);
  const resolvedImageUrls = workflowImageUrls.length > 0
    ? dedupeCaseInsensitive(workflowImageUrls)
    : dedupeCaseInsensitive([...imageUrls, ...fallbackImageUrls]);
  const marketplaceId = getField(fields, ['eBay Offer Marketplace ID']) || 'EBAY_US';
  const format = getField(fields, ['eBay Offer Format']) || 'FIXED_PRICE';
  const categoryIdsFromCategoriesField = parseCategoryIds(getRawField(fields, ['Categories', 'categories']));
  const fallbackCategoryIds = categoryIdsFromCategoriesField.length === 0 ? dedupeCaseInsensitive(parseCategoryIdsFromFields(fields)) : [];
  const primaryCategoryFromField = parseCategoryIds(getRawField(fields, ['eBay Offer Primary Category ID', 'eBay Offer PrimaryCategoryID', 'Primary Category ID', 'Primary Category', 'Primary Category Airtable', 'primary_category', 'primary_category_airtable', 'eBay Offer Category ID', 'ebay_offer_category_id', 'ebay_offer_primary_category_id', 'ebay_offer_primarycategoryid', 'primary_category_id', 'category_id']))[0];
  const secondaryCategoryFromField = parseCategoryIds(getRawField(fields, ['eBay Offer SecondaryCategoryID', 'Secondary Category ID', 'Secondary Category', 'Secondary Category Airtable', 'secondary_category', 'secondary_category_airtable', 'eBay Offer Secondary Category ID', 'ebay_offer_secondary_category_id', 'ebay_offer_secondarycategoryid', 'secondary_category_id']))[0];
  const categoryId = categoryIdsFromCategoriesField[0] || primaryCategoryFromField || fallbackCategoryIds[0] || '14990';
  const secondaryCategoryId = categoryIdsFromCategoriesField[1] || secondaryCategoryFromField || fallbackCategoryIds[1];
  const listingDuration = getField(fields, ['eBay Offer Listing Duration', 'eBay Listing Duration', 'Listing Duration', 'Duration', 'ebay_offer_listingDuration', 'ebay_offer_listing_duration']) || 'GTC';
  const priceValue = getField(fields, ['eBay Offer Price Value', 'eBay Offer Auction Start Price Value', 'Buy It Now/Starting Bid', 'Buy It Now USD', 'Starting Bid USD', 'eBay Price', 'Ebay Price', 'Price']) || '0.00';
  const currency = getField(fields, ['eBay Offer Price Currency', 'eBay Offer Auction Start Price Currency']) || 'USD';
  const isAuction = format.trim().toUpperCase() === 'AUCTION';
  const quantityLimitPerBuyer = parseInteger(getField(fields, ['eBay Offer Quantity Limit Per Buyer']), 1);
  return {
    inventoryItem: {
      sku,
      product: {
        title,
        description: inventoryDescription,
        imageUrls: resolvedImageUrls,
        ...(brand ? { brand } : {}),
        ...(type ? { type } : {}),
        ...(resolvedMpn ? { mpn: resolvedMpn } : {}),
        aspects: buildEbayProductAspects(explicitAspects, brand, resolvedModel, resolvedMpn, type, connectivity, rawKeyFeatures),
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
      listingDescription: listingDescription || undefined,
      listingDuration,
      pricingSummary: isAuction ? { auctionStartPrice: { value: priceValue, currency } } : { price: { value: priceValue, currency } },
      quantityLimitPerBuyer,
      includeCatalogProductDetails: false,
    },
  };
}