/**
 * eBay Sandbox API Service
 *
 * Auth flow:
 *  1. App Token  — Client Credentials grant (no user needed). Used to verify
 *                  connectivity and read public data.
 *  2. User Token — Authorization Code grant (requires OAuth redirect).
 *                  Required for seller operations: view inventory, create listings.
 *
 * All requests are proxied through Vite (/ebay-api-proxy → api.sandbox.ebay.com)
 * to avoid CORS issues during development.
 *
 * ⚠️  Credentials are exposed in the client bundle. This is a dev dashboard —
 *     do not deploy publicly without moving secrets server-side.
 */

const IS_SANDBOX =
  (import.meta.env.VITE_EBAY_ENV as string | undefined)?.toLowerCase() !== 'production';

const CLIENT_ID     = (import.meta.env.VITE_EBAY_CLIENT_ID     as string | undefined) ?? '';
const CLIENT_SECRET = (import.meta.env.VITE_EBAY_CLIENT_SECRET as string | undefined) ?? '';
// RuName can be overridden at runtime via localStorage (set in the connect UI)
const ENV_RU_NAME      = (import.meta.env.VITE_EBAY_RU_NAME       as string | undefined) ?? '';
const ENV_REFRESH_TOKEN = (import.meta.env.VITE_EBAY_REFRESH_TOKEN as string | undefined) ?? '';
const ENV_SELLER_USERNAME = (import.meta.env.VITE_EBAY_SELLER_USERNAME as string | undefined) ?? '';
const ENV_LOCATION_KEY = (import.meta.env.VITE_EBAY_LOCATION_KEY as string | undefined) ?? '';
const ENV_LOCATION_NAME = (import.meta.env.VITE_EBAY_LOCATION_NAME as string | undefined) ?? '';
const ENV_LOCATION_COUNTRY = (import.meta.env.VITE_EBAY_LOCATION_COUNTRY as string | undefined) ?? '';
const ENV_LOCATION_POSTAL_CODE = (import.meta.env.VITE_EBAY_LOCATION_POSTAL_CODE as string | undefined) ?? '';
const ENV_LOCATION_CITY = (import.meta.env.VITE_EBAY_LOCATION_CITY as string | undefined) ?? '';
const ENV_LOCATION_STATE = (import.meta.env.VITE_EBAY_LOCATION_STATE as string | undefined) ?? '';
const ENV_FULFILLMENT_POLICY_ID = (import.meta.env.VITE_EBAY_FULFILLMENT_POLICY_ID as string | undefined) ?? '';
const ENV_PAYMENT_POLICY_ID = (import.meta.env.VITE_EBAY_PAYMENT_POLICY_ID as string | undefined) ?? '';
const ENV_RETURN_POLICY_ID = (import.meta.env.VITE_EBAY_RETURN_POLICY_ID as string | undefined) ?? '';
const RAW_ENV_LISTING_API_MODE = ((import.meta.env.VITE_EBAY_LISTING_API as string | undefined) ?? 'inventory').toLowerCase();
const ENV_LISTING_API_MODE = RAW_ENV_LISTING_API_MODE === 'trading' || RAW_ENV_LISTING_API_MODE === 'trading-verify'
  ? RAW_ENV_LISTING_API_MODE
  : 'inventory';

function normalizeToken(token: string): string {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

const normalizedEnvRefreshToken = ENV_REFRESH_TOKEN ? normalizeToken(ENV_REFRESH_TOKEN) : '';

/** Get the active RuName — localStorage value wins over env var. */
export function getRuName(): string {
  return localStorage.getItem('ebay_ru_name') || ENV_RU_NAME;
}

/** Persist a RuName entered by the user at runtime. */
export function saveRuName(ruName: string): void {
  localStorage.setItem('ebay_ru_name', ruName.trim());
}

export function getSellerUsername(): string {
  return localStorage.getItem('ebay_seller_username') || ENV_SELLER_USERNAME;
}

export function saveSellerUsername(username: string): void {
  localStorage.setItem('ebay_seller_username', username.trim());
}

function parseStoredJson<T>(key: string): Partial<T> {
  const raw = localStorage.getItem(key);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return {};
  }
}

