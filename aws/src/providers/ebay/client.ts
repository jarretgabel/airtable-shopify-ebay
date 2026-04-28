import { HttpError } from '../../shared/errors.js';
import { getOptionalSecret, requireSecret } from '../../shared/secrets.js';

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

export interface EbayOfferDetails extends EbayOffer {
  offerId: string;
  marketplaceId: string;
  format: string;
  listingDuration: string;
  includeCatalogProductDetails: boolean;
  hideBuyerDetails?: boolean;
  quantityLimitPerBuyer?: number;
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

export interface EbaySampleListingResult {
  mode: 'inventory' | 'trading' | 'trading-verify';
  sku: string;
  status: 'UNPUBLISHED' | 'ACTIVE' | 'VERIFIED';
  offerId?: string;
  listingId?: string;
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
  defaultListingApiMode: 'inventory' | 'trading' | 'trading-verify';
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

interface EbayDraftPayloadBundle {
  inventoryItem: Record<string, unknown>;
  offer: Record<string, unknown>;
}

interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
}

interface EbayCategoryTreeResponse {
  categoryTreeId?: string;
}

interface EbayCategorySuggestionNode {
  category?: {
    categoryId?: string;
    categoryName?: string;
  };
  categoryTreeNodeLevel?: number;
  categoryTreeNodeAncestors?: Array<{
    categoryName?: string;
  }>;
}

interface EbayCategorySuggestionsResponse {
  categorySuggestions?: EbayCategorySuggestionNode[];
}

interface EbayCategoryTreeNodeResponse {
  category?: {
    categoryId?: string;
    categoryName?: string;
  };
  childCategoryTreeNodes?: EbayCategoryTreeNodeResponse[];
  leafCategoryTreeNode?: boolean;
  categoryTreeNodeLevel?: number;
  categoryTreeNodeAncestors?: Array<{
    categoryName?: string;
  }>;
}

interface EbayCategoryTreeFullResponse {
  rootCategoryNode?: EbayCategoryTreeNodeResponse;
}

interface EbayCategorySubtreeResponse {
  categorySubtreeNode?: EbayCategoryTreeNodeResponse;
}

const DEFAULT_EBAY_APP_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const EBAY_OFFERS_MAX_PAGE_SIZE = 25;
const SAMPLE_SKU = 'RAVMCINTOSHMA8900DEMO';
const MAX_VISIBLE_LISTINGS = 20;
const FALLBACK_PACKAGE_TYPES = [
  'Package/Thick Envelope',
  'Large Envelope',
  'Letter',
  'Large Package',
  'Extra Large Package',
  'UPS Letter',
  'FedEx Envelope',
  'FedEx Pak',
  'FedEx Box',
] as const;

const treeIdByMarketplace = new Map<string, string>();
const rootNodesByMarketplace = new Map<string, EbayCategoryTreeNode[]>();
const childNodesByMarketplaceAndParent = new Map<string, EbayCategoryTreeNode[]>();
const packageTypesByMarketplace = new Map<string, string[]>();

let cachedUserToken: { accessToken: string; expiresAt: number } | null = null;
let cachedAppToken: { accessToken: string; expiresAt: number } | null = null;
let pendingUserTokenPromise: Promise<string> | null = null;
let pendingAppTokenPromise: Promise<string> | null = null;

function isSandbox(): boolean {
  return (getOptionalSecret('EBAY_ENV') ?? '').toLowerCase() !== 'production';
}

function getApiBaseUrl(): string {
  return isSandbox() ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}

function getAuthBaseUrl(): string {
  return getOptionalSecret('EBAY_AUTH_HOST')
    ?? (isSandbox() ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com');
}

function getBasicAuthHeader(): string {
  const clientId = requireSecret('EBAY_CLIENT_ID');
  const clientSecret = requireSecret('EBAY_CLIENT_SECRET');
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

function normalizeMarketplaceId(marketplaceId: string): string {
  return marketplaceId.trim().toUpperCase() || 'EBAY_US';
}

function cleanOptional(value: string | undefined): string {
  return value?.trim() ?? '';
}

function isValidEbaySku(sku: string): boolean {
  return /^[A-Za-z0-9]{1,50}$/.test(sku);
}

function getDefaultListingApiMode(): 'inventory' | 'trading' | 'trading-verify' {
  const raw = (getOptionalSecret('EBAY_LISTING_API') ?? 'inventory').trim().toLowerCase();
  return raw === 'trading' || raw === 'trading-verify' ? raw : 'inventory';
}

function getDefaultPublishSetup(): EbayPublishSetup {
  const locationKey = cleanOptional(getOptionalSecret('EBAY_LOCATION_KEY'));
  return {
    locationConfig: {
      key: locationKey,
      name: cleanOptional(getOptionalSecret('EBAY_LOCATION_NAME')) || locationKey,
      country: cleanOptional(getOptionalSecret('EBAY_LOCATION_COUNTRY')).toUpperCase(),
      postalCode: cleanOptional(getOptionalSecret('EBAY_LOCATION_POSTAL_CODE')),
      city: cleanOptional(getOptionalSecret('EBAY_LOCATION_CITY')),
      stateOrProvince: cleanOptional(getOptionalSecret('EBAY_LOCATION_STATE')),
    },
    policyConfig: {
      fulfillmentPolicyId: cleanOptional(getOptionalSecret('EBAY_FULFILLMENT_POLICY_ID')),
      paymentPolicyId: cleanOptional(getOptionalSecret('EBAY_PAYMENT_POLICY_ID')),
      returnPolicyId: cleanOptional(getOptionalSecret('EBAY_RETURN_POLICY_ID')),
    },
  };
}

export function getRuntimeConfig(): EbayRuntimeConfig {
  const publishSetup = getDefaultPublishSetup();
  const missingLocationFields = getMissingLocationFields(publishSetup.locationConfig);
  const missingPolicyFields = getMissingPolicyFields(publishSetup.policyConfig);

  return {
    authMode: 'server',
    environment: isSandbox() ? 'sandbox' : 'production',
    defaultListingApiMode: getDefaultListingApiMode(),
    publishSetup,
    missingLocationFields,
    missingPolicyFields,
    hasRequiredPublishSetup: missingLocationFields.length === 0 && missingPolicyFields.length === 0,
  };
}

function getMissingLocationFields(config: EbayLocationConfig): string[] {
  const missing: string[] = [];
  if (!cleanOptional(config.key)) missing.push('location key');
  if (!cleanOptional(config.country)) missing.push('country');
  const hasPostal = Boolean(cleanOptional(config.postalCode));
  const hasCityState = Boolean(cleanOptional(config.city) && cleanOptional(config.stateOrProvince));
  if (!hasPostal && !hasCityState) missing.push('postal code or city/state');
  return missing;
}

function getMissingPolicyFields(config: EbayBusinessPolicyConfig): string[] {
  const missing: string[] = [];
  if (!cleanOptional(config.fulfillmentPolicyId)) missing.push('fulfillment policy');
  if (!cleanOptional(config.paymentPolicyId)) missing.push('payment policy');
  if (!cleanOptional(config.returnPolicyId)) missing.push('return policy');
  return missing;
}

function normalizeOfferLimit(limit: number): number {
  if (!Number.isFinite(limit)) return EBAY_OFFERS_MAX_PAGE_SIZE;
  return Math.max(1, Math.floor(limit));
}

function resolveApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${getApiBaseUrl()}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

async function readErrorPayload(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

async function requestToken(body: URLSearchParams): Promise<EbayTokenResponse> {
  const response = await fetch(`${getApiBaseUrl()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new HttpError(response.status, `eBay token request failed: ${await readErrorPayload(response)}`, {
      service: 'ebay',
      code: 'EBAY_TOKEN_REQUEST_FAILED',
      retryable: response.status >= 500,
    });
  }

  return response.json() as Promise<EbayTokenResponse>;
}

async function getValidUserToken(): Promise<string> {
  if (cachedUserToken && Date.now() < cachedUserToken.expiresAt) {
    return cachedUserToken.accessToken;
  }

  if (pendingUserTokenPromise) {
    return pendingUserTokenPromise;
  }

  const refreshToken = requireSecret('EBAY_REFRESH_TOKEN');
  pendingUserTokenPromise = requestToken(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }))
    .then((token) => {
      cachedUserToken = {
        accessToken: token.access_token,
        expiresAt: Date.now() + Math.max(60, token.expires_in - 60) * 1000,
      };
      return token.access_token;
    })
    .finally(() => {
      pendingUserTokenPromise = null;
    });

  return pendingUserTokenPromise;
}

async function getAppToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt) {
    return cachedAppToken.accessToken;
  }

  if (pendingAppTokenPromise) {
    return pendingAppTokenPromise;
  }

  pendingAppTokenPromise = requestToken(new URLSearchParams({
    grant_type: 'client_credentials',
    scope: getOptionalSecret('EBAY_APP_SCOPE') ?? DEFAULT_EBAY_APP_SCOPE,
  }))
    .then((token) => {
      cachedAppToken = {
        accessToken: token.access_token,
        expiresAt: Date.now() + Math.max(60, token.expires_in - 60) * 1000,
      };
      return token.access_token;
    })
    .finally(() => {
      pendingAppTokenPromise = null;
    });

  return pendingAppTokenPromise;
}

async function ebayJsonRequest<T>(pathOrUrl: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveApiUrl(pathOrUrl), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, `eBay request failed: ${await readErrorPayload(response)}`, {
      service: 'ebay',
      code: 'EBAY_HTTP_ERROR',
      retryable: response.status >= 500,
    });
  }

  return response.json() as Promise<T>;
}

function inventoryJsonHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
  };
}

function mapTreeNodes(nodes: EbayCategoryTreeNodeResponse[] | undefined, inheritedAncestors: string[] = []): EbayCategoryTreeNode[] {
  return (nodes ?? [])
    .map((node) => {
      const id = node.category?.categoryId?.trim() ?? '';
      const name = node.category?.categoryName?.trim() ?? '';
      if (!id || !name) return null;

      const ancestorsFromNode = (node.categoryTreeNodeAncestors ?? [])
        .map((ancestor) => ancestor.categoryName?.trim() ?? '')
        .filter((value) => value.length > 0);
      const ancestors = ancestorsFromNode.length > 0 ? ancestorsFromNode : inheritedAncestors;

      return {
        id,
        name,
        path: [...ancestors, name].filter((value) => value.length > 0).join(' > '),
        level: typeof node.categoryTreeNodeLevel === 'number' ? node.categoryTreeNodeLevel : ancestors.length,
        hasChildren: Boolean(node.childCategoryTreeNodes && node.childCategoryTreeNodes.length > 0) || !node.leafCategoryTreeNode,
      } as EbayCategoryTreeNode;
    })
    .filter((item): item is EbayCategoryTreeNode => item !== null);
}

async function getDefaultCategoryTreeId(marketplaceId: string): Promise<string> {
  const normalizedMarketplace = normalizeMarketplaceId(marketplaceId);
  const cached = treeIdByMarketplace.get(normalizedMarketplace);
  if (cached) return cached;

  const token = await getAppToken();
  const response = await ebayJsonRequest<EbayCategoryTreeResponse>(
    `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(normalizedMarketplace)}`,
    token,
  );

  const treeId = response.categoryTreeId?.trim();
  if (!treeId) {
    throw new HttpError(502, 'No default eBay category tree ID was returned for the selected marketplace.', {
      service: 'ebay',
      code: 'EBAY_CATEGORY_TREE_ID_MISSING',
      retryable: false,
    });
  }

  treeIdByMarketplace.set(normalizedMarketplace, treeId);
  return treeId;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getTradingSiteId(marketplaceId: string): string {
  switch (normalizeMarketplaceId(marketplaceId)) {
    case 'EBAY_CA':
      return '2';
    case 'EBAY_GB':
      return '3';
    case 'EBAY_AU':
      return '15';
    case 'EBAY_FR':
      return '71';
    case 'EBAY_DE':
      return '77';
    case 'EBAY_IT':
      return '101';
    case 'EBAY_US':
    default:
      return '0';
  }
}

function buildPackageTypesRequestBody(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<GeteBayDetailsRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
    '<WarningLevel>High</WarningLevel>',
    '<DetailName>ShippingPackageDetails</DetailName>',
    '</GeteBayDetailsRequest>',
  ].join('');
}

function extractTagValue(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return decodeXmlEntities(match?.[1]?.trim() ?? '');
}

function extractTradingErrors(xmlText: string): string {
  const errorBlocks = xmlText.match(/<Errors>[\s\S]*?<\/Errors>/gi) ?? [];
  return errorBlocks
    .map((block) => {
      const longMessage = extractTagValue(block, 'LongMessage');
      const shortMessage = extractTagValue(block, 'ShortMessage');
      const code = extractTagValue(block, 'ErrorCode');
      const message = longMessage || shortMessage || 'Unknown Trading API error';
      return code ? `${code}: ${message}` : message;
    })
    .filter(Boolean)
    .join(' | ');
}

function extractAck(xmlText: string): string {
  return extractTagValue(xmlText, 'Ack');
}

function buildSampleInventoryItemPayload(): Record<string, unknown> {
  return {
    product: {
      title: 'McIntosh MA8900 Integrated Amplifier — Resolution AV Demo',
      description:
        '<p>The McIntosh MA8900 is a premium 200-watt-per-channel integrated amplifier combining solid-state power with vacuum tube inputs. '
        + 'Features include a built-in DAC supporting PCM up to 32-bit/384kHz and DSD128, MM/MC phono stage, '
        + "and McIntosh's iconic illuminated watt meters. Listed via Resolution AV's inventory management system.</p>",
      imageUrls: [
        'https://images.crutchfieldonline.com/ImageHandler/trim/3000/1950/products/2018/45/793/g793MA8900/0.jpg',
      ],
      aspects: {
        Brand: ['McIntosh'],
        Connectivity: ['Wired'],
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

function buildSampleOfferPayload(
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

function shouldUpdateOfferForPublish(
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

function normalizeSku(bundle: EbayDraftPayloadBundle): string {
  const inventorySku = String(bundle.inventoryItem.sku ?? '').trim();
  const offerSku = String(bundle.offer.sku ?? '').trim();
  const resolvedSku = inventorySku || offerSku;
  if (!resolvedSku) {
    throw new HttpError(400, 'eBay push requires an inventory SKU. Fill eBay Inventory SKU before pushing.', {
      service: 'ebay',
      code: 'EBAY_SKU_REQUIRED',
      retryable: false,
    });
  }
  return resolvedSku;
}

function buildLocationBody(config: EbayLocationConfig): Record<string, unknown> {
  return {
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
}

function buildTradingSamplePayload(
  sku: string,
  locationConfig: EbayLocationConfig,
  policyConfig: EbayBusinessPolicyConfig,
): string {
  const locationLabel =
    [locationConfig.city, locationConfig.stateOrProvince].filter(Boolean).join(', ') || locationConfig.name;

  const sellerProfiles =
    policyConfig.fulfillmentPolicyId && policyConfig.paymentPolicyId && policyConfig.returnPolicyId
      ? [
          '<SellerProfiles>',
          `<SellerShippingProfile><ShippingProfileID>${escapeXml(policyConfig.fulfillmentPolicyId)}</ShippingProfileID></SellerShippingProfile>`,
          `<SellerPaymentProfile><PaymentProfileID>${escapeXml(policyConfig.paymentPolicyId)}</PaymentProfileID></SellerPaymentProfile>`,
          `<SellerReturnProfile><ReturnProfileID>${escapeXml(policyConfig.returnPolicyId)}</ReturnProfileID></SellerReturnProfile>`,
          '</SellerProfiles>',
        ].join('')
      : '';

  return [
    '<Item>',
    `<Title>${escapeXml(`Resolution AV Demo Listing ${new Date().toISOString().slice(0, 10)}`)}</Title>`,
    `<Description>${escapeXml('Resolution AV Trading API sample listing for a McIntosh MA8900 integrated amplifier.')}</Description>`,
    `<SKU>${escapeXml(sku)}</SKU>`,
    '<PrimaryCategory><CategoryID>14990</CategoryID></PrimaryCategory>',
    '<StartPrice currencyID="USD">4999.00</StartPrice>',
    '<CategoryMappingAllowed>true</CategoryMappingAllowed>',
    '<ConditionID>3000</ConditionID>',
    '<Country>US</Country>',
    '<Currency>USD</Currency>',
    '<DispatchTimeMax>3</DispatchTimeMax>',
    '<ListingDuration>GTC</ListingDuration>',
    '<ListingType>FixedPriceItem</ListingType>',
    `<Location>${escapeXml(locationLabel || 'United States')}</Location>`,
    `<PostalCode>${escapeXml(locationConfig.postalCode)}</PostalCode>`,
    '<PictureDetails><PictureURL>https://images.crutchfieldonline.com/ImageHandler/trim/3000/1950/products/2018/45/793/g793MA8900/0.jpg</PictureURL></PictureDetails>',
    '<Quantity>1</Quantity>',
    '<ItemSpecifics>',
    '<NameValueList><Name>Brand</Name><Value>McIntosh</Value></NameValueList>',
    '<NameValueList><Name>Connectivity</Name><Value>Wired</Value></NameValueList>',
    '<NameValueList><Name>Model</Name><Value>MA8900</Value></NameValueList>',
    '<NameValueList><Name>Type</Name><Value>Integrated Amplifier</Value></NameValueList>',
    '</ItemSpecifics>',
    '<ReturnPolicy>',
    '<ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>',
    '<RefundOption>MoneyBack</RefundOption>',
    '<ReturnsWithinOption>Days_30</ReturnsWithinOption>',
    '<ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>',
    '</ReturnPolicy>',
    '<ShippingDetails>',
    '<ShippingType>Flat</ShippingType>',
    '<ShippingServiceOptions>',
    '<ShippingServicePriority>1</ShippingServicePriority>',
    '<ShippingService>ShippingMethodStandard</ShippingService>',
    '<ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost>',
    '</ShippingServiceOptions>',
    '</ShippingDetails>',
    sellerProfiles,
    '</Item>',
  ].join('');
}

function buildVerifyBody(itemPayload: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</VerifyAddFixedPriceItemRequest>`;
}

function buildAddBody(itemPayload: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</AddFixedPriceItemRequest>`;
}

function buildUploadPictureXml(filename: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
    `<PictureName>${escapeXml(filename)}</PictureName>`,
    '<PictureSet>Standard</PictureSet>',
    '</UploadSiteHostedPicturesRequest>',
  ].join('');
}

function validatePublishSetup(publishSetup: EbayPublishSetup, options: { requirePolicies: boolean; context: 'publishing' | 'pushing' }): void {
  const missingLocation = getMissingLocationFields(publishSetup.locationConfig);
  const missingPolicies = getMissingPolicyFields(publishSetup.policyConfig);

  if (missingLocation.length > 0) {
    const prefix = options.context === 'publishing'
      ? 'Before publishing, add eBay inventory location setup'
      : 'Before pushing to eBay, add inventory location setup';
    throw new HttpError(400, `${prefix}: ${missingLocation.join(', ')}.`, {
      service: 'ebay',
      code: 'EBAY_LOCATION_CONFIG_REQUIRED',
      retryable: false,
    });
  }

  if (options.requirePolicies && missingPolicies.length > 0) {
    const prefix = options.context === 'publishing'
      ? 'Before publishing, add eBay business policy IDs'
      : 'Before pushing to eBay, add business policy IDs';
    throw new HttpError(400, `${prefix}: ${missingPolicies.join(', ')}.`, {
      service: 'ebay',
      code: 'EBAY_POLICY_CONFIG_REQUIRED',
      retryable: false,
    });
  }
}

function isExistingWarehouseLocationError(errorBody: unknown): boolean {
  if (!errorBody || typeof errorBody !== 'object') return false;
  const errors = (errorBody as { errors?: Array<{ errorId?: number; message?: string }> }).errors;
  return Array.isArray(errors) && errors.some((error) => {
    const message = (error.message || '').toLowerCase();
    return error.errorId === 25803 || message.includes('merchantlocationkey already exists');
  });
}

function isOfferTemporarilyUnavailable(errorBody: unknown): boolean {
  if (!errorBody || typeof errorBody !== 'object') return false;
  const errors = (errorBody as { errors?: Array<{ errorId?: number; message?: string }> }).errors;
  return Array.isArray(errors) && errors.some((error) => {
    const message = (error.message || '').toLowerCase();
    return error.errorId === 25713 || message.includes('offer is not available');
  });
}

function isInventoryUpsertTemporarilyUnavailable(errorBody: unknown): boolean {
  if (!errorBody || typeof errorBody !== 'object') return false;
  const errors = (errorBody as { errors?: Array<{ errorId?: number; message?: string }> }).errors;
  return Array.isArray(errors) && errors.some((error) => {
    const message = (error.message || '').toLowerCase();
    return error.errorId === 25604 || message.includes('product not found. please try again');
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function callTradingApi(token: string, callName: string, body: BodyInit, siteId = '0'): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1231',
      'X-EBAY-API-SITEID': siteId,
      'X-EBAY-API-IAF-TOKEN': token,
    },
    body,
  });

  const text = await response.text();
  const ack = extractAck(text);
  if (!response.ok || (ack && ack !== 'Success' && ack !== 'Warning')) {
    const message = extractTradingErrors(text) || text.slice(0, 400);
    throw new HttpError(response.status || 502, `${callName} ${response.status}: ${message}`, {
      service: 'ebay',
      code: 'EBAY_TRADING_API_FAILED',
      retryable: response.status >= 500,
    });
  }

  return text;
}

function toHumanLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPackageTypes(xmlText: string): string[] {
  const detailBlocks = xmlText.match(/<ShippingPackageDetails>[\s\S]*?<\/ShippingPackageDetails>/gi) ?? [];
  const fetchedValues = detailBlocks
    .map((block) => extractTagValue(block, 'Description') || toHumanLabel(extractTagValue(block, 'ShippingPackage')))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...FALLBACK_PACKAGE_TYPES, ...fetchedValues])).sort((left, right) => left.localeCompare(right));
}

async function getOffersPageWithToken(
  token: string,
  sku: string | undefined,
  limit: number,
  nextHref?: string,
): Promise<EbayOfferPage & { next?: string }> {
  let requestPath: string;
  if (nextHref) {
    requestPath = resolveApiUrl(nextHref);
  } else {
    const params = new URLSearchParams({
      limit: String(Math.min(EBAY_OFFERS_MAX_PAGE_SIZE, normalizeOfferLimit(limit))),
    });
    if (sku) params.set('sku', sku);
    requestPath = `/sell/inventory/v1/offer?${params.toString()}`;
  }

  try {
    const response = await ebayJsonRequest<{ offers?: EbayOffer[]; total?: number; next?: string }>(requestPath, token);
    return {
      offers: response.offers ?? [],
      total: response.total ?? 0,
      next: response.next,
    };
  } catch (error) {
    if (sku && error instanceof HttpError) {
      const message = error.message.toLowerCase();
      if (message.includes('25713') || message.includes('offer is not available')) {
        return {
          offers: [],
          total: 0,
        };
      }
    }

    throw error;
  }
}

export async function getInventoryItems(limit = 25): Promise<EbayInventoryPage> {
  const token = await getValidUserToken();
  const response = await ebayJsonRequest<{
    inventoryItems?: EbayInventoryItem[];
    total?: number;
    href?: string;
    next?: string;
  }>(`/sell/inventory/v1/inventory_item?limit=${encodeURIComponent(String(limit))}`, token);

  return {
    inventoryItems: response.inventoryItems ?? [],
    total: response.total ?? 0,
    href: response.href,
    next: response.next,
  };
}

export async function getOffers(sku?: string, limit = 25): Promise<EbayOfferPage> {
  const token = await getValidUserToken();
  return getOffersWithToken(token, sku, limit);
}

export async function getOffersWithToken(token: string, sku?: string, limit = 25): Promise<EbayOfferPage> {
  const requestedLimit = normalizeOfferLimit(limit);
  const offers: EbayOffer[] = [];
  let total = 0;
  let nextHref: string | undefined;

  while (offers.length < requestedLimit) {
    const remaining = requestedLimit - offers.length;
    const pageLimit = Math.min(remaining, EBAY_OFFERS_MAX_PAGE_SIZE);
    const page = await getOffersPageWithToken(token, sku, pageLimit, nextHref);

    total = page.total;
    if (page.offers.length === 0) break;

    offers.push(...page.offers);
    nextHref = page.next;

    if (page.offers.length < pageLimit && !nextHref) break;
    if (!nextHref) break;
    if (total > 0 && offers.length >= total) break;
  }

  return {
    offers: offers.slice(0, requestedLimit),
    total: total || offers.length,
  };
}

export async function getOffer(offerId: string): Promise<EbayOfferDetails> {
  const token = await getValidUserToken();
  return ebayJsonRequest<EbayOfferDetails>(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, token);
}

export async function getOffersForInventorySkus(skus: string[]): Promise<EbayOfferPage> {
  const validSkus = [...new Set(skus.map((sku) => sku.trim()).filter(Boolean))];
  if (validSkus.length === 0) return { offers: [], total: 0 };

  const token = await getValidUserToken();
  const results = await Promise.allSettled(validSkus.map((sku) => getOffersWithToken(token, sku, 1)));
  const offers: EbayOffer[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const offer of result.value.offers) {
      if (!offers.some((existing) => existing.offerId === offer.offerId || existing.sku === offer.sku)) {
        offers.push(offer);
      }
    }
  }

  return { offers, total: offers.length };
}

function statusRank(status?: EbayOffer['status']): number {
  if (status === 'UNPUBLISHED') return 0;
  if (status === 'PUBLISHED') return 1;
  return 2;
}

function offerRecencyRank(offer: EbayOffer): number {
  const numericId = Number(offer.listingId ?? offer.offerId ?? 0);
  return Number.isFinite(numericId) ? numericId : 0;
}

function buildPublishedListings(items: EbayInventoryItem[], offers: EbayOffer[]): EbayPublishedListing[] {
  const itemBySku = new Map(items.map((item) => [item.sku, item]));

  return offers
    .filter((offer) => offer.status === 'PUBLISHED')
    .map((offer) => {
      const item = itemBySku.get(offer.sku);
      return item ? { item, offer } : null;
    })
    .filter((listing): listing is EbayPublishedListing => listing !== null)
    .sort((left, right) => offerRecencyRank(right.offer) - offerRecencyRank(left.offer))
    .slice(0, MAX_VISIBLE_LISTINGS);
}

function buildVisibleInventoryItems(items: EbayInventoryItem[], offers: EbayOffer[]): EbayInventoryItem[] {
  const offerBySku = new Map(offers.map((offer) => [offer.sku, offer]));

  return [...items]
    .sort((left, right) => statusRank(offerBySku.get(left.sku)?.status) - statusRank(offerBySku.get(right.sku)?.status))
    .filter((item) => isValidEbaySku(item.sku));
}

export async function getDashboardSnapshot(): Promise<EbayDashboardSnapshot> {
  const itemsPage = await getInventoryItems(100);
  const offersPage = await getOffersForInventorySkus(itemsPage.inventoryItems.map((item) => item.sku));
  const visibleItems = buildVisibleInventoryItems(itemsPage.inventoryItems, offersPage.offers);

  return {
    inventoryItems: visibleItems.slice(0, MAX_VISIBLE_LISTINGS),
    offers: offersPage.offers,
    recentListings: buildPublishedListings(visibleItems, offersPage.offers),
    total: visibleItems.length,
    warning: null,
    runtimeConfig: getRuntimeConfig(),
  };
}

export async function searchEbayCategorySuggestions(
  query: string,
  marketplaceId = 'EBAY_US',
): Promise<EbayCategorySuggestion[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const token = await getAppToken();
  const treeId = await getDefaultCategoryTreeId(marketplaceId);
  const response = await ebayJsonRequest<EbayCategorySuggestionsResponse>(
    `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_category_suggestions?q=${encodeURIComponent(normalizedQuery)}`,
    token,
  );

  return (response.categorySuggestions ?? [])
    .map((node) => {
      const id = node.category?.categoryId?.trim() ?? '';
      const name = node.category?.categoryName?.trim() ?? '';
      if (!id || !name) return null;

      const ancestors = (node.categoryTreeNodeAncestors ?? [])
        .map((ancestor) => ancestor.categoryName?.trim() ?? '')
        .filter((value) => value.length > 0);

      return {
        id,
        name,
        path: [...ancestors, name].join(' > '),
        level: typeof node.categoryTreeNodeLevel === 'number' ? node.categoryTreeNodeLevel : 0,
      } as EbayCategorySuggestion;
    })
    .filter((item): item is EbayCategorySuggestion => item !== null);
}

export async function getEbayRootCategories(marketplaceId = 'EBAY_US'): Promise<EbayCategoryTreeNode[]> {
  const normalizedMarketplace = normalizeMarketplaceId(marketplaceId);
  const cached = rootNodesByMarketplace.get(normalizedMarketplace);
  if (cached) return cached;

  const token = await getAppToken();
  const treeId = await getDefaultCategoryTreeId(normalizedMarketplace);
  const response = await ebayJsonRequest<EbayCategoryTreeFullResponse>(
    `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}`,
    token,
  );
  const roots = mapTreeNodes(response.rootCategoryNode?.childCategoryTreeNodes);
  rootNodesByMarketplace.set(normalizedMarketplace, roots);
  return roots;
}

export async function getEbayChildCategories(parentCategoryId: string, marketplaceId = 'EBAY_US'): Promise<EbayCategoryTreeNode[]> {
  const normalizedMarketplace = normalizeMarketplaceId(marketplaceId);
  const normalizedParentId = parentCategoryId.trim();
  if (!normalizedParentId) return [];

  const cacheKey = `${normalizedMarketplace}:${normalizedParentId}`;
  const cached = childNodesByMarketplaceAndParent.get(cacheKey);
  if (cached) return cached;

  const token = await getAppToken();
  const treeId = await getDefaultCategoryTreeId(normalizedMarketplace);
  const response = await ebayJsonRequest<EbayCategorySubtreeResponse>(
    `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_category_subtree?category_id=${encodeURIComponent(normalizedParentId)}`,
    token,
  );

  const parentNode = response.categorySubtreeNode;
  const parentName = parentNode?.category?.categoryName?.trim() ?? '';
  const children = mapTreeNodes(parentNode?.childCategoryTreeNodes, parentName ? [parentName] : []);
  childNodesByMarketplaceAndParent.set(cacheKey, children);
  return children;
}

export async function getEbayPackageTypes(marketplaceId = 'EBAY_US'): Promise<string[]> {
  const normalizedMarketplace = normalizeMarketplaceId(marketplaceId);
  const cached = packageTypesByMarketplace.get(normalizedMarketplace);
  if (cached) return cached;

  try {
    const token = await getValidUserToken();
    const response = await fetch(`${getApiBaseUrl()}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-CALL-NAME': 'GeteBayDetails',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1231',
        'X-EBAY-API-SITEID': getTradingSiteId(normalizedMarketplace),
        'X-EBAY-API-IAF-TOKEN': token,
      },
      body: buildPackageTypesRequestBody(),
    });

