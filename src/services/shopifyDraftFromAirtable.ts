import type { ShopifyMetafield, ShopifyProduct, ShopifyProductOption, ShopifyProductVariant } from '@/types/shopify';
import { buildShopifyBodyHtml, formatKeyFeatureHtml } from '@/services/shopifyBodyHtml';
import { parseShopifyTagList, serializeShopifyTagsCsv, SHOPIFY_DEFAULT_VENDOR } from '@/services/shopifyTags';
import { trimShopifyProductType } from '@/services/shopifyTaxonomy';

type ApprovalFieldMap = Record<string, unknown>;

const CONDITION_LABELS = ['Used', 'New', 'Open Box', 'For Parts or not working'] as const;

const SHOPIFY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES = [
  'Shopify REST Body HTML Template',
  'Shopify Body HTML Template',
  'shopify_rest_body_html_template',
  'shopify_body_html_template',
] as const;

const SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES = [
  'Type',
  'Product Type',
  'Shopify REST Product Type',
  'Shopify Product Type',
  'Shopify GraphQL Product Type',
  'Shopify REST Category',
  'Shopify Category',
  'Shopify Product Category',
  'Shopify REST Product Category',
  'Google Product Category',
  'Product Category',
  'Category',
  'shopify_rest_product_type',
  'shopify_product_type',
  'shopify_product_category',
  'shopify_rest_product_category',
  'google_product_category',
  'product_category',
] as const;

interface ShopifyBodyDynamicTokenSpec {
  token: string;
  candidates: string[];
  formatter?: (value: string) => string;
}

function formatBulletList(value: string): string {
  const hasHtmlListTag = /<\/?(ul|ol|li)\b/i.test(value);
  if (hasHtmlListTag) return value;

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';
  return `<ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>`;
}

