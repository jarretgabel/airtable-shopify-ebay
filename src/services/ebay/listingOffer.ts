import { getValidUserToken } from './token';
import { getOffer, getOffers } from './inventory';
import { SAMPLE_SKU } from './listingShared';
import {
  createOrUpdateSampleOffer,
  getPublishSetup,
  publishOfferById,
  shouldUpdateOfferForPublish,
  upsertSampleInventoryItem,
} from './listingOfferHelpers';

export async function createSampleDraftListing(): Promise<{ sku: string; offerId: string }> {
  const token = await getValidUserToken();
  await upsertSampleInventoryItem(token);

  const existing = await getOffers(SAMPLE_SKU, 1);
  return createOrUpdateSampleOffer(token, existing.offers[0]?.offerId);
}

export async function publishSampleDraftListing(): Promise<{ sku: string; offerId: string; listingId: string }> {
  const token = await getValidUserToken();
  const { locationConfig, policyConfig, missingLocation, missingPolicies } = getPublishSetup();

  if (missingLocation.length > 0) {
    throw new Error(`Before publishing, add eBay inventory location setup: ${missingLocation.join(', ')}.`);
  }
  if (missingPolicies.length > 0) {
    throw new Error(`Before publishing, add eBay business policy IDs: ${missingPolicies.join(', ')}.`);
  }

  const { offerId, sku } = await createSampleDraftListing();
  const details = await getOffer(offerId);

  if (shouldUpdateOfferForPublish(details, locationConfig, policyConfig)) {
    await createOrUpdateSampleOffer(token, offerId);
  }
  const { listingId } = await publishOfferById(token, offerId);
  return { sku, offerId, listingId };
}