    if (!response.ok) {
      throw new HttpError(response.status, `eBay package type request failed: ${await readErrorPayload(response)}`, {
        service: 'ebay',
        code: 'EBAY_PACKAGE_TYPES_FAILED',
        retryable: response.status >= 500,
      });
    }

    const values = extractPackageTypes(await response.text());
    packageTypesByMarketplace.set(normalizedMarketplace, values);
    return values;
  } catch {
    const fallbackValues = [...FALLBACK_PACKAGE_TYPES];
    packageTypesByMarketplace.set(normalizedMarketplace, fallbackValues);
    return fallbackValues;
  }
}

async function upsertWarehouseLocation(token: string, config: EbayLocationConfig): Promise<void> {
  const missing = getMissingLocationFields(config);
  if (missing.length > 0) {
    throw new HttpError(400, `Missing eBay inventory location setup: ${missing.join(', ')}.`, {
      service: 'ebay',
      code: 'EBAY_LOCATION_CONFIG_REQUIRED',
      retryable: false,
    });
  }

  const response = await fetch(`${getApiBaseUrl()}/sell/inventory/v1/location/${encodeURIComponent(config.key)}`, {
    method: 'POST',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify(buildLocationBody(config)),
  });

  const errorText = await response.text();
  let errorBody: unknown = {};
  try {
    errorBody = errorText ? JSON.parse(errorText) : {};
  } catch {
    errorBody = {};
  }

  if (response.ok || response.status === 204 || response.status === 409 || isExistingWarehouseLocationError(errorBody)) {
    return;
  }

  throw new HttpError(response.status, `createInventoryLocation ${response.status}: ${errorText || '{}'}`, {
    service: 'ebay',
    code: 'EBAY_LOCATION_UPSERT_FAILED',
    retryable: response.status >= 500,
  });
}

