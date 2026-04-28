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

export interface EbayCategorySuggestion {
  id: string;
  name: string;
  path: string;
  level: number;
}

export interface EbayCategoryTreeNode {
  id: string;
  name: string;
  path: string;
  level: number;
  hasChildren: boolean;
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

export interface EbayPublishSetup {
  locationConfig: EbayLocationConfig;
  policyConfig: EbayBusinessPolicyConfig;
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

export interface EbayApprovalPushResult {
  sku: string;
  offerId: string;
  listingId: string;
  wasExistingOffer: boolean;
}

export interface EbayUploadedImageResult {
  url: string;
}

export interface EbayPublishedListing {
  item: EbayInventoryItem;
  offer: EbayOffer;
}

export interface EbayRuntimeConfig {
  authMode: 'server';
  environment: 'sandbox' | 'production';
  defaultListingApiMode: EbayListingApiMode;
  publishSetup: EbayPublishSetup;
  missingLocationFields: string[];
  missingPolicyFields: string[];
  hasRequiredPublishSetup: boolean;
}

export interface EbayDashboardSnapshot {
  inventoryItems: EbayInventoryItem[];
  offers: EbayOffer[];
  recentListings: EbayPublishedListing[];
  total: number;
  warning: string | null;
  runtimeConfig: EbayRuntimeConfig;
}

export function isValidEbaySku(sku: string): boolean {
  return /^[A-Za-z0-9]{1,50}$/.test(sku);
}