function cleanOptional(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function getInventoryLocationConfig(): EbayLocationConfig {
  const stored = parseStoredJson<EbayLocationConfig>(LS_LOCATION_CONFIG);

  return {
    key: cleanOptional(stored.key) || cleanOptional(ENV_LOCATION_KEY) || 'resolution-av-warehouse',
    name: cleanOptional(stored.name) || cleanOptional(ENV_LOCATION_NAME) || 'Resolution AV Warehouse',
    country: (cleanOptional(stored.country) || cleanOptional(ENV_LOCATION_COUNTRY) || 'US').toUpperCase(),
    postalCode: cleanOptional(stored.postalCode) || cleanOptional(ENV_LOCATION_POSTAL_CODE),
    city: cleanOptional(stored.city) || cleanOptional(ENV_LOCATION_CITY),
    stateOrProvince: cleanOptional(stored.stateOrProvince) || cleanOptional(ENV_LOCATION_STATE),
  };
}

export function saveInventoryLocationConfig(config: EbayLocationConfig): void {
  localStorage.setItem(LS_LOCATION_CONFIG, JSON.stringify({
    key: cleanOptional(config.key),
    name: cleanOptional(config.name),
    country: cleanOptional(config.country).toUpperCase(),
    postalCode: cleanOptional(config.postalCode),
    city: cleanOptional(config.city),
    stateOrProvince: cleanOptional(config.stateOrProvince),
  }));
}

export function getBusinessPolicyConfig(): EbayBusinessPolicyConfig {
  const stored = parseStoredJson<EbayBusinessPolicyConfig>(LS_POLICY_CONFIG);

  return {
    fulfillmentPolicyId: cleanOptional(stored.fulfillmentPolicyId) || cleanOptional(ENV_FULFILLMENT_POLICY_ID),
    paymentPolicyId: cleanOptional(stored.paymentPolicyId) || cleanOptional(ENV_PAYMENT_POLICY_ID),
    returnPolicyId: cleanOptional(stored.returnPolicyId) || cleanOptional(ENV_RETURN_POLICY_ID),
  };
}

export function saveBusinessPolicyConfig(config: EbayBusinessPolicyConfig): void {
  localStorage.setItem(LS_POLICY_CONFIG, JSON.stringify({
    fulfillmentPolicyId: cleanOptional(config.fulfillmentPolicyId),
    paymentPolicyId: cleanOptional(config.paymentPolicyId),
    returnPolicyId: cleanOptional(config.returnPolicyId),
  }));
}

export function getMissingLocationFields(config: EbayLocationConfig): string[] {
  const missing = [] as string[];

  if (!cleanOptional(config.key)) missing.push('location key');
  if (!cleanOptional(config.country)) missing.push('country');

  const hasPostal = Boolean(cleanOptional(config.postalCode));
  const hasCityState = Boolean(cleanOptional(config.city) && cleanOptional(config.stateOrProvince));
  if (!hasPostal && !hasCityState) {
    missing.push('postal code or city/state');
  }

  return missing;
}

export function getMissingPolicyFields(config: EbayBusinessPolicyConfig): string[] {
  const missing = [] as string[];

  if (!cleanOptional(config.fulfillmentPolicyId)) missing.push('fulfillment policy');
  if (!cleanOptional(config.paymentPolicyId)) missing.push('payment policy');
  if (!cleanOptional(config.returnPolicyId)) missing.push('return policy');

  return missing;
}

const EBAY_AUTH_HOST = IS_SANDBOX
  ? 'https://auth.sandbox.ebay.com'
  : 'https://auth.ebay.com';

// All API calls go via Vite proxy (points at api.sandbox.ebay.com or api.ebay.com)
const API = '/ebay-api-proxy';

// OAuth scopes required for seller operations
// Only request scopes that are actually approved in the production app.
// sell.account / sell.fulfillment require separate approval — omitting them
// avoids the "invalid_request" error from eBay's OAuth authorize endpoint.
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
].join(' ');

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_ACCESS  = 'ebay_access_token';
const LS_REFRESH = 'ebay_refresh_token';
const LS_EXPIRY  = 'ebay_token_expires';
const LS_LOCATION_CONFIG = 'ebay_location_config';
const LS_POLICY_CONFIG = 'ebay_policy_config';
const LS_LISTING_API_MODE = 'ebay_listing_api_mode';
let pendingUserTokenPromise: Promise<string> | null = null;

if (
  normalizedEnvRefreshToken &&
  localStorage.getItem(LS_REFRESH) !== normalizedEnvRefreshToken
) {
  localStorage.setItem(LS_REFRESH, normalizedEnvRefreshToken);
}

