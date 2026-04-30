import { checkOptionalEnv } from '@/config/runtimeEnv';

export interface RuntimeFeatureCapability {
  available: boolean;
  message: string | null;
  missingEnvNames: string[];
}

export interface RuntimeFeatureMap {
  jotform: RuntimeFeatureCapability;
  ebay: RuntimeFeatureCapability;
  approvalEbay: RuntimeFeatureCapability;
  approvalShopify: RuntimeFeatureCapability;
  approvalCombined: RuntimeFeatureCapability;
}

interface CapabilityOptions {
  missingMessage: string;
  requireAll?: boolean;
}

function createCapability(names: string[], options: CapabilityOptions): RuntimeFeatureCapability {
  const populatedNames = names.filter((name) => Boolean(checkOptionalEnv(name)));
  const available = options.requireAll ? populatedNames.length === names.length : populatedNames.length > 0;
  const missingEnvNames = options.requireAll
    ? names.filter((name) => !populatedNames.includes(name))
    : available
      ? []
      : names;

  return {
    available,
    message: available
      ? null
      : `Missing public runtime config: ${missingEnvNames.join(', ')}. ${options.missingMessage}`,
    missingEnvNames,
  };
}

export function getRuntimeFeatureCapabilities(): RuntimeFeatureMap {
  return {
    jotform: createCapability(
      ['VITE_JOTFORM_FORM_ID'],
      {
        missingMessage: 'Configure a JotForm form id to enable inquiry polling and dashboard submission metrics.',
      },
    ),
    ebay: createCapability(
      ['VITE_EBAY_AUTH_HOST', 'VITE_EBAY_OAUTH_SCOPES', 'VITE_EBAY_APP_SCOPE'],
      {
        requireAll: true,
        missingMessage: 'Configure the eBay runtime bundle to enable the eBay dashboard and listing tools.',
      },
    ),
    approvalEbay: createCapability(
      ['VITE_AIRTABLE_APPROVAL_TABLE_REF', 'VITE_AIRTABLE_APPROVAL_TABLE_NAME'],
      {
        missingMessage: 'Configure the eBay approval Airtable source to enable the approval queue and dashboard summary.',
      },
    ),
    approvalShopify: createCapability(
      ['VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF', 'VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME'],
      {
        missingMessage: 'Configure the Shopify approval Airtable source to enable the approval queue and dashboard summary.',
      },
    ),
    approvalCombined: createCapability(
      ['VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF', 'VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME'],
      {
        missingMessage: 'Configure the combined listings Airtable source to enable the combined approval workflow.',
      },
    ),
  };
}