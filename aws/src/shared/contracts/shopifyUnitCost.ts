// Airtable `Cost` is a USD currency field holding the acquisition cost of one sellable listing unit.
export const SHOPIFY_UNIT_COST_CURRENCY = 'USD';

export interface ShopifyUnitCostParseResult {
  cost?: string;
  error?: string;
}

const MALFORMED_COST_ERROR = 'Cost must be a non-negative dollar amount with at most two decimal places.';

/**
 * Normalizes a private unit cost for Shopify's inventory item `cost`.
 * Blank means "not provided" so an existing Shopify cost is preserved; zero is a valid cost.
 * Values are never converted, divided or silently rounded.
 */
export function parseShopifyUnitCost(raw: unknown): ShopifyUnitCostParseResult {
  if (raw === null || raw === undefined) return {};

  let text: string;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { error: MALFORMED_COST_ERROR };
    text = String(raw);
  } else if (typeof raw === 'string') {
    text = raw;
  } else {
    return { error: MALFORMED_COST_ERROR };
  }

  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '').trim();
  if (!cleaned) return {};
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return { error: MALFORMED_COST_ERROR };

  return { cost: Number(cleaned).toFixed(2) };
}
