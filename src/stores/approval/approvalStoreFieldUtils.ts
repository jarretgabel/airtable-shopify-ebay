import {
  FALLBACK_LISTING_FORMAT_OPTIONS,
  ITEM_CONDITION_OPTIONS,
  SHIPPING_SERVICE_FIELD,
} from '@/stores/approval/approvalStoreConstants';

export type ApprovalFieldKind = 'boolean' | 'number' | 'json' | 'text';

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function inferFieldKind(value: unknown): ApprovalFieldKind {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'json';
  if (value && typeof value === 'object') return 'json';
  return 'text';
}

export function toFormValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function fromFormValue(raw: string, kind: ApprovalFieldKind): unknown {
  if (raw === '') return null;

  if (kind === 'boolean') return raw === 'true';

  if (kind === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (kind === 'json') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  return raw;
}

export function getDropdownOptions(fieldName: string): string[] | null {
  if (fieldName.trim().toLowerCase() === 'item condition') return ITEM_CONDITION_OPTIONS;
  return null;
}

export function isAllowOffersField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === 'allow offers';
}

export function isShippingServiceField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'domestic service 1'
    || normalized === 'domestic service 2'
    || normalized === 'international service 1'
    || normalized === 'international service 2';
}

function normalizeListingFormat(raw: string): string {
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'FIXED_PRICE') return 'Buy It Now';
  if (normalized === 'AUCTION') return 'Auction';
  return raw.trim();
}

export function resolveListingFormatOptions(formats: string[]): string[] {
  return Array.from(new Set([...FALLBACK_LISTING_FORMAT_OPTIONS, ...formats.map(normalizeListingFormat)]))
    .filter((format) => format.length > 0);
}

export function mapShippingServiceToFields(values: Record<string, string>): Record<string, string> {
  const selected = values[SHIPPING_SERVICE_FIELD] ?? '';
  return {
    ...values,
    'Domestic Service 1': selected === 'UPS Ground' || selected === 'UPS 3-Day Select' ? selected : '',
    'Domestic Service 2': '',
    'International Service 1':
      selected === 'International'
      || selected === 'USPS Priority Mail International'
      || selected === 'eBay International Standard Delivery'
        ? selected
        : '',
    'International Service 2': '',
  };
}