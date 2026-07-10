declare const process: { env?: Record<string, string | undefined> } | undefined;

// Helper to safely access process.env in Node.js only
function getProcessEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
    return process.env[name];
  }
  return undefined;
}
import { hasRuntimeConfigValue, readRuntimeConfigValue, type PublicRuntimeConfig } from '@/config/runtimeConfig';

const bundledEnvValues: Partial<Record<keyof PublicRuntimeConfig, string>> = {
  VITE_AIRTABLE_TABLE_NAME: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_TABLE_NAME !== undefined
    ? import.meta.env.VITE_AIRTABLE_TABLE_NAME
    : getProcessEnvVar('VITE_AIRTABLE_TABLE_NAME'),
  VITE_AIRTABLE_VIEW_ID: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_VIEW_ID !== undefined
    ? import.meta.env.VITE_AIRTABLE_VIEW_ID
    : getProcessEnvVar('VITE_AIRTABLE_VIEW_ID'),
  VITE_AI_PROVIDER: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_PROVIDER !== undefined
    ? import.meta.env.VITE_AI_PROVIDER
    : getProcessEnvVar('VITE_AI_PROVIDER'),
  VITE_AIRTABLE_USERS_TABLE_REF: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_USERS_TABLE_REF !== undefined
    ? import.meta.env.VITE_AIRTABLE_USERS_TABLE_REF
    : getProcessEnvVar('VITE_AIRTABLE_USERS_TABLE_REF'),
  VITE_AIRTABLE_USERS_TABLE_NAME: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_USERS_TABLE_NAME !== undefined
    ? import.meta.env.VITE_AIRTABLE_USERS_TABLE_NAME
    : getProcessEnvVar('VITE_AIRTABLE_USERS_TABLE_NAME'),
  VITE_AIRTABLE_APPROVAL_TABLE_REF: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF !== undefined
    ? import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF
    : getProcessEnvVar('VITE_AIRTABLE_APPROVAL_TABLE_REF'),
  VITE_AIRTABLE_APPROVAL_TABLE_NAME: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME !== undefined
    ? import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME
    : getProcessEnvVar('VITE_AIRTABLE_APPROVAL_TABLE_NAME'),
  VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF !== undefined
    ? import.meta.env.VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF
    : getProcessEnvVar('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF'),
  VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME !== undefined
    ? import.meta.env.VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME
    : getProcessEnvVar('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME'),
  VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_REF: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_REF !== undefined
    ? import.meta.env.VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_REF
    : getProcessEnvVar('VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_REF'),
  VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_NAME: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_NAME !== undefined
    ? import.meta.env.VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_NAME
    : getProcessEnvVar('VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_NAME'),
  VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF !== undefined
    ? import.meta.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF
    : getProcessEnvVar('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF'),
  VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME !== undefined
    ? import.meta.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME
    : getProcessEnvVar('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME'),
  VITE_APP_API_BASE_URL: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_API_BASE_URL !== undefined
    ? import.meta.env.VITE_APP_API_BASE_URL
    : getProcessEnvVar('VITE_APP_API_BASE_URL'),
  VITE_SHOPIFY_STORE_DOMAIN: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SHOPIFY_STORE_DOMAIN !== undefined
    ? import.meta.env.VITE_SHOPIFY_STORE_DOMAIN
    : getProcessEnvVar('VITE_SHOPIFY_STORE_DOMAIN'),
  VITE_JOTFORM_FORM_ID: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_JOTFORM_FORM_ID !== undefined
    ? import.meta.env.VITE_JOTFORM_FORM_ID
    : getProcessEnvVar('VITE_JOTFORM_FORM_ID'),
  VITE_EBAY_AUTH_HOST: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_EBAY_AUTH_HOST !== undefined
    ? import.meta.env.VITE_EBAY_AUTH_HOST
    : getProcessEnvVar('VITE_EBAY_AUTH_HOST'),
  VITE_EBAY_OAUTH_SCOPES: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_EBAY_OAUTH_SCOPES !== undefined
    ? import.meta.env.VITE_EBAY_OAUTH_SCOPES
    : getProcessEnvVar('VITE_EBAY_OAUTH_SCOPES'),
  VITE_EBAY_APP_SCOPE: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_EBAY_APP_SCOPE !== undefined
    ? import.meta.env.VITE_EBAY_APP_SCOPE
    : getProcessEnvVar('VITE_EBAY_APP_SCOPE'),
  VITE_ANALYTICS_ENABLED: typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ANALYTICS_ENABLED !== undefined
    ? import.meta.env.VITE_ANALYTICS_ENABLED
    : getProcessEnvVar('VITE_ANALYTICS_ENABLED'),
};

function readEnv(name: string): string {
  const runtimeConfigName = name as keyof PublicRuntimeConfig;
  if (hasRuntimeConfigValue(runtimeConfigName)) {
    return readRuntimeConfigValue(runtimeConfigName);
  }

  const value = bundledEnvValues[runtimeConfigName];
  return typeof value === 'string' ? value.trim() : '';
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireOneOfEnv(names: string[]): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }

  throw new Error(`Missing required environment variable. Set one of: ${names.join(', ')}`);
}

export function checkOptionalEnv(name: string): string {
  return readEnv(name);
}

export function logMissingOptionalEnv(names: string[]): void {
  if (typeof window === 'undefined') return;

  const missing = names.filter((name) => !readEnv(name));
  if (missing.length) {
    console.warn(`[env] Missing optional environment variables: ${missing.join(', ')}`);
  }
}
