import type { EbayBusinessPolicyConfig, EbayLocationConfig } from './types';
import { API, getMissingLocationFields } from './config';

export const SAMPLE_SKU = 'RAVMCINTOSHMA8900DEMO';

export function inventoryJsonHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
  };
}

export function buildSampleOfferPayload(
  locationConfig: EbayLocationConfig | null,
  policyConfig: EbayBusinessPolicyConfig | null,
): Record<string, unknown> {
  return {
    sku: SAMPLE_SKU,
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: '3276',
    listingDescription:
      '<p>McIntosh MA8900 200W Integrated Amplifier — demo listing created by Resolution AV inventory dashboard.</p>',
    listingDuration: 'GTC',
    pricingSummary: {
      price: { value: '4999.00', currency: 'USD' },
    },
    quantityLimitPerBuyer: 1,
    includeCatalogProductDetails: false,
    ...(locationConfig?.key ? { merchantLocationKey: locationConfig.key } : {}),
    ...(policyConfig
      ? {
          listingPolicies: {
            fulfillmentPolicyId: policyConfig.fulfillmentPolicyId,
            paymentPolicyId: policyConfig.paymentPolicyId,
            returnPolicyId: policyConfig.returnPolicyId,
          },
        }
      : {}),
  };
}

export async function upsertWarehouseLocation(token: string, config: EbayLocationConfig): Promise<void> {
  const missing = getMissingLocationFields(config);
  if (missing.length > 0) {
    throw new Error(`Missing eBay inventory location setup: ${missing.join(', ')}.`);
  }

  const body = {
    name: config.name || config.key,
    merchantLocationStatus: 'ENABLED',
    locationTypes: ['WAREHOUSE'],
    location: {
      address: {
        country: config.country,
        ...(config.postalCode ? { postalCode: config.postalCode } : {}),
        ...(config.city ? { city: config.city } : {}),
        ...(config.stateOrProvince ? { stateOrProvince: config.stateOrProvince } : {}),
      },
    },
  };

  const res = await fetch(`${API}/sell/inventory/v1/location/${encodeURIComponent(config.key)}`, {
    method: 'POST',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 204 || res.status === 409) return;

  const err = await res.json().catch(() => ({}));
  throw new Error(`createInventoryLocation ${res.status}: ${JSON.stringify(err)}`);
}
