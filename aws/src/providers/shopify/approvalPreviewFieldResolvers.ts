import type {
  ShopifyApprovalFieldResolution,
} from '../../shared/contracts/shopifyApproval.js';
import type { ShopifyProduct } from './approvalDraft.js';

export type ApprovalFieldMap = Record<string, unknown>;

const SHOPIFY_BODY_HTML_FIELD_CANDIDATES = [
  'Shopify REST Body HTML',
  'Shopify Body HTML',
  'Shopify GraphQL Description HTML',
  'Body (HTML)',
  'Body HTML',
  'body_html',
  'shopify_rest_body_html',
  'Item Description',
  'Description',
] as const;

const SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES = [
  'Shopify Body Description',
  'Shopify REST Body Description',
  'Item Description',
  'Description',
  'shopify_body_description',
  'shopify_rest_body_description',
] as const;

const SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES = [
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

const SHOPIFY_GRAPHQL_CATEGORY_ID_FIELD_CANDIDATES = [
  'Shopify GraphQL Category ID',
  'Shopify Extra Category ID',
  'Shopify Category ID',
  'shopify_graphql_category_id',
  'shopify_extra_category_id',
  'shopify_category_id',
] as const;

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function coerceToString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function trimShopifyProductType(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';
  const segments = normalized.split('>').map((segment) => segment.trim()).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : normalized;
}

function buildExactOrNormalizedResolution(fields: ApprovalFieldMap, candidates: readonly string[]): ShopifyApprovalFieldResolution | null {
  const entries = Object.entries(fields);
  for (const candidate of candidates) {
    const direct = fields[candidate];
    if (typeof direct === 'string' && direct.trim().length > 0) {
      return {
        sourceFieldName: candidate,
        sourceType: 'exact',
        value: direct,
      };
    }

    const normalizedCandidate = normalizeKey(candidate);
    const match = entries.find(([key]) => normalizeKey(key) === normalizedCandidate);
    if (match && typeof match[1] === 'string' && match[1].trim().length > 0) {
      return {
        sourceFieldName: match[0],
        sourceType: 'normalized',
        value: match[1],
      };
    }
  }

  return null;
}

export function resolveBodyHtml(fields: ApprovalFieldMap, draftProduct: ShopifyProduct): ShopifyApprovalFieldResolution {
  const exact = buildExactOrNormalizedResolution(fields, SHOPIFY_BODY_HTML_FIELD_CANDIDATES);
  if (exact) return exact;

  const fuzzy = Object.entries(fields).find(([key, value]) => {
    if (typeof value !== 'string' || value.trim().length === 0) return false;
    const normalized = key.toLowerCase();
    return normalized.includes('body html') || normalized.includes('description html') || normalized.includes('body_html');
  });

  if (fuzzy) {
    return {
      sourceFieldName: fuzzy[0],
      sourceType: 'fuzzy',
      value: fuzzy[1] as string,
    };
  }

  return {
    sourceFieldName: '',
    sourceType: 'draft-product',
    value: draftProduct.body_html ?? '',
  };
}

export function resolveDescription(fields: ApprovalFieldMap): ShopifyApprovalFieldResolution {
  const exact = buildExactOrNormalizedResolution(fields, SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES);
  if (exact) return exact;

  const fuzzy = Object.entries(fields).find(([key, value]) => {
    if (typeof value !== 'string' || value.trim().length === 0) return false;
    const normalized = key.toLowerCase();
    const isDescriptionLike = normalized.includes('description');
    const isHtmlLike = normalized.includes('html') || normalized.includes('body html');
    const isKeyFeaturesLike = normalized.includes('key feature') || normalized.includes('features');
    return isDescriptionLike && !isHtmlLike && !isKeyFeaturesLike;
  });

  if (fuzzy) {
    return {
      sourceFieldName: fuzzy[0],
      sourceType: 'fuzzy',
      value: fuzzy[1] as string,
    };
  }

  return {
    sourceFieldName: '',
    sourceType: 'none',
    value: '',
  };
}

export function resolveProductCategory(fields: ApprovalFieldMap, draftProduct: ShopifyProduct): ShopifyApprovalFieldResolution {
  const exact = buildExactOrNormalizedResolution(fields, SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES);
  if (exact) return exact;

  const fuzzy = Object.entries(fields).find(([key, value]) => {
    if (typeof value !== 'string' || value.trim().length === 0) return false;
    const normalized = key.toLowerCase();
    return normalized.includes('category') || normalized.includes('product type');
  });

  if (fuzzy) {
    return {
      sourceFieldName: fuzzy[0],
      sourceType: 'fuzzy',
      value: fuzzy[1] as string,
    };
  }

  return {
    sourceFieldName: '',
    sourceType: 'draft-product',
    value: draftProduct.product_type ?? '',
  };
}

export function resolveCategoryId(fields: ApprovalFieldMap): ShopifyApprovalFieldResolution {
  const exact = buildExactOrNormalizedResolution(fields, SHOPIFY_GRAPHQL_CATEGORY_ID_FIELD_CANDIDATES);
  return exact ?? {
    sourceFieldName: '',
    sourceType: 'none',
    value: '',
  };
}