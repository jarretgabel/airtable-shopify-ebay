import { API, getBusinessPolicyConfig, getInventoryLocationConfig, getMissingLocationFields, getMissingPolicyFields } from './config';
import { getOffersWithToken } from './inventory';
import { buildSampleOfferPayload, inventoryJsonHeaders, SAMPLE_SKU, upsertWarehouseLocation } from './listingShared';
import type { EbayBusinessPolicyConfig, EbayLocationConfig, EbayOfferDetails } from './types';

function buildSampleInventoryItemPayload(): Record<string, unknown> {
  return {
    product: {
      title: 'McIntosh MA8900 Integrated Amplifier — Resolution AV Demo',
      description:
        '<p>The McIntosh MA8900 is a premium 200-watt-per-channel integrated amplifier combining solid-state power with vacuum tube inputs. ' +
        'Features include a built-in DAC supporting PCM up to 32-bit/384kHz and DSD128, MM/MC phono stage, ' +
        "and McIntosh's iconic illuminated watt meters. Listed via Resolution AV's inventory management system.</p>",
      imageUrls: [
        'https://images.crutchfieldonline.com/ImageHandler/trim/3000/1950/products/2018/45/793/g793MA8900/0.jpg',
      ],
      aspects: {
        Brand: ['McIntosh'],
        Model: ['MA8900'],
        MPN: ['MA8900'],
        'Country/Region of Manufacture': ['United States'],
        Type: ['Integrated Amplifier'],
        'Power Output': ['200W per channel'],
        Impedance: ['8 ohms'],
        Color: ['Black/Silver'],
      },
      brand: 'McIntosh',
      mpn: 'MA8900',
    },
    condition: 'USED_EXCELLENT',
    conditionDescription: 'Excellent cosmetic condition. No visible scratches or wear. Original remote and manual included.',
    availability: {
      shipToLocationAvailability: { quantity: 1 },
    },
  };
}

export async function upsertSampleInventoryItem(token: string): Promise<void> {
  const itemRes = await fetch(`${API}/sell/inventory/v1/inventory_item/${encodeURIComponent(SAMPLE_SKU)}`, {
    method: 'PUT',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify(buildSampleInventoryItemPayload()),
  });

  if (!itemRes.ok) {
    const err = await itemRes.json().catch(() => ({}));
    throw new Error(`createInventoryItem ${itemRes.status}: ${JSON.stringify(err)}`);
  }
}

export function getPublishSetup(): {
  locationConfig: EbayLocationConfig;
  policyConfig: EbayBusinessPolicyConfig;
  missingLocation: string[];
  missingPolicies: string[];
} {
  const locationConfig = getInventoryLocationConfig();
  const policyConfig = getBusinessPolicyConfig();
  const missingLocation = getMissingLocationFields(locationConfig);
  const missingPolicies = getMissingPolicyFields(policyConfig);

  return {
    locationConfig,
    policyConfig,
    missingLocation,
    missingPolicies,
  };
}

export async function createOrUpdateSampleOffer(
  token: string,
  offerId?: string,
): Promise<{ sku: string; offerId: string }> {
  const { locationConfig, policyConfig, missingLocation, missingPolicies } = getPublishSetup();
  const hasLocationConfig = missingLocation.length === 0;
  const hasPolicyConfig = missingPolicies.length === 0;

  if (hasLocationConfig) {
    await upsertWarehouseLocation(token, locationConfig);
  }

  const payload = buildSampleOfferPayload(
    hasLocationConfig ? locationConfig : null,
    hasPolicyConfig ? policyConfig : null,
  );

  if (!offerId) {
    const createRes = await fetch(`${API}/sell/inventory/v1/offer`, {
      method: 'POST',
      headers: inventoryJsonHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const err = (await createRes.json().catch(() => ({}))) as {
        errors?: Array<{ errorId?: number }>;
      };

      if (createRes.status === 409 || err.errors?.some((error) => error.errorId === 25002)) {
        const existing = await getOffersWithToken(token, SAMPLE_SKU, 1);
        if (existing.offers.length > 0) {
          return createOrUpdateSampleOffer(token, existing.offers[0].offerId);
        }
      }

      throw new Error(`createOffer ${createRes.status}: ${JSON.stringify(err)}`);
    }

    const offerData = (await createRes.json()) as { offerId?: string };
    return { sku: SAMPLE_SKU, offerId: offerData.offerId ?? '' };
  }

  const updateRes = await fetch(`${API}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    method: 'PUT',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(`updateOffer ${updateRes.status}: ${JSON.stringify(err)}`);
  }

  return { sku: SAMPLE_SKU, offerId };
}

export function shouldUpdateOfferForPublish(
  details: EbayOfferDetails,
  locationConfig: EbayLocationConfig,
  policyConfig: EbayBusinessPolicyConfig,
): boolean {
  return details.merchantLocationKey !== locationConfig.key
    || details.listingPolicies?.fulfillmentPolicyId !== policyConfig.fulfillmentPolicyId
    || details.listingPolicies?.paymentPolicyId !== policyConfig.paymentPolicyId
    || details.listingPolicies?.returnPolicyId !== policyConfig.returnPolicyId
    || details.availableQuantity !== 1
    || details.categoryId !== '3276'
    || details.listingDuration !== 'GTC';
}

export async function publishOfferById(
  token: string,
  offerId: string,
): Promise<{ listingId: string }> {
  const publishRes = await fetch(`${API}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
    },
  });

  const publishData = (await publishRes.json().catch(() => ({}))) as {
    listingId?: string;
    errors?: Array<{ message?: string; parameters?: Array<{ value?: string }> }>;
  };

  if (!publishRes.ok) {
    const firstError = publishData.errors?.[0];
    const parameterValues = firstError?.parameters?.map((parameter) => parameter.value).filter(Boolean).join(', ');
    const suffix = parameterValues ? ` (${parameterValues})` : '';
    throw new Error(`publishOffer ${publishRes.status}: ${firstError?.message ?? JSON.stringify(publishData)}${suffix}`);
  }

  if (!publishData.listingId) {
    throw new Error('publishOffer succeeded but eBay did not return a listingId.');
  }

  return { listingId: publishData.listingId };
}