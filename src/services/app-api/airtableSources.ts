import { checkOptionalEnv } from '@/config/runtimeEnv';

export const DEFAULT_USERS_TABLE_NAME = 'j2Gt9USORo6Vi5';
export const DEFAULT_COMBINED_LISTINGS_TABLE_NAME = 'tbl0K0nFQL64jQMx8';
export const DEFAULT_SHOPIFY_VENDORS_TABLE_REF = 'apprsAm2FOohEmL2u/tblF0B5TUhy20hJCv/viwx2RONDo3Ii85Gl';
export const DEFAULT_SHOPIFY_VENDORS_TABLE_NAME = 'tblF0B5TUhy20hJCv';

export type AirtableConfiguredRecordsSource =
  | 'users'
  | 'user-guide'
  | 'inventory-directory'
  | 'used-gear-workflow'
  | 'approval-ebay'
  | 'approval-shopify'
  | 'approval-combined'
  | 'shopify-vendors';

export function getUsersTableReference(): { reference?: string; tableName: string } {
  const envReference = checkOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF');
  const envTableName = checkOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME');

  if (envReference && !envReference.includes('/')) {
    return { tableName: envReference };
  }

  return {
    reference: envReference,
    tableName: envTableName || DEFAULT_USERS_TABLE_NAME,
  };
}

export function getConfiguredRecordsSourceDefinition(source: AirtableConfiguredRecordsSource): {
  reference?: string;
  tableName: string;
} {
  if (source === 'user-guide') {
    return {
      reference: checkOptionalEnv('VITE_AIRTABLE_USER_GUIDE_TABLE_REF'),
      tableName: checkOptionalEnv('VITE_AIRTABLE_USER_GUIDE_TABLE_NAME') || 'tblquB9pdwSRXsI7c',
    };
  }

  if (source === 'users') {
    return getUsersTableReference();
  }

  if (source === 'approval-ebay') {
    return {
      reference: checkOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_REF'),
      tableName: checkOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_NAME') || '',
    };
  }

  if (source === 'approval-shopify') {
    return {
      reference: checkOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF'),
      tableName: checkOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME') || '',
    };
  }

  if (source === 'approval-combined') {
    return {
      reference: checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF'),
      tableName: checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME') || '',
    };
  }

  if (source === 'shopify-vendors') {
    return {
      reference: checkOptionalEnv('VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_REF') || DEFAULT_SHOPIFY_VENDORS_TABLE_REF,
      tableName: checkOptionalEnv('VITE_AIRTABLE_SHOPIFY_VENDORS_TABLE_NAME') || DEFAULT_SHOPIFY_VENDORS_TABLE_NAME,
    };
  }

  if (source === 'used-gear-workflow') {
    return {
      reference: checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF'),
      tableName: checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME') || DEFAULT_COMBINED_LISTINGS_TABLE_NAME,
    };
  }

  return {
    reference: checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF'),
    tableName: checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME') || DEFAULT_COMBINED_LISTINGS_TABLE_NAME,
  };
}

function normalizeValue(value: string | undefined): string {
  return (value || '').trim();
}

export function resolveConfiguredRecordsSource(
  reference: string | undefined,
  tableName: string | undefined,
): AirtableConfiguredRecordsSource | null {
  const inputReference = normalizeValue(reference);
  const inputTableName = normalizeValue(tableName);

  // Prefer combined listings when multiple approval sources share the same
  // Airtable reference in runtime config (common in staging/prod bundles).
  for (const source of ['user-guide', 'approval-combined', 'approval-ebay', 'approval-shopify', 'shopify-vendors'] as const) {
    const definition = getConfiguredRecordsSourceDefinition(source);
    const definitionReference = normalizeValue(definition.reference);
    const definitionTableName = normalizeValue(definition.tableName);

    const referenceMatches = definitionReference ? definitionReference === inputReference : inputReference === '';
    const tableMatches = definitionTableName ? definitionTableName === inputTableName : inputTableName === '';

    if (referenceMatches && (!inputTableName || !definitionTableName)) {
      return source;
    }

    if (referenceMatches && tableMatches) {
      return source;
    }
  }

  return null;
}