type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';
interface ShippingWeight {
  weight?: number;
  weight_unit?: WeightUnit;
}

function normalizeUnit(value: unknown): WeightUnit {
  if (typeof value !== 'string') throw new Error('Shopify weight unit must be a supported string.');
  switch (value.trim().toLowerCase()) {
    case 'g': case 'gram': case 'grams': return 'g';
    case 'kg': case 'kgs': case 'kilogram': case 'kilograms': return 'kg';
    case 'oz': case 'ounce': case 'ounces': return 'oz';
    case 'lb': case 'lbs': case 'pound': case 'pounds': return 'lb';
    default: throw new Error(`Unsupported Shopify weight unit: ${value}`);
  }
}

function hasWeight(value: unknown): boolean {
  return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
}

export function parseShopifyShippingWeight(value: unknown, unit?: unknown, defaultUnit?: WeightUnit): ShippingWeight {
  if (!hasWeight(value)) return {};
  const match = typeof value === 'string'
    ? value.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z]+)?$/i)
    : null;
  const weight = typeof value === 'number' ? value : match ? Number(match[1]) : NaN;
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error('Shopify weight must be a finite, non-negative number with an optional supported unit.');
  }
  const explicitUnit = hasWeight(unit) ? normalizeUnit(unit) : undefined;
  const embeddedUnit = match?.[2] ? normalizeUnit(match[2]) : undefined;
  if (explicitUnit && embeddedUnit && explicitUnit !== embeddedUnit) {
    throw new Error('Shopify weight unit conflicts with the unit included in the weight value.');
  }
  const weightUnit = explicitUnit ?? embeddedUnit ?? defaultUnit;
  if (!weightUnit) throw new Error('Shopify weight unit is required when weight is provided.');
  return { weight, weight_unit: weightUnit };
}

export function parseLegacyShopifyShippingDetails(details: string): ShippingWeight & { dimensionsText: string } {
  const match = details.match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(kilograms?|kgs?|grams?|g|ounces?|oz|pounds?|lbs?)\b/i);
  if (!match) return { dimensionsText: details };
  return {
    ...parseShopifyShippingWeight(match[1], match[2]),
    dimensionsText: details.slice(match[0].length).trim(),
  };
}

export function resolveShopifyShippingWeight(options: {
  value: unknown;
  unit?: string;
  defaultUnit?: WeightUnit;
  legacyDetails: string;
}): ShippingWeight {
  if (hasWeight(options.value)) {
    return parseShopifyShippingWeight(options.value, options.unit, options.defaultUnit);
  }
  const legacy = parseLegacyShopifyShippingDetails(options.legacyDetails);
  if (legacy.weight === undefined) return {};
  return parseShopifyShippingWeight(`${legacy.weight} ${legacy.weight_unit}`, options.unit);
}