const SHOPIFY_BODY_DYNAMIC_TOKEN_SPECS: ShopifyBodyDynamicTokenSpec[] = [
  {
    token: 'title',
    candidates: ['Shopify REST Title', 'Shopify Title', 'Item Title', 'Title', 'Name'],
  },
  {
    token: 'vendor',
    candidates: ['Shopify REST Vendor', 'Shopify Vendor', 'Vendor', 'Brand', 'Manufacturer'],
  },
  {
    token: 'product_type',
    candidates: [...SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES],
  },
  {
    token: 'condition',
    candidates: ['__Condition__', 'Item Condition', 'Condition', 'Shopify Condition', 'Shopify REST Condition'],
  },
  {
    token: 'price',
    candidates: ['Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'Price'],
  },
  {
    token: 'sku',
    candidates: ['Shopify REST Variant 1 SKU', 'SKU', 'shopify_rest_variant_1_sku'],
  },
  {
    token: 'body_description',
    candidates: ['Shopify Body Description', 'Shopify REST Body Description', 'Item Description', 'Description', 'shopify_body_description', 'shopify_rest_body_description'],
  },
  {
    token: 'body_key_features',
    candidates: [
      'Shopify Body Key Features JSON',
      'Shopify REST Body Key Features JSON',
      'Shopify Body Key Features',
      'Shopify REST Body Key Features',
      'Key Features JSON',
      'Key Features',
      'Features JSON',
      'Features',
      'shopify_body_key_features_json',
      'shopify_rest_body_key_features_json',
      'shopify_body_key_features',
      'shopify_rest_body_key_features',
    ],
    formatter: formatKeyFeatureHtml,
  },
  {
    token: 'body_intro',
    candidates: ['Shopify Body Intro', 'Shopify REST Body Intro', 'shopify_body_intro', 'shopify_rest_body_intro'],
  },
  {
    token: 'body_highlights',
    candidates: ['Shopify Body Highlights', 'Shopify REST Body Highlights', 'shopify_body_highlights', 'shopify_rest_body_highlights'],
    formatter: formatBulletList,
  },
  {
    token: 'body_whats_included',
    candidates: [
      "Shopify Body What's Included",
      "Shopify REST Body What's Included",
      'shopify_body_whats_included',
      'shopify_rest_body_whats_included',
    ],
  },
  {
    token: 'body_condition_notes',
    candidates: ['Shopify Body Condition Notes', 'Shopify REST Body Condition Notes', 'shopify_body_condition_notes', 'shopify_rest_body_condition_notes'],
  },
  {
    token: 'body_shipping_notes',
    candidates: ['Shopify Body Shipping Notes', 'Shopify REST Body Shipping Notes', 'shopify_body_shipping_notes', 'shopify_rest_body_shipping_notes'],
  },
];

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function coerceStructuredToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
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

function hasAnyField(fields: ApprovalFieldMap, candidates: readonly string[]): boolean {
  const normalizedCandidates = new Set(candidates.map((candidate) => normalizeKey(candidate)));
  return Object.keys(fields).some((key) => normalizedCandidates.has(normalizeKey(key)));
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

function getFieldPreservingStructuredValues(fields: ApprovalFieldMap, candidates: string[]): string {
  const raw = getRawField(fields, candidates);
  return coerceStructuredToString(raw);
}

function getHandleField(fields: ApprovalFieldMap): string {
  const explicit = getField(fields, [
    'Shopify REST Handle',
    'Shopify Handle',
    'Shopify GraphQL Handle',
    'shopify_rest_handle',
    'shopify_handle',
    'Handle',
    'handle',
  ]);
  if (explicit.length > 0) return explicit;

  const fuzzy = Object.entries(fields).find(([key, value]) => {
    if (!normalizeKey(key).includes('handle')) return false;
    return coerceToString(value).length > 0;
  });

  return fuzzy ? coerceToString(fuzzy[1]) : '';
}

function getBodyHtmlField(fields: ApprovalFieldMap): string {
  const explicit = getField(fields, [
    'Shopify REST Body HTML',
    'Shopify Body HTML',
    'Shopify GraphQL Description HTML',
    'Body (HTML)',
    'Body HTML',
    'body_html',
    'shopify_rest_body_html',
    'Item Description',
    'Description',
  ]);
  if (explicit.length > 0) return explicit;

  const fuzzy = Object.entries(fields).find(([key, value]) => {
    const normalized = normalizeKey(key);
    if (!(normalized.includes('bodyhtml') || normalized.includes('descriptionhtml'))) return false;
    return coerceToString(value).length > 0;
  });

  return fuzzy ? coerceToString(fuzzy[1]) : '';
}

function resolveShopifyBodyHtml(fields: ApprovalFieldMap): string {
  const explicitTemplate = getField(fields, [...SHOPIFY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES]);
  const fallbackBodyHtml = getBodyHtmlField(fields);
  const template = explicitTemplate || '<p>{{body_description}}</p>{{body_key_features}}';
  if (!template) return '';
  const bodyDescriptionCandidates = SHOPIFY_BODY_DYNAMIC_TOKEN_SPECS.find((spec) => spec.token === 'body_description')?.candidates ?? [];
  const bodyKeyFeaturesCandidates = SHOPIFY_BODY_DYNAMIC_TOKEN_SPECS.find((spec) => spec.token === 'body_key_features')?.candidates ?? [];
  const rawKeyFeatures = getFieldPreservingStructuredValues(fields, [
    'Shopify Body Key Features JSON',
    'Shopify REST Body Key Features JSON',
    'Shopify Body Key Features',
    'Shopify REST Body Key Features',
    'Key Features JSON',
    'Key Features',
    'Features JSON',
    'Features',
    'shopify_body_key_features_json',
    'shopify_rest_body_key_features_json',
    'shopify_body_key_features',
    'shopify_rest_body_key_features',
  ]);

  const tokenValues = new Map<string, string>();
  SHOPIFY_BODY_DYNAMIC_TOKEN_SPECS.forEach((spec) => {
    const rawValue = spec.token === 'vendor'
      ? SHOPIFY_DEFAULT_VENDOR
      : spec.token === 'body_key_features'
      ? getFieldPreservingStructuredValues(fields, spec.candidates)
      : getField(fields, spec.candidates);
    tokenValues.set(spec.token, spec.formatter ? spec.formatter(rawValue) : rawValue);
  });

  const bodyDescription = tokenValues.get('body_description') ?? '';
  const bodyKeyFeatures = tokenValues.get('body_key_features') ?? '';
  const hasEditableBodyFields = hasAnyField(fields, bodyDescriptionCandidates) || hasAnyField(fields, bodyKeyFeaturesCandidates);

  if (!explicitTemplate && (bodyDescription || bodyKeyFeatures)) {
    return buildShopifyBodyHtml(bodyDescription, rawKeyFeatures, fallbackBodyHtml);
  }

  if (!explicitTemplate) {
    if (!hasEditableBodyFields) {
      return fallbackBodyHtml;
    }
    return buildShopifyBodyHtml(bodyDescription, rawKeyFeatures, fallbackBodyHtml);
  }

  if (bodyDescription || bodyKeyFeatures) {
    return buildShopifyBodyHtml(bodyDescription, rawKeyFeatures, explicitTemplate);
  }

  const resolved = template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, tokenName: string) => {
    const normalizedTokenName = tokenName.toLowerCase();
    return tokenValues.get(normalizedTokenName) ?? '';
  });

  return resolved;
}

function parseJsonArray<T>(raw: unknown): T[] | undefined {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? (parsed as T[]) : undefined;
  } catch {
    return undefined;
  }
}

function parseImageAltTextList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const value = (item as Record<string, unknown>).alt;
          return typeof value === 'string' ? value.trim() : '';
        }
        return '';
      })
      .filter((value) => value.length > 0);
  }

  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const parsed = parseJsonArray<unknown>(trimmed);
  if (parsed) return parseImageAltTextList(parsed);

  return trimmed.split(/[\n,]/).map((value) => value.trim()).filter((value) => value.length > 0);
}

