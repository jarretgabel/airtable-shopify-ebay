export type SaleChannel = 'Shopify' | 'eBay';

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

// The first recorded sale wins, so redelivered or duplicate webhooks never overwrite the stored price or date.
export function buildSalePriceFields(
  currentFields: Record<string, unknown>,
  sale: { price: number | null | undefined; channel: SaleChannel; soldAt?: string | null },
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
  return fields;
}