function getStoredRefreshToken(): string | null {
  const storedRefreshToken = localStorage.getItem(LS_REFRESH);
  if (storedRefreshToken) return normalizeToken(storedRefreshToken);

  if (normalizedEnvRefreshToken) {
    return normalizedEnvRefreshToken;
  }

  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Token storage helpers ─────────────────────────────────────────────────────

export function saveUserToken(token: EbayTokenResponse): void {
  localStorage.setItem(LS_ACCESS, token.access_token);
  localStorage.setItem(LS_EXPIRY, String(Date.now() + token.expires_in * 1000 - 60_000));
  if (token.refresh_token) localStorage.setItem(LS_REFRESH, normalizeToken(token.refresh_token));
}

export function getStoredUserToken(): { accessToken: string; expiresAt: number } | null {
  const t = localStorage.getItem(LS_ACCESS);
  const e = localStorage.getItem(LS_EXPIRY);
  if (!t || !e) return null;
  return { accessToken: t, expiresAt: Number(e) };
}

export function clearUserToken(): void {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_EXPIRY);
}

export function getPreferredListingApiMode(): EbayListingApiMode {
  const stored = localStorage.getItem(LS_LISTING_API_MODE);
  if (stored === 'inventory' || stored === 'trading' || stored === 'trading-verify') return stored;
  return ENV_LISTING_API_MODE;
}

export function savePreferredListingApiMode(mode: EbayListingApiMode): void {
  localStorage.setItem(LS_LISTING_API_MODE, mode);
}

export function isTokenValid(): boolean {
  const stored = getStoredUserToken();
  if (!stored) return false;
  return Date.now() < stored.expiresAt;
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

/** Build the authorization URL the user needs to visit to grant access. */
export function buildAuthUrl(ruName?: string): string {
  const rn = ruName ?? getRuName();
  // Build manually to ensure spaces in scope are encoded as %20, not +.
  // URLSearchParams.toString() uses + for spaces, which eBay's OAuth server rejects.
  const base = `${EBAY_AUTH_HOST}/oauth2/authorize`;
  const query = [
    `client_id=${encodeURIComponent(CLIENT_ID)}`,
    `redirect_uri=${encodeURIComponent(rn)}`,
    `response_type=code`,
    `scope=${encodeURIComponent(SCOPES)}`,
    `state=ebay_oauth`,
  ].join('&');
  return `${base}?${query}`;
}

/** Exchange an authorization code for user access + refresh tokens. */
export async function exchangeCodeForToken(code: string): Promise<EbayTokenResponse> {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRuName(),
  });

  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const desc = (err.error_description as string) || JSON.stringify(err);
    const errorId = (err.error_id as string) || String(res.status);
    if (errorId === 'temporarily_unavailable') {
      throw new Error(
        'eBay auth server is temporarily unavailable. This usually means the RuName does not ' +
        'match a registered redirect URI in your eBay developer app, or the sandbox is down. ' +
        'Verify your RuName in the developer portal (see setup instructions below).',
      );
    }
    throw new Error(`Token exchange failed [${errorId}]: ${desc}`);
  }
  return res.json() as Promise<EbayTokenResponse>;
}

/** Refresh the user access token using a stored refresh token. */
export async function refreshAccessToken(): Promise<EbayTokenResponse> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('No refresh token stored.');

  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  // Note: scope is intentionally omitted — eBay defaults to the original grant's scopes.
  // Sending scope on refresh causes invalid_request if it doesn't match the original grant.
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: normalizeToken(refreshToken),
  });

  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    // Any refresh failure means the token is unusable — clear it so the UI falls back to OAuth.
    clearUserToken();
    const errorCode = (err.error as string) || 'token_refresh_failed';
    throw Object.assign(
      new Error(`Stored eBay session expired or invalid (${errorCode}). Click Connect with eBay to reconnect.`),
      { code: 'auth_required' },
    );
  }
  return res.json() as Promise<EbayTokenResponse>;
}