async function upsertSampleInventoryItem(token: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${getApiBaseUrl()}/sell/inventory/v1/inventory_item/${encodeURIComponent(SAMPLE_SKU)}`, {
      method: 'PUT',
      headers: inventoryJsonHeaders(token),
      body: JSON.stringify(buildSampleInventoryItemPayload()),
    });

    if (response.ok) {
      return;
    }

    const errorText = await response.text();
    let errorBody: unknown = {};
    try {
      errorBody = errorText ? JSON.parse(errorText) : {};
    } catch {
      errorBody = {};
    }

    if (attempt < 2 && isInventoryUpsertTemporarilyUnavailable(errorBody)) {
      await delay(1500 * (attempt + 1));
      continue;
    }

    throw new HttpError(response.status, `createInventoryItem ${response.status}: ${errorText || '{}'}`, {
      service: 'ebay',
      code: 'EBAY_UPSERT_INVENTORY_FAILED',
      retryable: response.status >= 500,
    });
  }
}

async function createOrUpdateSampleOffer(
  token: string,
  publishSetup: EbayPublishSetup,
  offerId?: string,
): Promise<{ sku: string; offerId: string }> {
  const missingLocation = getMissingLocationFields(publishSetup.locationConfig);
  const missingPolicies = getMissingPolicyFields(publishSetup.policyConfig);
  const hasLocationConfig = missingLocation.length === 0;
  const hasPolicyConfig = missingPolicies.length === 0;

  if (hasLocationConfig) {
    await upsertWarehouseLocation(token, publishSetup.locationConfig);
  }

  const payload = buildSampleOfferPayload(
    hasLocationConfig ? publishSetup.locationConfig : null,
    hasPolicyConfig ? publishSetup.policyConfig : null,
  );

  if (!offerId) {
    const createResponse = await fetch(`${getApiBaseUrl()}/sell/inventory/v1/offer`, {
      method: 'POST',
      headers: inventoryJsonHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      let errorBody: { errors?: Array<{ errorId?: number }> } = {};
      try {
        errorBody = errorText ? JSON.parse(errorText) as { errors?: Array<{ errorId?: number }> } : {};
      } catch {
        errorBody = {};
      }

      if (createResponse.status === 409 || errorBody.errors?.some((error) => error.errorId === 25002)) {
        const existing = await getOffersWithToken(token, SAMPLE_SKU, 1);
        if (existing.offers.length > 0) {
          return createOrUpdateSampleOffer(token, publishSetup, existing.offers[0].offerId);
        }
      }

      throw new HttpError(createResponse.status, `createOffer ${createResponse.status}: ${errorText || '{}'}`, {
        service: 'ebay',
        code: 'EBAY_CREATE_OFFER_FAILED',
        retryable: createResponse.status >= 500,
      });
    }

    const offerData = await createResponse.json() as { offerId?: string };
    return { sku: SAMPLE_SKU, offerId: offerData.offerId ?? '' };
  }

  const updateResponse = await fetch(`${getApiBaseUrl()}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    method: 'PUT',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!updateResponse.ok) {
    throw new HttpError(updateResponse.status, `updateOffer ${updateResponse.status}: ${await readErrorPayload(updateResponse)}`, {
      service: 'ebay',
      code: 'EBAY_UPDATE_OFFER_FAILED',
      retryable: updateResponse.status >= 500,
    });
  }

  return { sku: SAMPLE_SKU, offerId };
}

