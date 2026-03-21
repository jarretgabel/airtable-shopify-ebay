// ─── eBay service types ───────────────────────────────────────────────────────

export interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

export type EbayListingApiMode = 'inventory' | 'trading' | 'trading-verify';

export interface EbaySampleListingResult {
  mode: EbayListingApiMode;
  sku: string;
  status: 'UNPUBLISHED' | 'ACTIVE' | 'VERIFIED';
  offerId?: string;
  listingId?: string;
}

export interface EbayInventoryItem {
  sku: string;
  product?: {
    title?: string;
    description?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
    brand?: string;
    mpn?: string;
  };
  condition?: string;
  conditionDescription?: string;
  availability?: {
    shipToLocationAvailability?: { quantity?: number };
  };
}

export interface EbayOffer {
  offerId?: string;
  sku: string;
  status?: 'UNPUBLISHED' | 'PUBLISHED' | 'ENDED';
  listingId?: string;
  availableQuantity?: number;
  format?: string;
  marketplaceId?: string;
  categoryId?: string;
  listingDescription?: string;
  listingDuration?: string;
  merchantLocationKey?: string;
  includeCatalogProductDetails?: boolean;
  pricingSummary?: {
    price?: { value: string; currency: string };
  };
  listingPolicies?: {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  };
}

export interface EbayInventoryPage {
  inventoryItems: EbayInventoryItem[];
  total: number;
  href?: string;
  next?: string;
}

export interface EbayOfferPage {
  offers: EbayOffer[];
  total: number;
}

export interface EbayPublicListing {
  itemId: string;
  title: string;
  itemWebUrl: string;
  imageUrl?: string;
  price?: string;
  condition?: string;
}

export interface EbayLocationConfig {
  key: string;
  name: string;
  country: string;
  postalCode: string;
  city: string;
  stateOrProvince: string;
}

export interface EbayBusinessPolicyConfig {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

export interface EbayOfferDetails extends EbayOffer {
  offerId: string;
  marketplaceId: string;
  format: string;
  listingDuration: string;
  includeCatalogProductDetails: boolean;
  hideBuyerDetails?: boolean;
  quantityLimitPerBuyer?: number;
}

export function isValidEbaySku(sku: string): boolean {
  return /^[A-Za-z0-9]{1,50}$/.test(sku);
}
