export type SaleChannel = 'Shopify' | 'eBay';

export interface SaleBuyer {
  name?: string;
  email?: string;
  phone?: string;
  shipTo?: string;
  username?: string;
  orderRef?: string;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Reads a buyer object from untrusted JSON, keeping only the known string fields.
export function parseSaleBuyer(value: unknown): SaleBuyer | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const buyer: SaleBuyer = {};
  for (const key of ['name', 'email', 'phone', 'shipTo', 'username', 'orderRef'] as const) {
    const text = clean(raw[key]);
    if (text) buyer[key] = text.slice(0, 500);
  }
  return Object.keys(buyer).length > 0 ? buyer : undefined;
}

export function formatShipTo(parts: Array<unknown>): string {
  return parts.map(clean).filter(Boolean).join(', ');
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

// The first recorded sale wins, so redelivered or duplicate webhooks never overwrite the stored price or date.
export function buildSalePriceFields(
  currentFields: Record<string, unknown>,
  sale: { price: number | null | undefined; channel: SaleChannel; soldAt?: string | null; buyer?: SaleBuyer },
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const soldAt = sale.soldAt ? new Date(sale.soldAt) : null;
  if (soldAt && !Number.isNaN(soldAt.getTime()) && !hasValue(currentFields['Sold At'])) {
    fields['Sold At'] = soldAt.toISOString().slice(0, 10);
  }
  if (typeof sale.price === 'number' && Number.isFinite(sale.price) && sale.price >= 0 && !hasValue(currentFields['Sale Price'])) {
    fields['Sale Price'] = Math.round(sale.price * 100) / 100;
    fields['Sold Via'] = sale.channel;
  }
  const buyerFields: Array<[string, string | undefined]> = [
    ['Buyer Name', sale.buyer?.name],
    ['Buyer Email', sale.buyer?.email],
    ['Buyer Phone', sale.buyer?.phone],
    ['Buyer Ship To', sale.buyer?.shipTo],
    ['Buyer Username', sale.buyer?.username],
    ['Sale Order', sale.buyer?.orderRef],
  ];
  for (const [field, value] of buyerFields) {
    if (value && !hasValue(currentFields[field])) fields[field] = value;
  }
  return fields;
}
