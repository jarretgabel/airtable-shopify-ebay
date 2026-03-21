import { API, getBusinessPolicyConfig, getInventoryLocationConfig, getMissingLocationFields, getMissingPolicyFields } from './config';
import { getValidUserToken } from './token';
import { getOffer, getOffers, getOffersWithToken } from './inventory';
import { buildSampleOfferPayload, inventoryJsonHeaders, SAMPLE_SKU, upsertWarehouseLocation } from './listingShared';

async function createOrUpdateSampleOffer(
  token: string,
  offerId?: string,
): Promise<{ sku: string; offerId: string }> {
  const locationConfig = getInventoryLocationConfig();
  const policyConfig = getBusinessPolicyConfig();
  const hasLocationConfig = getMissingLocationFields(locationConfig).length === 0;
  const hasPolicyConfig = getMissingPolicyFields(policyConfig).length === 0;

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

export async function createSampleDraftListing(): Promise<{ sku: string; offerId: string }> {
  const token = await getValidUserToken();

  const itemRes = await fetch(`${API}/sell/inventory/v1/inventory_item/${encodeURIComponent(SAMPLE_SKU)}`, {
    method: 'PUT',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify({
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
    }),
  });

  if (!itemRes.ok) {
    const err = await itemRes.json().catch(() => ({}));
    throw new Error(`createInventoryItem ${itemRes.status}: ${JSON.stringify(err)}`);
  }

  const existing = await getOffers(SAMPLE_SKU, 1);
  return createOrUpdateSampleOffer(token, existing.offers[0]?.offerId);
}

export async function publishSampleDraftListing(): Promise<{ sku: string; offerId: string; listingId: string }> {
  const token = await getValidUserToken();
  const locationConfig = getInventoryLocationConfig();
  const policyConfig = getBusinessPolicyConfig();
  const missingLocation = getMissingLocationFields(locationConfig);
  const missingPolicies = getMissingPolicyFields(policyConfig);

  if (missingLocation.length > 0) {
    throw new Error(`Before publishing, add eBay inventory location setup: ${missingLocation.join(', ')}.`);
  }
  if (missingPolicies.length > 0) {
    throw new Error(`Before publishing, add eBay business policy IDs: ${missingPolicies.join(', ')}.`);
  }

  const { offerId, sku } = await createSampleDraftListing();
  const details = await getOffer(offerId);

  const needsOfferUpdate =
    details.merchantLocationKey !== locationConfig.key ||
    details.listingPolicies?.fulfillmentPolicyId !== policyConfig.fulfillmentPolicyId ||
    details.listingPolicies?.paymentPolicyId !== policyConfig.paymentPolicyId ||
    details.listingPolicies?.returnPolicyId !== policyConfig.returnPolicyId ||
    details.availableQuantity !== 1 ||
    details.categoryId !== '3276' ||
    details.listingDuration !== 'GTC';

  if (needsOfferUpdate) {
    await createOrUpdateSampleOffer(token, offerId);
  }

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

  return { sku, offerId, listingId: publishData.listingId };
}
