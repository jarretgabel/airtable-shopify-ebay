export const DEFAULT_USERS_TABLE_NAME = 'j2Gt9USORo6Vi5';
export const DEFAULT_APPROVAL_TABLE_REFERENCE = '3yTb0JkzUMFNnS/viw21kEduXKNub4Vn';
export const DEFAULT_COMBINED_LISTINGS_TABLE_NAME = 'tbl0K0nFQL64jQMx8';

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
  const envReference = (import.meta.env.VITE_AIRTABLE_USERS_TABLE_REF as string | undefined)?.trim();
  const envTableName = (import.meta.env.VITE_AIRTABLE_USERS_TABLE_NAME as string | undefined)?.trim();

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
      reference: (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim() || DEFAULT_APPROVAL_TABLE_REFERENCE,
      tableName:
        (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim()
        || (import.meta.env.VITE_AIRTABLE_TABLE_NAME as string | undefined)?.trim()
        || '',
    };
  }

  if (source === 'approval-shopify') {
    return {
      reference: (import.meta.env.VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF as string | undefined)?.trim(),
      tableName: (import.meta.env.VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME as string | undefined)?.trim() || '',
    };
  }

  if (source === 'approval-combined') {
    return {
      reference: (import.meta.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF as string | undefined)?.trim(),
      tableName: (import.meta.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME as string | undefined)?.trim() || DEFAULT_COMBINED_LISTINGS_TABLE_NAME,
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

    if (referenceMatches && tableMatches) {
      return source;
    }
  }

  return null;
}