export type SaleChannel = 'Shopify' | 'eBay';

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

// The first recorded sale wins, so redelivered or duplicate webhooks never overwrite the stored price.
export function buildSalePriceFields(
  currentFields: Record<string, unknown>,
  sale: { price: number | null | undefined; channel: SaleChannel },
): Record<string, unknown> {
  if (typeof sale.price !== 'number' || !Number.isFinite(sale.price) || sale.price < 0) {
    return {};
  }
  if (hasValue(currentFields['Sale Price'])) {
    return {};
  }
  return { 'Sale Price': Math.round(sale.price * 100) / 100, 'Sold Via': sale.channel };
}