async function publishOfferById(token: string, offerId: string): Promise<{ listingId: string }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${getApiBaseUrl()}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'en-US',
      },
    });

    const responseText = await response.text();
    let publishData: { listingId?: string; errors?: Array<{ errorId?: number; message?: string; parameters?: Array<{ value?: string }> }> } = {};
    try {
      publishData = responseText ? JSON.parse(responseText) as typeof publishData : {};
    } catch {
      publishData = {};
    }

    if (!response.ok) {
      if (attempt < 2 && isOfferTemporarilyUnavailable(publishData)) {
        await delay(1500 * (attempt + 1));
        continue;
      }

      const firstError = publishData.errors?.[0];
      const parameterValues = firstError?.parameters?.map((parameter) => parameter.value).filter(Boolean).join(', ');
      const suffix = parameterValues ? ` (${parameterValues})` : '';
      throw new HttpError(response.status, `publishOffer ${response.status}: ${firstError?.message ?? (responseText || '{}')}${suffix}`, {
        service: 'ebay',
        code: 'EBAY_PUBLISH_OFFER_FAILED',
        retryable: response.status >= 500,
      });
    }

    if (!publishData.listingId) {
      throw new HttpError(502, 'publishOffer succeeded but eBay did not return a listingId.', {
        service: 'ebay',
        code: 'EBAY_PUBLISH_LISTING_ID_MISSING',
        retryable: false,
      });
    }

    return { listingId: publishData.listingId };
  }

  throw new HttpError(502, 'publishOffer failed after retrying temporary eBay availability errors.', {
    service: 'ebay',
    code: 'EBAY_PUBLISH_OFFER_RETRY_EXHAUSTED',
    retryable: false,
  });
}