/** Get an Application Token via Client Credentials (no user needed). */
export async function getAppToken(): Promise<string> {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope',
  });

  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`App token failed ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as EbayTokenResponse;
  return data.access_token;
}

// ── Get or auto-refresh active user token ─────────────────────────────────────

/** True when a valid access token OR a refresh token is available. */
export function hasValidSession(): boolean {
  return isTokenValid() || !!getStoredRefreshToken();
}

export async function getValidUserToken(): Promise<string> {
  const stored = getStoredUserToken();

  // Valid, non-expired access token — use it directly
  if (stored && Date.now() < stored.expiresAt) return stored.accessToken;

  // React Strict Mode and parallel data fetches can ask for a user token at the
  // same time. Share the in-flight refresh so we don't race the eBay token endpoint.
  if (pendingUserTokenPromise) return pendingUserTokenPromise;

  // No valid access token — attempt refresh if we have a refresh token
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('Not authenticated with eBay.');

  pendingUserTokenPromise = refreshAccessToken()
    .then(refreshed => {
      saveUserToken(refreshed);
      return refreshed.access_token;
    })
    .finally(() => {
      pendingUserTokenPromise = null;
    });

  return pendingUserTokenPromise;
}

// ── Sell Inventory API ────────────────────────────────────────────────────────

/** Fetch all inventory items for the authenticated seller. */
export async function getInventoryItems(limit = 25): Promise<EbayInventoryPage> {
  const token = await getValidUserToken();
  const res = await fetch(`${API}/sell/inventory/v1/inventory_item?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`getInventoryItems ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { inventoryItems?: EbayInventoryItem[]; total?: number; href?: string; next?: string };
  return {
    inventoryItems: data.inventoryItems ?? [],
    total: data.total ?? 0,
    href: data.href,
    next: data.next,
  };
}

/** Fetch all offers (listings) for the authenticated seller. */
export async function getOffers(sku?: string, limit = 25): Promise<EbayOfferPage> {
  const token = await getValidUserToken();
  return getOffersWithToken(token, sku, limit);
}

async function getOffersWithToken(token: string, sku?: string, limit = 25): Promise<EbayOfferPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (sku) params.set('sku', sku);

  const res = await fetch(`${API}/sell/inventory/v1/offer?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`getOffers ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { offers?: EbayOffer[]; total?: number };
  return { offers: data.offers ?? [], total: data.total ?? 0 };
}

export async function getOffer(offerId: string): Promise<EbayOfferDetails> {
  const token = await getValidUserToken();
  const res = await fetch(`${API}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`getOffer ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<EbayOfferDetails>;
}

export async function getOffersForInventorySkus(skus: string[]): Promise<EbayOfferPage> {
  const validSkus = [...new Set(skus.filter(isValidEbaySku))];
  if (validSkus.length === 0) {
    return { offers: [], total: 0 };
  }

  const token = await getValidUserToken();
  const results = await Promise.allSettled(validSkus.map(sku => getOffersWithToken(token, sku, 1)));
  const offers: EbayOffer[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const offer of result.value.offers) {
      if (!offers.some(existing => existing.offerId === offer.offerId || existing.sku === offer.sku)) {
        offers.push(offer);
      }
    }
  }

  return { offers, total: offers.length };
}

export async function getRecentSellerListings(limit = 20): Promise<EbayPublicListing[]> {
  const sellerUsername = getSellerUsername().trim();
  if (!sellerUsername) return [];

  const path = `/ebay-web-proxy/sch/i.html?_ssn=${encodeURIComponent(sellerUsername)}&_ipg=${limit}&_sop=10`;
  const res = await fetch(path, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Recent seller listings failed ${res.status}`);
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cards = Array.from(doc.querySelectorAll('.srp-results .s-item'));
  const listings: EbayPublicListing[] = [];

  for (const card of cards) {
    const link = card.querySelector<HTMLAnchorElement>('.s-item__link');
    const title = card.querySelector<HTMLElement>('.s-item__title')?.textContent?.trim();
    const price = card.querySelector<HTMLElement>('.s-item__price')?.textContent?.trim();
    const condition = card.querySelector<HTMLElement>('.SECONDARY_INFO')?.textContent?.trim();
    const image = card.querySelector<HTMLImageElement>('.s-item__image-img');

    if (!link?.href || !title || title === 'Shop on eBay') continue;

    const itemIdMatch = link.href.match(/\/itm\/(\d+)/) ?? link.href.match(/hash=item([a-z0-9]+)/i);
    const itemId = itemIdMatch?.[1] ?? link.href;

    listings.push({
      itemId,
      title,
      itemWebUrl: link.href,
      imageUrl: image?.src || image?.getAttribute('data-src') || undefined,
      price,
      condition,
    });

    if (listings.length >= limit) break;
  }

  return listings;
}

// ── Create a sample draft listing ─────────────────────────────────────────────

const SAMPLE_SKU = 'RAVMCINTOSHMA8900DEMO';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getXmlText(doc: XMLDocument, tagName: string): string {
  return doc.getElementsByTagNameNS('*', tagName)[0]?.textContent?.trim()
    ?? doc.getElementsByTagName(tagName)[0]?.textContent?.trim()
    ?? '';
}