function getStructuredImageSource(image: Record<string, unknown>): string {
  const directSource = typeof image.src === 'string' ? image.src.trim() : '';
  if (directSource) return directSource;

  const directUrl = typeof image.url === 'string' ? image.url.trim() : '';
  if (directUrl) return directUrl;

  const originalSource = typeof image.originalSource === 'string'
    ? image.originalSource.trim()
    : typeof image.original_source === 'string'
      ? image.original_source.trim()
      : '';
  if (originalSource) return originalSource;

  const thumbnailLarge = image.thumbnails
    && typeof image.thumbnails === 'object'
    && (image.thumbnails as Record<string, unknown>).large
    && typeof (image.thumbnails as Record<string, unknown>).large === 'object'
      ? ((image.thumbnails as Record<string, unknown>).large as Record<string, unknown>).url
      : '';

  return typeof thumbnailLarge === 'string' ? thumbnailLarge.trim() : '';
}

function hasAnyFieldValue(fields: ApprovalFieldMap, candidates: string[]): boolean {
  return candidates.some((candidate) => {
    const raw = getRawField(fields, [candidate]);
    if (Array.isArray(raw)) return raw.length > 0;
    return coerceToString(raw).length > 0;
  });
}

function hasFlatOptionFields(fields: ApprovalFieldMap): boolean {
  const candidates: string[] = [];
  for (let i = 1; i <= 3; i += 1) {
    candidates.push(
      `Shopify REST Option ${i} Name`,
      `Shopify Option ${i} Name`,
      `Shopify GraphQL Option ${i} Name`,
      `shopify_rest_option_${i}_name`,
    );
    for (let j = 1; j <= 5; j += 1) {
      candidates.push(
        `Shopify REST Option ${i} Value ${j}`,
        `Shopify Option ${i} Value ${j}`,
        `Shopify GraphQL Option ${i} Value ${j}`,
        `shopify_rest_option_${i}_value_${j}`,
      );
    }
  }
  return hasAnyFieldValue(fields, candidates);
}

function hasFlatVariantFields(fields: ApprovalFieldMap): boolean {
  return hasAnyFieldValue(fields, [
    'Shopify REST Variant 1 Price',
    'shopify_rest_variant_1_price',
    'Shopify REST Variant 1 Compare At Price',
    'shopify_rest_variant_1_compare_at_price',
    'Variant-Compare-Price',
    'Variant Compare Price',
    'variant_compare_price',
    'Shopify REST Variant 1 SKU',
    'shopify_rest_variant_1_sku',
    'Shopify REST Variant 1 Option 1',
    'shopify_rest_variant_1_option_1',
  ]);
}

function parseBoolean(raw: string, fallback: boolean): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return fallback;
  if (['true', '1', 'yes', 'y'].includes(value)) return true;
  if (['false', '0', 'no', 'n'].includes(value)) return false;
  return fallback;
}

function parseNumber(raw: string): number | undefined {
  const cleaned = raw.trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(raw: string): number | undefined {
  const parsed = parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toMoneyString(raw: unknown, fallback = '0.00'): string {
  const value = coerceToString(raw);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed.toFixed(2);
}

function normalizeWeightUnit(raw: unknown): 'g' | 'kg' | 'oz' | 'lb' | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (!value) return undefined;
  if (value === 'g' || value === 'gram' || value === 'grams') return 'g';
  if (value === 'kg' || value === 'kilogram' || value === 'kilograms') return 'kg';
  if (value === 'oz' || value === 'ounce' || value === 'ounces') return 'oz';
  if (value === 'lb' || value === 'lbs' || value === 'pound' || value === 'pounds') return 'lb';
  return undefined;
}

function normalizeInventoryPolicy(raw: unknown): 'deny' | 'continue' | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (value === 'deny' || value === 'continue') return value;
  return undefined;
}

function normalizeInventoryManagement(raw: unknown): 'shopify' | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (value === 'shopify') return 'shopify';
  return undefined;
}

function normalizeFulfillmentService(raw: unknown): string | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (!value) return undefined;
  if (value === 'manual') return 'manual';
  return value;
}

function normalizePublishedScope(raw: unknown): 'web' | 'global' | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (value === 'web' || value === 'global') return value;
  return undefined;
}

function normalizeStatus(raw: unknown): ShopifyProduct['status'] {
  const value = coerceToString(raw).toLowerCase();
  if (value === 'active' || value === 'draft' || value === 'archived') return value;
  return undefined;
}

function normalizeConditionLabel(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (lower === 'used') return 'Used';
  if (lower === 'new') return 'New';
  if (lower === 'open box') return 'Open Box';
  if (lower === 'for parts or not working') return 'For Parts or not working';

  const upper = trimmed.toUpperCase();
  if (upper === 'NEW') return 'New';
  if (upper === 'LIKE_NEW' || upper === 'NEW_OTHER' || upper === 'NEW_OPEN_BOX') return 'Open Box';
  if (upper === 'FOR_PARTS_OR_NOT_WORKING') return 'For Parts or not working';
  if (upper.startsWith('USED') || upper === 'CERTIFIED_REFURBISHED' || upper === 'SELLER_REFURBISHED') return 'Used';

  return undefined;
}