async function upsertInventoryItem(token: string, sku: string, inventoryItem: Record<string, unknown>): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${getApiBaseUrl()}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      method: 'PUT',
      headers: inventoryJsonHeaders(token),
      body: JSON.stringify({
        ...inventoryItem,
        sku,
      }),
    });

    if (response.ok) {
      return;
    }

    const errorText = await response.text();
    let errorBody: unknown = {};
    try {
      errorBody = errorText ? JSON.parse(errorText) : {};
    } catch {
      errorBody = {};
    }

    if (attempt < 2 && isInventoryUpsertTemporarilyUnavailable(errorBody)) {
      await delay(1500 * (attempt + 1));
      continue;
    }

    throw new HttpError(response.status, `createInventoryItem ${response.status}: ${errorText || '{}'}`, {
      service: 'ebay',
      code: 'EBAY_UPSERT_INVENTORY_FAILED',
      retryable: response.status >= 500,
    });
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
    const updateResponse = await fetch(`${getApiBaseUrl()}/sell/inventory/v1/offer/${encodeURIComponent(existingOfferId)}`, {
      method: 'PUT',
      headers: inventoryJsonHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!updateResponse.ok) {
      throw new HttpError(updateResponse.status, `updateOffer ${updateResponse.status}: ${await readErrorPayload(updateResponse)}`, {
        service: 'ebay',
        code: 'EBAY_UPDATE_OFFER_FAILED',
        retryable: updateResponse.status >= 500,
      });
    }

    return { offerId: existingOfferId, wasExistingOffer: true };
  }

  const createResponse = await fetch(`${getApiBaseUrl()}/sell/inventory/v1/offer`, {
    method: 'POST',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!createResponse.ok) {
    throw new HttpError(createResponse.status, `createOffer ${createResponse.status}: ${await readErrorPayload(createResponse)}`, {
      service: 'ebay',
      code: 'EBAY_CREATE_OFFER_FAILED',
      retryable: createResponse.status >= 500,
    });
  }

  const created = await createResponse.json() as { offerId?: string };
  if (!created.offerId) {
    throw new HttpError(502, 'createOffer succeeded but eBay did not return an offerId.', {
      service: 'ebay',
      code: 'EBAY_CREATE_OFFER_ID_MISSING',
      retryable: false,
    });
  }

  return { offerId: created.offerId, wasExistingOffer: false };
}

