/**
 * eBay configuration — environment variables, localStorage keys, and runtime
 * config helpers (location, policy, listing API mode).
 */
import type { EbayBusinessPolicyConfig, EbayListingApiMode, EbayLocationConfig } from './types';

// ─── Environment variables ────────────────────────────────────────────────────

export const IS_SANDBOX =
  (import.meta.env.VITE_EBAY_ENV as string | undefined)?.toLowerCase() !== 'production';

export const CLIENT_ID     = (import.meta.env.VITE_EBAY_CLIENT_ID     as string | undefined) ?? '';
export const CLIENT_SECRET = (import.meta.env.VITE_EBAY_CLIENT_SECRET as string | undefined) ?? '';

const ENV_RU_NAME           = (import.meta.env.VITE_EBAY_RU_NAME           as string | undefined) ?? '';
const ENV_REFRESH_TOKEN     = (import.meta.env.VITE_EBAY_REFRESH_TOKEN     as string | undefined) ?? '';
const ENV_SELLER_USERNAME   = (import.meta.env.VITE_EBAY_SELLER_USERNAME   as string | undefined) ?? '';
const ENV_LOCATION_KEY      = (import.meta.env.VITE_EBAY_LOCATION_KEY      as string | undefined) ?? '';
const ENV_LOCATION_NAME     = (import.meta.env.VITE_EBAY_LOCATION_NAME     as string | undefined) ?? '';
const ENV_LOCATION_COUNTRY  = (import.meta.env.VITE_EBAY_LOCATION_COUNTRY  as string | undefined) ?? '';
const ENV_LOCATION_POSTAL_CODE = (import.meta.env.VITE_EBAY_LOCATION_POSTAL_CODE as string | undefined) ?? '';
const ENV_LOCATION_CITY     = (import.meta.env.VITE_EBAY_LOCATION_CITY     as string | undefined) ?? '';
const ENV_LOCATION_STATE    = (import.meta.env.VITE_EBAY_LOCATION_STATE    as string | undefined) ?? '';
const ENV_FULFILLMENT_POLICY_ID = (import.meta.env.VITE_EBAY_FULFILLMENT_POLICY_ID as string | undefined) ?? '';
const ENV_PAYMENT_POLICY_ID     = (import.meta.env.VITE_EBAY_PAYMENT_POLICY_ID     as string | undefined) ?? '';
const ENV_RETURN_POLICY_ID      = (import.meta.env.VITE_EBAY_RETURN_POLICY_ID      as string | undefined) ?? '';

const RAW_ENV_LISTING_API_MODE = ((import.meta.env.VITE_EBAY_LISTING_API as string | undefined) ?? 'inventory').toLowerCase();
export const ENV_LISTING_API_MODE: EbayListingApiMode =
  RAW_ENV_LISTING_API_MODE === 'trading' || RAW_ENV_LISTING_API_MODE === 'trading-verify'
    ? RAW_ENV_LISTING_API_MODE
    : 'inventory';

// ─── API endpoints ────────────────────────────────────────────────────────────

export const EBAY_AUTH_HOST = IS_SANDBOX
  ? 'https://auth.sandbox.ebay.com'
  : 'https://auth.ebay.com';

/** All API calls go via Vite proxy (points at api.sandbox.ebay.com or api.ebay.com). */
export const API = '/ebay-api-proxy';

/** OAuth scopes required for seller operations. */
export const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
].join(' ');

// ─── localStorage keys ────────────────────────────────────────────────────────

export const LS_ACCESS          = 'ebay_access_token';
export const LS_REFRESH         = 'ebay_refresh_token';
export const LS_EXPIRY          = 'ebay_token_expires';
export const LS_LOCATION_CONFIG = 'ebay_location_config';
export const LS_POLICY_CONFIG   = 'ebay_policy_config';
export const LS_LISTING_API_MODE = 'ebay_listing_api_mode';

// ─── Utilities ────────────────────────────────────────────────────────────────

