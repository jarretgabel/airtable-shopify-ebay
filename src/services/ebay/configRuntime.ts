import type { EbayBusinessPolicyConfig, EbayListingApiMode, EbayLocationConfig } from './types';
import {
  CLIENT_ID,
  ENV_FULFILLMENT_POLICY_ID,
  ENV_LISTING_API_MODE,
  ENV_LOCATION_CITY,
  ENV_LOCATION_COUNTRY,
  ENV_LOCATION_KEY,
  ENV_LOCATION_NAME,
  ENV_LOCATION_POSTAL_CODE,
  ENV_LOCATION_STATE,
  ENV_PAYMENT_POLICY_ID,
  ENV_RETURN_POLICY_ID,
  ENV_RU_NAME,
  ENV_SELLER_USERNAME,
  IS_SANDBOX,
  LS_LISTING_API_MODE,
  LS_LOCATION_CONFIG,
  LS_POLICY_CONFIG,
} from './configEnv';

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

export function getRuName(): string {
  return localStorage.getItem('ebay_ru_name') || ENV_RU_NAME;
}

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
  const missing: string[] = [];
  if (!cleanOptional(config.key)) missing.push('location key');
  if (!cleanOptional(config.country)) missing.push('country');
  const hasPostal = Boolean(cleanOptional(config.postalCode));
  const hasCityState = Boolean(cleanOptional(config.city) && cleanOptional(config.stateOrProvince));
  if (!hasPostal && !hasCityState) missing.push('postal code or city/state');
  return missing;
}

export function getMissingPolicyFields(config: EbayBusinessPolicyConfig): string[] {
  const missing: string[] = [];
  if (!cleanOptional(config.fulfillmentPolicyId)) missing.push('fulfillment policy');
  if (!cleanOptional(config.paymentPolicyId)) missing.push('payment policy');
  if (!cleanOptional(config.returnPolicyId)) missing.push('return policy');
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