import type { EbaySampleListingResult } from './types';
import { getBusinessPolicyConfig, getInventoryLocationConfig } from './config';
import { getValidUserToken } from './token';
import { addTradingSampleListing, verifyTradingSampleListing } from './listingTradingHelpers';

export async function createTradingSampleListing(
  mode: 'trading' | 'trading-verify',
): Promise<EbaySampleListingResult> {
  const token = await getValidUserToken();
  const locationConfig = getInventoryLocationConfig();
  const policyConfig = getBusinessPolicyConfig();

  if (!locationConfig.postalCode.trim()) {
    throw new Error('Trading API listing requires a postal code in the eBay publish setup.');
  }

  const sku = `RAVTRADING${Date.now()}`;
  await verifyTradingSampleListing(token, sku, locationConfig, policyConfig);

  if (mode === 'trading-verify') {
    return { mode, sku, status: 'VERIFIED' };
  }
  const listingId = await addTradingSampleListing(token, sku, locationConfig, policyConfig);

  return { mode: 'trading', sku, listingId, status: 'ACTIVE' };
}