export async function createSampleListing(
  mode: 'inventory' | 'trading' | 'trading-verify',
  publishSetup?: EbayPublishSetup,
): Promise<EbaySampleListingResult> {
  const resolvedPublishSetup = publishSetup ?? getDefaultPublishSetup();

  if (mode === 'trading' || mode === 'trading-verify') {
    validatePublishSetup(resolvedPublishSetup, { requirePolicies: false, context: 'publishing' });

    if (!resolvedPublishSetup.locationConfig.postalCode.trim()) {
      throw new HttpError(400, 'Trading API listing requires a postal code in the eBay publish setup.', {
        service: 'ebay',
        code: 'EBAY_TRADING_POSTAL_CODE_REQUIRED',
        retryable: false,
      });
    }

    const token = await getValidUserToken();
    const sku = `RAVTRADING${Date.now()}`;
  const itemPayload = buildTradingSamplePayload(sku, resolvedPublishSetup.locationConfig, resolvedPublishSetup.policyConfig);
    await callTradingApi(token, 'VerifyAddFixedPriceItem', buildVerifyBody(itemPayload), getTradingSiteId('EBAY_US'));

    if (mode === 'trading-verify') {
      return { mode, sku, status: 'VERIFIED' };
    }

    const addText = await callTradingApi(token, 'AddFixedPriceItem', buildAddBody(itemPayload), getTradingSiteId('EBAY_US'));
    const listingId = extractTagValue(addText, 'ItemID');
    if (!listingId) {
      throw new HttpError(502, 'AddFixedPriceItem succeeded but eBay did not return an ItemID.', {
        service: 'ebay',
        code: 'EBAY_TRADING_ITEM_ID_MISSING',
        retryable: false,
      });
    }

    return { mode: 'trading', sku, listingId, status: 'ACTIVE' };
  }

  const token = await getValidUserToken();
  await upsertSampleInventoryItem(token);
  const existing = await getOffersWithToken(token, SAMPLE_SKU, 1);
  const result = await createOrUpdateSampleOffer(token, resolvedPublishSetup, existing.offers[0]?.offerId);
  return { mode: 'inventory', sku: result.sku, offerId: result.offerId, status: 'UNPUBLISHED' };
}

