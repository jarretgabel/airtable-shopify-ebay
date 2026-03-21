import type { EbayBusinessPolicyConfig, EbayLocationConfig } from './types';
import { SAMPLE_SKU } from './listingConstants';

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