function getTradingErrors(doc: XMLDocument): string {
  const errors = Array.from(doc.getElementsByTagNameNS('*', 'Errors'));
  const messages = errors
    .map(error => {
      const longMessage = error.getElementsByTagNameNS('*', 'LongMessage')[0]?.textContent?.trim();
      const shortMessage = error.getElementsByTagNameNS('*', 'ShortMessage')[0]?.textContent?.trim();
      const code = error.getElementsByTagNameNS('*', 'ErrorCode')[0]?.textContent?.trim();
      const message = longMessage || shortMessage || 'Unknown Trading API error';
      return code ? `${code}: ${message}` : message;
    })
    .filter(Boolean);

  return messages.join(' | ');
}

async function callTradingApi(token: string, callName: string, body: string): Promise<XMLDocument> {
  const res = await fetch(`${API}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1231',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-IAF-TOKEN': token,
    },
    body,
  });

  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0]?.textContent?.trim();
  if (parseError) {
    throw new Error(`${callName} XML parse error: ${parseError}`);
  }

  const ack = getXmlText(doc, 'Ack');
  if (!res.ok || (ack && ack !== 'Success' && ack !== 'Warning')) {
    const message = getTradingErrors(doc) || text.slice(0, 400);
    throw new Error(`${callName} ${res.status}: ${message}`);
  }

  return doc;
}

function buildTradingSamplePayload(sku: string, locationConfig: EbayLocationConfig, policyConfig: EbayBusinessPolicyConfig): string {
  const locationLabel = [locationConfig.city, locationConfig.stateOrProvince].filter(Boolean).join(', ') || locationConfig.name;
  const sellerProfiles = policyConfig.fulfillmentPolicyId && policyConfig.paymentPolicyId && policyConfig.returnPolicyId
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

async function verifyTradingSampleListing(token: string, sku: string, locationConfig: EbayLocationConfig, policyConfig: EbayBusinessPolicyConfig): Promise<void> {
  const itemPayload = buildTradingSamplePayload(sku, locationConfig, policyConfig);
  const verifyBody = `<?xml version="1.0" encoding="utf-8"?><VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</VerifyAddFixedPriceItemRequest>`;
  await callTradingApi(token, 'VerifyAddFixedPriceItem', verifyBody);
}

async function createTradingSampleListing(mode: 'trading' | 'trading-verify'): Promise<EbaySampleListingResult> {
  const token = await getValidUserToken();
  const locationConfig = getInventoryLocationConfig();
  const policyConfig = getBusinessPolicyConfig();

  if (!locationConfig.postalCode.trim()) {
    throw new Error('Trading API listing requires a postal code in the eBay publish setup.');
  }

  const sku = `RAVTRADING${Date.now()}`;
  await verifyTradingSampleListing(token, sku, locationConfig, policyConfig);

  if (mode === 'trading-verify') {
    return {
      mode,
      sku,
      status: 'VERIFIED',
    };
  }

  const itemPayload = buildTradingSamplePayload(sku, locationConfig, policyConfig);
  const addBody = `<?xml version="1.0" encoding="utf-8"?><AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</AddFixedPriceItemRequest>`;
  const addDoc = await callTradingApi(token, 'AddFixedPriceItem', addBody);
  const listingId = getXmlText(addDoc, 'ItemID');

  if (!listingId) {
    throw new Error('AddFixedPriceItem succeeded but eBay did not return an ItemID.');
  }

  return {
    mode: 'trading',
    sku,
    listingId,
    status: 'ACTIVE',
  };
}

function buildSampleOfferPayload(locationConfig: EbayLocationConfig | null, policyConfig: EbayBusinessPolicyConfig | null): Record<string, unknown> {
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
    ...(policyConfig ? {
      listingPolicies: {
        fulfillmentPolicyId: policyConfig.fulfillmentPolicyId,
        paymentPolicyId: policyConfig.paymentPolicyId,
        returnPolicyId: policyConfig.returnPolicyId,
      },
    } : {}),
  };
}

async function upsertWarehouseLocation(token: string, config: EbayLocationConfig): Promise<void> {
  const missing = getMissingLocationFields(config);
  if (missing.length > 0) {
    throw new Error(`Missing eBay inventory location setup: ${missing.join(', ')}.`);
  }

  const body = {
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

  const res = await fetch(`${API}/sell/inventory/v1/location/${encodeURIComponent(config.key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 204 || res.status === 409) {
    return;
  }

  const err = await res.json().catch(() => ({}));
  throw new Error(`createInventoryLocation ${res.status}: ${JSON.stringify(err)}`);
}

async function createOrUpdateSampleOffer(token: string, offerId?: string): Promise<{ sku: string; offerId: string }> {
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
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
      },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as {
        errors?: Array<{ errorId?: number }>;
      };

      if (createRes.status === 409 || err.errors?.some(error => error.errorId === 25002)) {
        const existing = await getOffers(SAMPLE_SKU, 1);
        if (existing.offers.length > 0) {
          return createOrUpdateSampleOffer(token, existing.offers[0].offerId);
        }
      }

      throw new Error(`createOffer ${createRes.status}: ${JSON.stringify(err)}`);
    }

    const offerData = await createRes.json() as { offerId?: string };
    return { sku: SAMPLE_SKU, offerId: offerData.offerId ?? '' };
  }

  const updateRes = await fetch(`${API}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify(payload),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(`updateOffer ${updateRes.status}: ${JSON.stringify(err)}`);
  }

  return { sku: SAMPLE_SKU, offerId };
}

/**
 * Creates (or overwrites) a sample McIntosh MA8900 inventory item + offer in DRAFT.
 * The offer is never published — it stays "UNPUBLISHED" which is eBay's draft state.
 * Returns the offerId of the created offer.
 */
export async function createSampleDraftListing(): Promise<{ sku: string; offerId: string }> {
  const token = await getValidUserToken();

  // Step 1 — Create/update inventory item
  const itemRes = await fetch(`${API}/sell/inventory/v1/inventory_item/${encodeURIComponent(SAMPLE_SKU)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify({
      product: {
        title: 'McIntosh MA8900 Integrated Amplifier — Resolution AV Demo',
        description:
          '<p>The McIntosh MA8900 is a premium 200-watt-per-channel integrated amplifier combining solid-state power with vacuum tube inputs. ' +
          'Features include a built-in DAC supporting PCM up to 32-bit/384kHz and DSD128, MM/MC phono stage, ' +
          'and McIntosh\'s iconic illuminated watt meters. Listed via Resolution AV\'s inventory management system.</p>',
        imageUrls: [
          'https://images.crutchfieldonline.com/ImageHandler/trim/3000/1950/products/2018/45/793/g793MA8900/0.jpg',
        ],
        aspects: {
          Brand: ['McIntosh'],
          Model: ['MA8900'],
          'MPN': ['MA8900'],
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

  // Step 2 — Create or update an offer (draft by default — status will be UNPUBLISHED)
  const existing = await getOffers(SAMPLE_SKU, 1);
  return createOrUpdateSampleOffer(token, existing.offers[0]?.offerId);
}

export async function createSampleListing(mode: EbayListingApiMode = getPreferredListingApiMode()): Promise<EbaySampleListingResult> {
  if (mode === 'trading' || mode === 'trading-verify') {
    return createTradingSampleListing(mode);
  }

  const result = await createSampleDraftListing();
  return {
    mode: 'inventory',
    sku: result.sku,
    offerId: result.offerId,
    status: 'UNPUBLISHED',
  };
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

  const needsOfferUpdate = details.merchantLocationKey !== locationConfig.key
    || details.listingPolicies?.fulfillmentPolicyId !== policyConfig.fulfillmentPolicyId
    || details.listingPolicies?.paymentPolicyId !== policyConfig.paymentPolicyId
    || details.listingPolicies?.returnPolicyId !== policyConfig.returnPolicyId
    || details.availableQuantity !== 1
    || details.categoryId !== '3276'
    || details.listingDuration !== 'GTC';

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

  const publishData = await publishRes.json().catch(() => ({})) as {
    listingId?: string;
    errors?: Array<{ message?: string; parameters?: Array<{ value?: string }> }>;
  };

  if (!publishRes.ok) {
    const firstError = publishData.errors?.[0];
    const parameterValues = firstError?.parameters?.map(parameter => parameter.value).filter(Boolean).join(', ');
    const suffix = parameterValues ? ` (${parameterValues})` : '';
    throw new Error(`publishOffer ${publishRes.status}: ${firstError?.message ?? JSON.stringify(publishData)}${suffix}`);
  }

  if (!publishData.listingId) {
    throw new Error('publishOffer succeeded but eBay did not return a listingId.');
  }

  return { sku, offerId, listingId: publishData.listingId };
}

export const ebayConfig = { clientId: CLIENT_ID, ruName: getRuName(), env: IS_SANDBOX ? 'sandbox' : 'production' };