function getConditionFromFields(fields: ApprovalFieldMap): string | undefined {
  const raw = getField(fields, [
    '__Condition__',
    'Item Condition',
    'Condition',
    'Shopify Condition',
    'Shopify REST Condition',
    'eBay Inventory Condition',
  ]);
  return normalizeConditionLabel(raw);
}

function setVariantConditionValue(variant: ShopifyProductVariant, optionPosition: number, condition: string): ShopifyProductVariant {
  if (optionPosition === 1) return { ...variant, option1: condition };
  if (optionPosition === 2) return { ...variant, option2: condition };
  if (optionPosition === 3) return { ...variant, option3: condition };
  return variant;
}

function applyConditionToShopifyOptionsAndVariants(
  options: ShopifyProductOption[] | undefined,
  variants: ShopifyProductVariant[],
  condition: string | undefined,
): { options: ShopifyProductOption[] | undefined; variants: ShopifyProductVariant[] } {
  if (!condition) return { options, variants };

  const nextOptions = (options ?? []).map((option, index) => ({
    ...option,
    position: option.position ?? index + 1,
    values: [...option.values],
  }));

  let conditionIndex = nextOptions.findIndex((option) => option.name.trim().toLowerCase() === 'condition');

  if (conditionIndex === -1) {
    if (nextOptions.length < 3) {
      nextOptions.push({
        name: 'Condition',
        position: nextOptions.length + 1,
        values: [condition],
      });
      conditionIndex = nextOptions.length - 1;
    } else {
      conditionIndex = 0;
      nextOptions[0] = {
        name: 'Condition',
        position: 1,
        values: [condition],
      };
    }
  } else {
    const existingValues = nextOptions[conditionIndex].values.filter((value) => CONDITION_LABELS.includes(value as (typeof CONDITION_LABELS)[number]));
    nextOptions[conditionIndex].values = Array.from(new Set([condition, ...existingValues]));
  }

  const conditionPosition = nextOptions[conditionIndex].position ?? conditionIndex + 1;
  const nextVariants = variants.map((variant) => setVariantConditionValue(variant, conditionPosition, condition));

  return {
    options: nextOptions,
    variants: nextVariants,
  };
}

function isAllowedMetafieldType(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return /^[a-z_]+(?:\.[a-z_]+)*$/i.test(value);
}

function normalizeMetafieldToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
}

function isValidMetafieldNamespace(raw: string): boolean {
  return raw.length >= 2 && raw.length <= 255;
}

function isValidMetafieldKey(raw: string): boolean {
  return raw.length >= 2 && raw.length <= 64;
}

function buildMetafields(fields: ApprovalFieldMap): ShopifyMetafield[] | undefined {
  const metafields: ShopifyMetafield[] = [];

  for (let i = 1; i <= 30; i += 1) {
    const namespace = getField(fields, [
      `Shopify REST Metafield ${i} Namespace`,
      `Shopify Metafield ${i} Namespace`,
      `Shopify Extra Metafield ${i} Namespace`,
      `Shopify GraphQL Metafield ${i} Namespace`,
    ]);
    const key = getField(fields, [
      `Shopify REST Metafield ${i} Key`,
      `Shopify Metafield ${i} Key`,
      `Shopify Extra Metafield ${i} Key`,
      `Shopify GraphQL Metafield ${i} Key`,
    ]);
    const type = getField(fields, [
      `Shopify REST Metafield ${i} Type`,
      `Shopify Metafield ${i} Type`,
      `Shopify Extra Metafield ${i} Type`,
      `Shopify GraphQL Metafield ${i} Type`,
    ]);
    const value = getField(fields, [
      `Shopify REST Metafield ${i} Value`,
      `Shopify Metafield ${i} Value`,
      `Shopify Extra Metafield ${i} Value`,
      `Shopify GraphQL Metafield ${i} Value`,
    ]);

    if (!namespace || !key || !type || !value) continue;
    const normalizedNamespace = normalizeMetafieldToken(namespace);
    const normalizedKey = normalizeMetafieldToken(key);
    const normalizedType = type.trim().toLowerCase();

    if (!isValidMetafieldNamespace(normalizedNamespace)) continue;
    if (!isValidMetafieldKey(normalizedKey)) continue;
    if (!isAllowedMetafieldType(normalizedType)) continue;

    metafields.push({ namespace: normalizedNamespace, key: normalizedKey, type: normalizedType, value: value.trim() });
  }

  const seoTitle = getField(fields, ['Shopify Extra SEO Title', 'Shopify GraphQL SEO Title']);
  const seoDescription = getField(fields, ['Shopify Extra SEO Description', 'Shopify GraphQL SEO Description']);

  if (seoTitle) {
    metafields.push({
      namespace: 'global',
      key: 'title_tag',
      type: 'single_line_text_field',
      value: seoTitle,
    });
  }

  if (seoDescription) {
    metafields.push({
      namespace: 'global',
      key: 'description_tag',
      type: 'single_line_text_field',
      value: seoDescription,
    });
  }

  if (metafields.length === 0) return undefined;

  const deduped = new Map<string, ShopifyMetafield>();
  metafields.forEach((metafield) => {
    deduped.set(`${metafield.namespace}:${metafield.key}`, metafield);
  });

  return Array.from(deduped.values());
}

