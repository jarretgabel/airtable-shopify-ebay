import type { ApprovalFieldMap, ShopifyProduct } from './approvalDraftTypes.js';

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
  Object.entries(fields).forEach(([key, value]) => normalizedMap.set(normalizeKey(key), value));
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
  Object.entries(fields).forEach(([key, value]) => normalizedMap.set(normalizeKey(key), value));
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
    return Array.isArray(parsed) ? parsed as T[] : undefined;
  } catch {
    return undefined;
  }
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
  if (['g', 'gram', 'grams'].includes(value)) return 'g';
  if (['kg', 'kilogram', 'kilograms'].includes(value)) return 'kg';
  if (['oz', 'ounce', 'ounces'].includes(value)) return 'oz';
  if (['lb', 'lbs', 'pound', 'pounds'].includes(value)) return 'lb';
  return undefined;
}

export function normalizeInventoryManagement(raw: unknown): 'shopify' | undefined {
  return coerceToString(raw).toLowerCase() === 'shopify' ? 'shopify' : undefined;
}

export function normalizeInventoryPolicy(raw: unknown): 'deny' | 'continue' | undefined {
  const value = coerceToString(raw).toLowerCase();
  return value === 'deny' || value === 'continue' ? value : undefined;
}

export function normalizePublishedScope(raw: unknown): 'web' | 'global' | undefined {
  const value = coerceToString(raw).toLowerCase();
  return value === 'web' || value === 'global' ? value : undefined;
}

export function normalizeStatus(raw: unknown): ShopifyProduct['status'] {
  const value = coerceToString(raw).toLowerCase();
  return value === 'active' || value === 'draft' || value === 'archived' ? value : undefined;
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

export function trimShopifyProductType(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';
  const segments = normalized.split('>').map((segment) => segment.trim()).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : normalized;
}