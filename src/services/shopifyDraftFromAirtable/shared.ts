import { SHOPIFY_DEFAULT_VENDOR } from '@/services/shopifyTags';
import type { ShopifyProduct } from '@/types/shopify';

export type ApprovalFieldMap = Record<string, unknown>;

export const CONDITION_LABELS = ['Used', 'New', 'Open Box', 'For Parts or not working'] as const;

export const SHOPIFY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES = [
  'Shopify REST Body HTML Template',
  'Shopify Body HTML Template',
  'shopify_rest_body_html_template',
  'shopify_body_html_template',
] as const;

export const SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES = [
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

export function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function coerceStructuredToString(value: unknown): string {
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

export function getField(fields: ApprovalFieldMap, candidates: string[]): string {
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

export function hasAnyField(fields: ApprovalFieldMap, candidates: readonly string[]): boolean {
  const normalizedCandidates = new Set(candidates.map((candidate) => normalizeKey(candidate)));
  return Object.keys(fields).some((key) => normalizedCandidates.has(normalizeKey(key)));
}

export function getRawField(fields: ApprovalFieldMap, candidates: string[]): unknown {
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

export function getFieldPreservingStructuredValues(fields: ApprovalFieldMap, candidates: string[]): string {
  return coerceStructuredToString(getRawField(fields, candidates));
}

export function parseJsonArray<T>(raw: unknown): T[] | undefined {
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

export function hasAnyFieldValue(fields: ApprovalFieldMap, candidates: string[]): boolean {
  return candidates.some((candidate) => {
    const raw = getRawField(fields, [candidate]);
    if (Array.isArray(raw)) return raw.length > 0;
    return coerceToString(raw).length > 0;
  });
}

export function parseBoolean(raw: string, fallback: boolean): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return fallback;
  if (['true', '1', 'yes', 'y'].includes(value)) return true;
  if (['false', '0', 'no', 'n'].includes(value)) return false;
  return fallback;
}

export function parseNumber(raw: string): number | undefined {
  const cleaned = raw.trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseInteger(raw: string): number | undefined {
  const parsed = parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toMoneyString(raw: unknown, fallback = '0.00'): string {
  const value = coerceToString(raw);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed.toFixed(2);
}

export function normalizeWeightUnit(raw: unknown): 'g' | 'kg' | 'oz' | 'lb' | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (!value) return undefined;
  if (value === 'g' || value === 'gram' || value === 'grams') return 'g';
  if (value === 'kg' || value === 'kilogram' || value === 'kilograms') return 'kg';
  if (value === 'oz' || value === 'ounce' || value === 'ounces') return 'oz';
  if (value === 'lb' || value === 'lbs' || value === 'pound' || value === 'pounds') return 'lb';
  return undefined;
}

export function normalizeInventoryPolicy(raw: unknown): 'deny' | 'continue' | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (value === 'deny' || value === 'continue') return value;
  return undefined;
}

export function normalizeInventoryManagement(raw: unknown): 'shopify' | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (value === 'shopify') return 'shopify';
  return undefined;
}

export function normalizeFulfillmentService(raw: unknown): string | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (!value) return undefined;
  if (value === 'manual') return 'manual';
  return value;
}

export function normalizePublishedScope(raw: unknown): 'web' | 'global' | undefined {
  const value = coerceToString(raw).toLowerCase();
  if (value === 'web' || value === 'global') return value;
  return undefined;
}

export function normalizeStatus(raw: unknown): ShopifyProduct['status'] {
  const value = coerceToString(raw).toLowerCase();
  if (value === 'active' || value === 'draft' || value === 'archived') return value;
  return undefined;
}

export function normalizeConditionLabel(raw: string): string | undefined {
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

export function normalizeMetafieldToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
}

export function isAllowedMetafieldType(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return /^[a-z_]+(?:\.[a-z_]+)*$/i.test(value);
}

export function isValidMetafieldNamespace(raw: string): boolean {
  return raw.length >= 2 && raw.length <= 255;
}

export function isValidMetafieldKey(raw: string): boolean {
  return raw.length >= 2 && raw.length <= 64;
}

export { SHOPIFY_DEFAULT_VENDOR };