function buildOptions(fields: ApprovalFieldMap): ShopifyProductOption[] {
  if (!hasFlatOptionFields(fields)) {
    const optionsJson = parseJsonArray<ShopifyProductOption>(
      getRawField(fields, ['Shopify REST Options JSON', 'shopify_rest_options_json']),
    );
    if (optionsJson && optionsJson.length > 0) {
      return optionsJson.filter((option) => option && typeof option.name === 'string' && Array.isArray(option.values));
    }
  }

  const options: ShopifyProductOption[] = [];

  for (let i = 1; i <= 3; i += 1) {
    const name = getField(fields, [
      `Shopify REST Option ${i} Name`,
      `Shopify Option ${i} Name`,
      `Shopify GraphQL Option ${i} Name`,
      `shopify_rest_option_${i}_name`,
      `shopify_option_${i}_name`,
    ]);

    if (!name) continue;

    const values: string[] = [];
    for (let j = 1; j <= 5; j += 1) {
      const value = getField(fields, [
        `Shopify REST Option ${i} Value ${j}`,
        `Shopify Option ${i} Value ${j}`,
        `Shopify GraphQL Option ${i} Value ${j}`,
        `shopify_rest_option_${i}_value_${j}`,
        `shopify_option_${i}_value_${j}`,
      ]);
      if (value) values.push(value);
    }

    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 0) continue;

    options.push({
      name,
      position: i,
      values: uniqueValues,
    });
  }

  return options;
}

function buildVariant(fields: ApprovalFieldMap, options: ShopifyProductOption[]): ShopifyProductVariant {
  const option1 = getField(fields, ['Shopify REST Variant 1 Option 1', 'shopify_rest_variant_1_option_1']) || options[0]?.values[0] || null;
  const option2 = getField(fields, ['Shopify REST Variant 1 Option 2', 'shopify_rest_variant_1_option_2']) || options[1]?.values[0] || null;
  const option3 = getField(fields, ['Shopify REST Variant 1 Option 3', 'shopify_rest_variant_1_option_3']) || options[2]?.values[0] || null;
  const compareAtPrice = getField(fields, [
    'Shopify REST Variant 1 Compare At Price',
    'Shopify Variant 1 Compare At Price',
    'shopify_rest_variant_1_compare_at_price',
  ]);
  const variantComparePrice = getField(fields, [
    'Variant-Compare-Price',
    'Variant Compare Price',
    'variant_compare_price',
  ]);
  const basePrice = getField(fields, [
    'Shopify REST Variant 1 Price',
    'Shopify Variant 1 Price',
    'Price',
    'shopify_rest_variant_1_price',
  ]);
  const listingPrice = variantComparePrice || compareAtPrice || basePrice;
  const numericListingPrice = Number(listingPrice);
  const numericBasePrice = Number(basePrice);
  const shouldIncludeCompareAt = Number.isFinite(numericListingPrice)
    && Number.isFinite(numericBasePrice)
    && numericBasePrice > numericListingPrice;
  const inventoryQuantity = parseInteger(getField(fields, ['Shopify REST Variant 1 Inventory Quantity', 'Shopify Variant 1 Inventory Quantity', 'Quantity', 'Qty', 'shopify_rest_variant_1_inventory_quantity']));
  const inventoryManagement = getField(fields, ['Shopify REST Variant 1 Inventory Management', 'shopify_rest_variant_1_inventory_management']) || undefined;

  return {
    price: listingPrice || '0.00',
    compare_at_price: shouldIncludeCompareAt ? basePrice : undefined,
    sku: getField(fields, ['Shopify REST Variant 1 SKU', 'SKU', 'shopify_rest_variant_1_sku']) || undefined,
    barcode: getField(fields, ['Shopify REST Variant 1 Barcode', 'shopify_rest_variant_1_barcode']) || undefined,
    inventory_quantity: inventoryQuantity,
    inventory_management: inventoryManagement ?? (typeof inventoryQuantity === 'number' ? 'shopify' : undefined),
    inventory_policy: getField(fields, ['Shopify REST Variant 1 Inventory Policy', 'shopify_rest_variant_1_inventory_policy']) || undefined,
    fulfillment_service: getField(fields, ['Shopify REST Variant 1 Fulfillment Service', 'shopify_rest_variant_1_fulfillment_service']) || undefined,
    taxable: parseBoolean(getField(fields, ['Shopify REST Variant 1 Taxable', 'shopify_rest_variant_1_taxable']), true),
    requires_shipping: parseBoolean(getField(fields, ['Shopify REST Variant 1 Requires Shipping', 'shopify_rest_variant_1_requires_shipping']), true),
    weight: parseNumber(getField(fields, ['Shopify REST Variant 1 Weight', 'shopify_rest_variant_1_weight'])),
    weight_unit: getField(fields, ['Shopify REST Variant 1 Weight Unit', 'shopify_rest_variant_1_weight_unit']) || undefined,
    option1,
    option2,
    option3,
  };
}

