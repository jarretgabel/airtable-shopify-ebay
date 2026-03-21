import type { EbayListingApiMode } from './types';

// Environment variables
export const IS_SANDBOX =
  (import.meta.env.VITE_EBAY_ENV as string | undefined)?.toLowerCase() !== 'production';

export const CLIENT_ID = (import.meta.env.VITE_EBAY_CLIENT_ID as string | undefined) ?? '';
export const CLIENT_SECRET = (import.meta.env.VITE_EBAY_CLIENT_SECRET as string | undefined) ?? '';

export const ENV_RU_NAME = (import.meta.env.VITE_EBAY_RU_NAME as string | undefined) ?? '';
const ENV_REFRESH_TOKEN = (import.meta.env.VITE_EBAY_REFRESH_TOKEN as string | undefined) ?? '';
export const ENV_SELLER_USERNAME = (import.meta.env.VITE_EBAY_SELLER_USERNAME as string | undefined) ?? '';
export const ENV_LOCATION_KEY = (import.meta.env.VITE_EBAY_LOCATION_KEY as string | undefined) ?? '';
export const ENV_LOCATION_NAME = (import.meta.env.VITE_EBAY_LOCATION_NAME as string | undefined) ?? '';
export const ENV_LOCATION_COUNTRY = (import.meta.env.VITE_EBAY_LOCATION_COUNTRY as string | undefined) ?? '';
export const ENV_LOCATION_POSTAL_CODE = (import.meta.env.VITE_EBAY_LOCATION_POSTAL_CODE as string | undefined) ?? '';
export const ENV_LOCATION_CITY = (import.meta.env.VITE_EBAY_LOCATION_CITY as string | undefined) ?? '';
export const ENV_LOCATION_STATE = (import.meta.env.VITE_EBAY_LOCATION_STATE as string | undefined) ?? '';
export const ENV_FULFILLMENT_POLICY_ID = (import.meta.env.VITE_EBAY_FULFILLMENT_POLICY_ID as string | undefined) ?? '';
export const ENV_PAYMENT_POLICY_ID = (import.meta.env.VITE_EBAY_PAYMENT_POLICY_ID as string | undefined) ?? '';
export const ENV_RETURN_POLICY_ID = (import.meta.env.VITE_EBAY_RETURN_POLICY_ID as string | undefined) ?? '';

const RAW_ENV_LISTING_API_MODE = ((import.meta.env.VITE_EBAY_LISTING_API as string | undefined) ?? 'inventory').toLowerCase();
export const ENV_LISTING_API_MODE: EbayListingApiMode =
  RAW_ENV_LISTING_API_MODE === 'trading' || RAW_ENV_LISTING_API_MODE === 'trading-verify'
    ? RAW_ENV_LISTING_API_MODE
    : 'inventory';

// API endpoints
export const EBAY_AUTH_HOST = IS_SANDBOX
  ? 'https://auth.sandbox.ebay.com'
  : 'https://auth.ebay.com';

export const API = '/ebay-api-proxy';

export const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
].join(' ');

// localStorage keys
export const LS_ACCESS = 'ebay_access_token';
export const LS_REFRESH = 'ebay_refresh_token';
export const LS_EXPIRY = 'ebay_token_expires';
export const LS_LOCATION_CONFIG = 'ebay_location_config';
export const LS_POLICY_CONFIG = 'ebay_policy_config';
export const LS_LISTING_API_MODE = 'ebay_listing_api_mode';

export function normalizeToken(token: string): string {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export const normalizedEnvRefreshToken = ENV_REFRESH_TOKEN ? normalizeToken(ENV_REFRESH_TOKEN) : '';