export function normalizeToken(token: string): string {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export const normalizedEnvRefreshToken = ENV_REFRESH_TOKEN ? normalizeToken(ENV_REFRESH_TOKEN) : '';

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

// ─── Runtime config helpers ───────────────────────────────────────────────────

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

export function getInventoryLocationConfig(): EbayLocationConfig {
  const stored = parseStoredJson<EbayLocationConfig>(LS_LOCATION_CONFIG);
  return {
    key:             cleanOptional(stored.key)             || cleanOptional(ENV_LOCATION_KEY)      || 'resolution-av-warehouse',
    name:            cleanOptional(stored.name)            || cleanOptional(ENV_LOCATION_NAME)     || 'Resolution AV Warehouse',
    country:         (cleanOptional(stored.country)        || cleanOptional(ENV_LOCATION_COUNTRY)  || 'US').toUpperCase(),
    postalCode:      cleanOptional(stored.postalCode)      || cleanOptional(ENV_LOCATION_POSTAL_CODE),
    city:            cleanOptional(stored.city)            || cleanOptional(ENV_LOCATION_CITY),
    stateOrProvince: cleanOptional(stored.stateOrProvince) || cleanOptional(ENV_LOCATION_STATE),
  };
}

export function saveInventoryLocationConfig(config: EbayLocationConfig): void {
  localStorage.setItem(LS_LOCATION_CONFIG, JSON.stringify({
    key:             cleanOptional(config.key),
    name:            cleanOptional(config.name),
    country:         cleanOptional(config.country).toUpperCase(),
    postalCode:      cleanOptional(config.postalCode),
    city:            cleanOptional(config.city),
    stateOrProvince: cleanOptional(config.stateOrProvince),
  }));
}

export function getBusinessPolicyConfig(): EbayBusinessPolicyConfig {
  const stored = parseStoredJson<EbayBusinessPolicyConfig>(LS_POLICY_CONFIG);
  return {
    fulfillmentPolicyId: cleanOptional(stored.fulfillmentPolicyId) || cleanOptional(ENV_FULFILLMENT_POLICY_ID),
    paymentPolicyId:     cleanOptional(stored.paymentPolicyId)     || cleanOptional(ENV_PAYMENT_POLICY_ID),
    returnPolicyId:      cleanOptional(stored.returnPolicyId)      || cleanOptional(ENV_RETURN_POLICY_ID),
  };
}

export function saveBusinessPolicyConfig(config: EbayBusinessPolicyConfig): void {
  localStorage.setItem(LS_POLICY_CONFIG, JSON.stringify({
    fulfillmentPolicyId: cleanOptional(config.fulfillmentPolicyId),
    paymentPolicyId:     cleanOptional(config.paymentPolicyId),
    returnPolicyId:      cleanOptional(config.returnPolicyId),
  }));
}

export function getMissingLocationFields(config: EbayLocationConfig): string[] {
  const missing: string[] = [];
  if (!cleanOptional(config.key))     missing.push('location key');
  if (!cleanOptional(config.country)) missing.push('country');
  const hasPostal    = Boolean(cleanOptional(config.postalCode));
  const hasCityState = Boolean(cleanOptional(config.city) && cleanOptional(config.stateOrProvince));
  if (!hasPostal && !hasCityState) missing.push('postal code or city/state');
  return missing;
}

export function getMissingPolicyFields(config: EbayBusinessPolicyConfig): string[] {
  const missing: string[] = [];
  if (!cleanOptional(config.fulfillmentPolicyId)) missing.push('fulfillment policy');
  if (!cleanOptional(config.paymentPolicyId))     missing.push('payment policy');
  if (!cleanOptional(config.returnPolicyId))      missing.push('return policy');
  return missing;
}

export function getPreferredListingApiMode(): EbayListingApiMode {
  const stored = localStorage.getItem(LS_LISTING_API_MODE);
  if (stored === 'inventory' || stored === 'trading' || stored === 'trading-verify') return stored;
  return ENV_LISTING_API_MODE;
}

export function savePreferredListingApiMode(mode: EbayListingApiMode): void {
  localStorage.setItem(LS_LISTING_API_MODE, mode);
}

export const ebayConfig = {
  clientId: CLIENT_ID,
  ruName: getRuName(),
  env: IS_SANDBOX ? 'sandbox' : 'production',
};
