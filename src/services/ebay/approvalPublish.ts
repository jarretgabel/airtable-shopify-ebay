import type { EbayDraftPayloadBundle } from '@/services/ebayDraftFromAirtable';
import { API, getBusinessPolicyConfig, getInventoryLocationConfig, getMissingLocationFields, getMissingPolicyFields } from './config';
import { getOffersWithToken } from './inventory';
import { upsertWarehouseLocation } from './listingLocation';
import { publishOfferById } from './listingOfferHelpers';
import { inventoryJsonHeaders } from './listingPayloads';
import { getValidUserToken } from './token';

export interface EbayApprovalPushResult {
  sku: string;
  offerId: string;
  listingId: string;
  wasExistingOffer: boolean;
}

function normalizeSku(bundle: EbayDraftPayloadBundle): string {
  const inventorySku = String(bundle.inventoryItem.sku ?? '').trim();
  const offerSku = String(bundle.offer.sku ?? '').trim();
  const resolvedSku = inventorySku || offerSku;
  if (!resolvedSku) {
    throw new Error('eBay push requires an inventory SKU. Fill eBay Inventory SKU before pushing.');
  }
  return resolvedSku;
}

async function upsertInventoryItem(token: string, sku: string, inventoryItem: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${API}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify({
      ...inventoryItem,
      sku,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`createInventoryItem ${response.status}: ${JSON.stringify(errorBody)}`);
  }
}

async function createOrUpdateOffer(
  token: string,
  sku: string,
  offerPayload: Record<string, unknown>,
  existingOfferId?: string,
): Promise<{ offerId: string; wasExistingOffer: boolean }> {
  const payload = {
    ...offerPayload,
    sku,
  };

  if (existingOfferId) {
    const updateResponse = await fetch(`${API}/sell/inventory/v1/offer/${encodeURIComponent(existingOfferId)}`, {
      method: 'PUT',
      headers: inventoryJsonHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!updateResponse.ok) {
      const errorBody = await updateResponse.json().catch(() => ({}));
      throw new Error(`updateOffer ${updateResponse.status}: ${JSON.stringify(errorBody)}`);
    }

    return { offerId: existingOfferId, wasExistingOffer: true };
  }

  const createResponse = await fetch(`${API}/sell/inventory/v1/offer`, {
    method: 'POST',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!createResponse.ok) {
    const errorBody = await createResponse.json().catch(() => ({}));
    throw new Error(`createOffer ${createResponse.status}: ${JSON.stringify(errorBody)}`);
  }

  const created = (await createResponse.json().catch(() => ({}))) as { offerId?: string };
  if (!created.offerId) {
    throw new Error('createOffer succeeded but eBay did not return an offerId.');
  }

  return { offerId: created.offerId, wasExistingOffer: false };
}

export async function pushApprovalBundleToEbay(bundle: EbayDraftPayloadBundle): Promise<EbayApprovalPushResult> {
  const token = await getValidUserToken();
  const locationConfig = getInventoryLocationConfig();
  const policyConfig = getBusinessPolicyConfig();
  const missingLocation = getMissingLocationFields(locationConfig);
  const missingPolicies = getMissingPolicyFields(policyConfig);

  if (missingLocation.length > 0) {
    throw new Error(`Before pushing to eBay, add inventory location setup: ${missingLocation.join(', ')}.`);
  }

  if (missingPolicies.length > 0) {
    throw new Error(`Before pushing to eBay, add business policy IDs: ${missingPolicies.join(', ')}.`);
  }

  const sku = normalizeSku(bundle);
  await upsertWarehouseLocation(token, locationConfig);
  await upsertInventoryItem(token, sku, bundle.inventoryItem);

  const existingOffers = await getOffersWithToken(token, sku, 1);
  const existingOffer = existingOffers.offers[0];
  const offerPayload: Record<string, unknown> = {
    ...bundle.offer,
    sku,
    merchantLocationKey: locationConfig.key,
    listingPolicies: {
      fulfillmentPolicyId: policyConfig.fulfillmentPolicyId,
      paymentPolicyId: policyConfig.paymentPolicyId,
      returnPolicyId: policyConfig.returnPolicyId,
    },
  };
  const { offerId, wasExistingOffer } = await createOrUpdateOffer(token, sku, offerPayload, existingOffer?.offerId);

  if (existingOffer?.listingId && existingOffer.status === 'PUBLISHED') {
    return {
      sku,
      offerId,
      listingId: existingOffer.listingId,
      wasExistingOffer,
    };
  }

  const { listingId } = await publishOfferById(token, offerId);
  return { sku, offerId, listingId, wasExistingOffer };
}