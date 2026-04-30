import { checkOptionalEnv } from '@/config/runtimeEnv';
import { getRuntimeConfigLoadState } from '@/config/runtimeConfig';

export type RuntimeHealthRequirement = 'required' | 'recommended' | 'optional';
export type RuntimeHealthStatus = 'ok' | 'warning' | 'missing';

export interface RuntimeHealthEntry {
  label: string;
  requirement: RuntimeHealthRequirement;
  status: RuntimeHealthStatus;
  detail: string;
  value: string | null;
}

export interface RuntimeHealthReport {
  configSource: ReturnType<typeof getRuntimeConfigLoadState>;
  entries: RuntimeHealthEntry[];
}

function firstValue(names: string[]): string {
  for (const name of names) {
    const value = checkOptionalEnv(name);
    if (value) return value;
  }

  return '';
}

function createEntry(
  label: string,
  requirement: RuntimeHealthRequirement,
  names: string[],
  detail: string,
  options?: { requireAll?: boolean; fallbackValue?: string },
): RuntimeHealthEntry {
  const values = names.map((name) => checkOptionalEnv(name));
  const populatedNames = names.filter((_, index) => values[index]);
  const hasValue = options?.requireAll ? populatedNames.length === names.length : populatedNames.length > 0;
  const fallbackValue = options?.fallbackValue ?? '';
  const value = firstValue(names) || fallbackValue;

  return {
    label,
    requirement,
    status: hasValue ? 'ok' : requirement === 'optional' ? 'warning' : 'missing',
    detail,
    value: value || null,
  };
}

export function getRuntimeHealthReport(): RuntimeHealthReport {
  return {
    configSource: getRuntimeConfigLoadState(),
    entries: [
      createEntry('Inventory Airtable table', 'required', ['VITE_AIRTABLE_TABLE_NAME'], 'Required for the directory list and dashboard inventory metrics.'),
      createEntry('Shopify store domain', 'required', ['VITE_SHOPIFY_STORE_DOMAIN'], 'Required for Shopify product views and publish tooling.'),
      createEntry('Users auth table', 'recommended', ['VITE_AIRTABLE_USERS_TABLE_REF', 'VITE_AIRTABLE_USERS_TABLE_NAME'], 'Recommended so auth reads the intended Airtable users source.'),
      createEntry('Approval Airtable table', 'optional', ['VITE_AIRTABLE_APPROVAL_TABLE_REF', 'VITE_AIRTABLE_APPROVAL_TABLE_NAME'], 'Used for eBay approval records and queue routing.'),
      createEntry('Shopify approval Airtable table', 'optional', ['VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF', 'VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME'], 'Used for Shopify approval records and queue routing.'),
      createEntry('Combined listings Airtable table', 'optional', ['VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF', 'VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME'], 'Used for the combined listings approval workflow.'),
      createEntry('App API base URL', 'recommended', ['VITE_APP_API_BASE_URL'], 'Recommended for deployed frontend API calls when same-origin routing is not used.'),
      createEntry('JotForm form ID', 'optional', ['VITE_JOTFORM_FORM_ID'], 'Used for inquiry polling and dashboard submission metrics.'),
      createEntry('eBay runtime bundle', 'optional', ['VITE_EBAY_AUTH_HOST', 'VITE_EBAY_OAUTH_SCOPES', 'VITE_EBAY_APP_SCOPE'], 'Used for eBay auth and publish runtime settings.', { requireAll: true }),
      createEntry('Analytics toggle', 'optional', ['VITE_ANALYTICS_ENABLED'], 'Controls operator workflow analytics in the browser.', { fallbackValue: 'enabled by default' }),
      createEntry('AI provider', 'optional', ['VITE_AI_PROVIDER'], 'Controls which AI provider label the UI reports.', { fallbackValue: 'backend/default' }),
    ],
  };
}