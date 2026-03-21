/**
 * eBay listing creation — Inventory API (draft + publish) and Trading API paths.
 */
import type { EbayListingApiMode, EbaySampleListingResult } from './types';
import { getPreferredListingApiMode } from './config';
import { createSampleDraftListing } from './listingOffer';
import { createTradingSampleListing } from './listingTrading';

export { createSampleDraftListing, publishSampleDraftListing } from './listingOffer';

export async function createSampleListing(
  mode: EbayListingApiMode = getPreferredListingApiMode(),
): Promise<EbaySampleListingResult> {
  if (mode === 'trading' || mode === 'trading-verify') {
    return createTradingSampleListing(mode);
  }

  const result = await createSampleDraftListing();
  return { mode: 'inventory', sku: result.sku, offerId: result.offerId, status: 'UNPUBLISHED' };
}