function buildVariants(fields: ApprovalFieldMap, options: ShopifyProductOption[]): ShopifyProductVariant[] {
  if (!hasFlatVariantFields(fields)) {
    const variantsJson = parseJsonArray<ShopifyProductVariant>(
      getRawField(fields, ['Shopify REST Variants JSON', 'Shopify Variants JSON', 'shopify_rest_variants_json']),
    );
    if (variantsJson && variantsJson.length > 0) {
      return variantsJson;
    }
  }

  return [buildVariant(fields, options)];
}

function buildImages(fields: ApprovalFieldMap): ShopifyProduct['images'] | undefined {
  const imageAltTexts = parseImageAltTextList(getRawField(fields, [
    'Images Alt Text',
    'Images Alt Text (comma separated)',
    'Images Alt Text (comma-separated)',
    'Image Alt Text',
    'images_alt_text',
    'image_alt_text',
  ]));

  const rawImages = getRawField(fields, [
    'Shopify REST Images JSON',
    'Shopify Images JSON',
    'shopify_rest_images_json',
    'shopify_images_json',
    'Shopify REST Images',
    'Shopify Images',
    'shopify_rest_images',
    'shopify_images',
    'Images',
    'Images (comma separated)',
    'Images (comma-separated)',
    'images',
    'Image URL',
    'Image URLs',
    'Image-URL',
    'Image-URLs',
    'image_url',
    'image_urls',
  ]);
  const imagesJson = parseJsonArray<unknown>(rawImages);
  if (imagesJson && imagesJson.length > 0) {
    // Accept arrays of strings and/or objects. Keep an `alt` key for each image.
    const normalizedImages = imagesJson
      .map((item, index) => {
        if (typeof item === 'string') {
          const src = item.trim();
          if (!src) return null;
          return {
            src,
            alt: imageAltTexts[index] ?? '',
            position: index + 1,
          };
        }

        if (!item || typeof item !== 'object') return null;
        const image = item as Record<string, unknown>;
        const src = getStructuredImageSource(image);
        if (!src) return null;

        const rawAlt = image.alt;
        const altFromImage = typeof rawAlt === 'string'
          ? rawAlt
          : typeof image.altText === 'string'
            ? image.altText
            : typeof image.alt_text === 'string'
              ? image.alt_text
              : '';
        const alt = imageAltTexts[index] ?? altFromImage;
        const rawPosition = image.position;
        const position = typeof rawPosition === 'number' && Number.isFinite(rawPosition)
          ? rawPosition
          : index + 1;

        return { src, alt, position };
      })
      .filter((image): image is { src: string; alt: string; position: number } => image !== null);

    if (normalizedImages.length > 0) return normalizedImages;
  }

  // Fallback: plain comma/newline-separated URL string — same parsing as ImageUrlListEditor.
  // This ensures the payload matches the editor for non-JSON Airtable image field values.
  if (typeof rawImages === 'string' && rawImages.trim()) {
    const parts = rawImages.trim().split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts.map((url, i) => ({ src: url, alt: imageAltTexts[i] ?? '', position: i + 1 }));
    }
  }
  // (falls through to per-field scan below)

  const images: NonNullable<ShopifyProduct['images']> = [];
  for (let i = 1; i <= 10; i += 1) {
    const src = getField(fields, [
      `Shopify REST Image ${i} Src`,
      `Shopify Image ${i} Src`,
      `Shopify GraphQL Media ${i} Original Source`,
      `Shopify Extra Media ${i} Original Source`,
      `shopify_rest_image_${i}_src`,
    ]);
    if (!src) continue;

    images.push({
      src,
      alt: getField(fields, [
        `Shopify REST Image ${i} Alt`,
        `Shopify Image ${i} Alt`,
        `Shopify GraphQL Media ${i} Alt`,
        `Shopify Extra Media ${i} Alt`,
        `shopify_rest_image_${i}_alt`,
      ]) || imageAltTexts[i - 1] || undefined,
      position: parseInteger(getField(fields, [`Shopify REST Image ${i} Position`, `shopify_rest_image_${i}_position`])),
    });
  }

  return images.length > 0 ? images : undefined;
}