export async function publishSampleDraftListing(
  publishSetup?: EbayPublishSetup,
): Promise<{ sku: string; offerId: string; listingId: string }> {
  const resolvedPublishSetup = publishSetup ?? getDefaultPublishSetup();
  validatePublishSetup(resolvedPublishSetup, { requirePolicies: true, context: 'publishing' });

  const token = await getValidUserToken();
  await upsertSampleInventoryItem(token);
  const existing = await getOffersWithToken(token, SAMPLE_SKU, 1);
  const { offerId, sku } = await createOrUpdateSampleOffer(token, resolvedPublishSetup, existing.offers[0]?.offerId);
  const details = await getOffer(offerId);

  if (shouldUpdateOfferForPublish(details, resolvedPublishSetup.locationConfig, resolvedPublishSetup.policyConfig)) {
    await createOrUpdateSampleOffer(token, resolvedPublishSetup, offerId);
  }

  const { listingId } = await publishOfferById(token, offerId);
  return { sku, offerId, listingId };
}

export async function pushApprovalBundleToEbay(
  bundle: EbayDraftPayloadBundle,
  publishSetup?: EbayPublishSetup,
): Promise<EbayApprovalPushResult> {
  const resolvedPublishSetup = publishSetup ?? getDefaultPublishSetup();
  validatePublishSetup(resolvedPublishSetup, { requirePolicies: true, context: 'pushing' });

  const token = await getValidUserToken();
  const sku = normalizeSku(bundle);
  await upsertWarehouseLocation(token, resolvedPublishSetup.locationConfig);
  await upsertInventoryItem(token, sku, bundle.inventoryItem);

  const existingOffers = await getOffersWithToken(token, sku, 1);
  const existingOffer = existingOffers.offers[0];
  const offerPayload: Record<string, unknown> = {
    ...bundle.offer,
    sku,
    marketplaceId: String(bundle.offer.marketplaceId ?? 'EBAY_US').trim().toUpperCase() || 'EBAY_US',
    merchantLocationKey: resolvedPublishSetup.locationConfig.key,
    listingPolicies: {
      fulfillmentPolicyId: resolvedPublishSetup.policyConfig.fulfillmentPolicyId,
      paymentPolicyId: resolvedPublishSetup.policyConfig.paymentPolicyId,
      returnPolicyId: resolvedPublishSetup.policyConfig.returnPolicyId,
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

export async function uploadImageToEbayHostedPictures(
  filename: string,
  mimeType: string,
  file: string,
): Promise<EbayUploadedImageResult> {
  const normalizedName = filename.trim();
  const normalizedMimeType = mimeType.trim() || 'image/jpeg';
  const normalizedFile = file.trim();

  if (!normalizedName || !normalizedFile) {
    throw new HttpError(400, 'filename and file are required', {
      service: 'ebay',
      code: 'INVALID_IMAGE_UPLOAD_PAYLOAD',
      retryable: false,
    });
  }

  const token = await getValidUserToken();
  const formData = new FormData();
  formData.append('XML Payload', buildUploadPictureXml(normalizedName));
  formData.append('image', new Blob([Buffer.from(normalizedFile, 'base64')], { type: normalizedMimeType }), normalizedName);

  const responseText = await callTradingApi(token, 'UploadSiteHostedPictures', formData, '0');
  const url = extractTagValue(responseText, 'FullURL') || extractTagValue(responseText, 'PictureURL');
  if (!url) {
    throw new HttpError(502, 'eBay uploaded the image but did not return a hosted picture URL.', {
      service: 'ebay',
      code: 'EBAY_HOSTED_PICTURE_URL_MISSING',
      retryable: false,
    });
  }

  return { url };
}