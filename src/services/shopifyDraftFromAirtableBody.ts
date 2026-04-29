import { buildShopifyBodyHtml, formatKeyFeatureHtml } from '@/services/shopifyBodyHtml';
import { SHOPIFY_DEFAULT_VENDOR } from '@/services/shopifyDraftFromAirtable/shared';
import {
  ApprovalFieldMap,
  getField,
  getFieldPreservingStructuredValues,
  hasAnyField,
  normalizeKey,
  SHOPIFY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES,
  SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES,
} from '@/services/shopifyDraftFromAirtable/shared';

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
  { token: 'title', candidates: ['Shopify REST Title', 'Shopify Title', 'Item Title', 'Title', 'Name'] },
  { token: 'vendor', candidates: ['Shopify REST Vendor', 'Shopify Vendor', 'Vendor', 'Brand', 'Manufacturer'] },
  { token: 'product_type', candidates: [...SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES] },
  { token: 'condition', candidates: ['__Condition__', 'Item Condition', 'Condition', 'Shopify Condition', 'Shopify REST Condition'] },
  { token: 'price', candidates: ['Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'Price'] },
  { token: 'sku', candidates: ['Shopify REST Variant 1 SKU', 'SKU', 'shopify_rest_variant_1_sku'] },
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
  { token: 'body_intro', candidates: ['Shopify Body Intro', 'Shopify REST Body Intro', 'shopify_body_intro', 'shopify_rest_body_intro'] },
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

export function getHandleField(fields: ApprovalFieldMap): string {
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
    return typeof value === 'string' && value.trim().length > 0;
  });

  return fuzzy && typeof fuzzy[1] === 'string' ? fuzzy[1].trim() : '';
}

export function getBodyHtmlField(fields: ApprovalFieldMap): string {
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
    return typeof value === 'string' && value.trim().length > 0;
  });

  return fuzzy && typeof fuzzy[1] === 'string' ? fuzzy[1].trim() : '';
}

export function resolveShopifyBodyHtml(fields: ApprovalFieldMap): string {
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
    if (!hasEditableBodyFields) return fallbackBodyHtml;
    return buildShopifyBodyHtml(bodyDescription, rawKeyFeatures, fallbackBodyHtml);
  }

  if (bodyDescription || bodyKeyFeatures) {
    return buildShopifyBodyHtml(bodyDescription, rawKeyFeatures, explicitTemplate);
  }

  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, tokenName: string) => {
    return tokenValues.get(tokenName.toLowerCase()) ?? '';
  });
}