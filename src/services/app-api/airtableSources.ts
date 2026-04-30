import { checkOptionalEnv } from '@/config/runtimeEnv';

export const DEFAULT_USERS_TABLE_NAME = 'j2Gt9USORo6Vi5';

export const INVENTORY_DIRECTORY_BASE_ID = 'appjQj8FQfFZ2ogMz';
export const INVENTORY_DIRECTORY_TABLE_ID = 'tblirsoRIFPDMHxb0';
export const INVENTORY_DIRECTORY_TABLE_NAME = 'SB Inventory';
export const INVENTORY_DIRECTORY_TABLE_REFERENCE = `${INVENTORY_DIRECTORY_BASE_ID}/${INVENTORY_DIRECTORY_TABLE_ID}`;

export type AirtableConfiguredRecordsSource =
  | 'users'
  | 'inventory-directory'
  | 'approval-ebay'
  | 'approval-shopify'
  | 'approval-combined';

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

  return {
    reference: INVENTORY_DIRECTORY_TABLE_REFERENCE,
    tableName: INVENTORY_DIRECTORY_TABLE_NAME,
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

  for (const source of ['approval-ebay', 'approval-shopify', 'approval-combined'] as const) {
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