function buildTags(fields: ApprovalFieldMap): string | undefined {
  const tagsFromSingles: string[] = [];

  for (let i = 1; i <= 10; i += 1) {
    const tag = getField(fields, [
      `Shopify REST Tag ${i}`,
      `Shopify Tag ${i}`,
      `Shopify GraphQL Tag ${i}`,
      `Shopify Extra Tag ${i}`,
      `shopify_rest_tag_${i}`,
    ]);
    if (tag) tagsFromSingles.push(...parseShopifyTagList(tag));
  }

  const compound = getRawField(fields, [
    'Shopify REST Tags',
    'Shopify Tags',
    'Shopify GraphQL Tags',
    'Shopify GraphQL Tags JSON',
    'Tags',
    'shopify_rest_tags',
    'shopify_tags',
    'shopify_graphql_tags',
    'shopify_graphql_tags_json',
    'tags',
  ]);
  const tagsFromCompound = parseShopifyTagList(compound);

  const serialized = serializeShopifyTagsCsv([...tagsFromSingles, ...tagsFromCompound]);
  return serialized.length > 0 ? serialized : undefined;
}

function normalizeCollectionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const embeddedGidMatch = trimmed.match(/gid:\/\/shopify\/Collection\/\d+/i);
  if (embeddedGidMatch) return embeddedGidMatch[0];
  if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Collection/${trimmed}`;
  return '';
}

export function buildShopifyCollectionIdsFromApprovalFields(fields: ApprovalFieldMap): string[] {
  const collectionIds: string[] = [];

  const pushCollectionCandidate = (entry: unknown) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      collectionIds.push(String(entry));
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
      collectionIds.push(String(candidate));
    }
  };

  const collectionIdCandidates = [
    'Collection',
    'Collections',
    'Shopify Collection',
    'Shopify Collection ID',
    'Shopify Collections',
    'Shopify Collection IDs',
    'Shopify GraphQL Collection ID',
    'Shopify GraphQL Collection IDs',
    'Shopify GraphQL Collections JSON',
    'shopify_collection',
    'shopify_collection_id',
    'shopify_collections',
    'shopify_collection_ids',
    'shopify_graphql_collection_id',
    'shopify_graphql_collection_ids',
    'shopify_graphql_collections_json',
  ];

  const normalizedLookup = new Map<string, unknown>();
  Object.entries(fields).forEach(([key, value]) => {
    normalizedLookup.set(normalizeKey(key), value);
  });

  collectionIdCandidates.forEach((candidateFieldName) => {
    const rawValue = fields[candidateFieldName] ?? normalizedLookup.get(normalizeKey(candidateFieldName));
    if (rawValue === null || rawValue === undefined) return;

    const parsedCompoundCollections = parseJsonArray<unknown>(rawValue);
    if (parsedCompoundCollections && parsedCompoundCollections.length > 0) {
      parsedCompoundCollections.forEach((entry) => {
        pushCollectionCandidate(entry);
      });
      return;
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach((entry) => {
        pushCollectionCandidate(entry);
      });
      return;
    }

    if (rawValue && typeof rawValue === 'object') {
      pushCollectionCandidate(rawValue);
      return;
    }

    const parsedDelimitedCollections = coerceStructuredToString(rawValue)
      .split(/[\n,;|]/)
      .map((token) => token.trim())
      .filter(Boolean);
    collectionIds.push(...parsedDelimitedCollections);
  });

  for (let i = 1; i <= 25; i += 1) {
    const collectionId = getField(fields, [
      `Shopify GraphQL Collection ${i} ID`,
      `Shopify Collection ${i} ID`,
      `Collection ${i} ID`,
      `collection_${i}_id`,
      `shopify_graphql_collection_${i}_id`,
      `shopify_collection_${i}_id`,
    ]);
    if (collectionId) collectionIds.push(collectionId);
  }

  const seen = new Set<string>();
  const normalized = collectionIds
    .map(normalizeCollectionId)
    .filter((collectionId) => {
      if (!collectionId) return false;
      const key = collectionId.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return normalized;
}

function sanitizeOptions(options: ShopifyProductOption[] | undefined): ShopifyProductOption[] | undefined {
  if (!options || options.length === 0) return undefined;

  const sanitized = options
    .map((option, index) => ({
      name: coerceToString(option?.name),
      position: index + 1,
      values: Array.from(new Set((option?.values ?? []).map((value) => coerceToString(value)).filter(Boolean))),
    }))
    .filter((option) => option.name.length > 0 && option.values.length > 0);

  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeVariants(variants: ShopifyProductVariant[] | undefined): ShopifyProductVariant[] {
  const source = variants && variants.length > 0 ? variants : [{ price: '0.00' }];

  return source.map((variant) => {
    const price = toMoneyString(variant.price);
    const compareAt = coerceToString(variant.compare_at_price ?? '') || undefined;
    const sku = coerceToString(variant.sku ?? '') || undefined;
    const barcode = coerceToString(variant.barcode ?? '') || undefined;
    const inventoryQuantity = typeof variant.inventory_quantity === 'number'
      ? variant.inventory_quantity
      : parseInteger(coerceToString(variant.inventory_quantity ?? ''));
    const inventoryManagement = normalizeInventoryManagement(variant.inventory_management);
    const inventoryPolicy = normalizeInventoryPolicy(variant.inventory_policy);
    const fulfillmentService = normalizeFulfillmentService(variant.fulfillment_service);
    const weight = typeof variant.weight === 'number' ? variant.weight : parseNumber(coerceToString(variant.weight ?? ''));
    const weightUnit = normalizeWeightUnit(variant.weight_unit);

    return {
      price,
      compare_at_price: (() => {
        if (!compareAt) return undefined;
        const normalizedCompareAt = toMoneyString(compareAt, compareAt);
        const priceNum = Number(price);
        const compareNum = Number(normalizedCompareAt);
        if (!Number.isFinite(priceNum) || !Number.isFinite(compareNum)) return undefined;
        return compareNum > priceNum ? normalizedCompareAt : undefined;
      })(),
      sku,
      barcode,
      inventory_quantity: inventoryQuantity,
      inventory_management: inventoryManagement,
      inventory_policy: inventoryPolicy,
      fulfillment_service: fulfillmentService,
      taxable: typeof variant.taxable === 'boolean' ? variant.taxable : undefined,
      requires_shipping: typeof variant.requires_shipping === 'boolean' ? variant.requires_shipping : undefined,
      weight,
      weight_unit: weightUnit,
      option1: coerceToString(variant.option1 ?? '') || undefined,
      option2: coerceToString(variant.option2 ?? '') || undefined,
      option3: coerceToString(variant.option3 ?? '') || undefined,
    };
  });
}

function sanitizeImages(images: ShopifyProduct['images'] | undefined): ShopifyProduct['images'] | undefined {
  if (!images || images.length === 0) return undefined;

  const sanitized = images
    .map((image, index) => ({
      src: coerceToString(image?.src),
      alt: coerceToString(image?.alt ?? ''),
      position: typeof image?.position === 'number' ? image.position : index + 1,
    }))
    .filter((image) => image.src.length > 0);

  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeProductPayload(product: ShopifyProduct): ShopifyProduct {
  const options = sanitizeOptions(product.options);
  const variants = sanitizeVariants(product.variants);
  const metafields = product.metafields
    ?.map((metafield) => ({
      namespace: coerceToString(metafield.namespace),
      key: coerceToString(metafield.key),
      type: coerceToString(metafield.type),
      value: coerceToString(metafield.value),
    }))
    .filter((metafield) => metafield.namespace && metafield.key && metafield.type && metafield.value);

  const normalizedVariants = variants.map((variant) => {
    const next = { ...variant };
    if (!options || options.length === 0) {
      delete next.option1;
      delete next.option2;
      delete next.option3;
    }
    return next;
  });

  return {
    title: coerceToString(product.title) || 'Untitled Listing',
    body_html: coerceToString(product.body_html ?? '') || undefined,
    vendor: coerceToString(product.vendor ?? '') || undefined,
    product_type: trimShopifyProductType(coerceToString(product.product_type ?? '')) || undefined,
    handle: coerceToString(product.handle ?? '') || undefined,
    status: normalizeStatus(product.status) ?? 'draft',
    tags: coerceToString(product.tags ?? '') || undefined,
    published_scope: normalizePublishedScope(product.published_scope),
    template_suffix: coerceToString(product.template_suffix ?? '') || undefined,
    variants: normalizedVariants,
    options,
    images: sanitizeImages(product.images),
    metafields: metafields && metafields.length > 0 ? metafields : undefined,
  };
}

export function buildShopifyDraftProductFromApprovalFields(fields: ApprovalFieldMap): ShopifyProduct {
  const condition = getConditionFromFields(fields);
  let options = sanitizeOptions(buildOptions(fields));
  let variants = sanitizeVariants(buildVariants(fields, options ?? []));
  ({ options, variants } = applyConditionToShopifyOptionsAndVariants(options, variants, condition));
  const images = sanitizeImages(buildImages(fields));
  const metafields = buildMetafields(fields);

  const candidate: ShopifyProduct = {
    title: getField(fields, ['Shopify REST Title', 'Shopify Title', 'Shopify GraphQL Title', 'Item Title', 'Title', 'Name', 'shopify_rest_title']) || 'Untitled Listing',
    body_html: resolveShopifyBodyHtml(fields) || undefined,
    vendor: SHOPIFY_DEFAULT_VENDOR,
    product_type: trimShopifyProductType(getField(fields, [...SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES])) || undefined,
    handle: getHandleField(fields) || undefined,
    published_at: getField(fields, ['Shopify REST Published At', 'Shopify Published At']) || undefined,
    published_scope: getField(fields, ['Shopify REST Published Scope', 'Shopify Published Scope', 'shopify_rest_published_scope']) || undefined,
    template_suffix: getField(fields, ['Shopify REST Template Suffix', 'Shopify Template Suffix', 'Shopify GraphQL Template Suffix', 'shopify_rest_template_suffix']) || undefined,
    tags: buildTags(fields),
    status: normalizeStatus(getField(fields, ['Shopify REST Status', 'Shopify Status', 'Shopify GraphQL Status'])) ?? 'draft',
    options,
    variants,
    images,
    metafields,
  };

  return sanitizeProductPayload(candidate);
}
