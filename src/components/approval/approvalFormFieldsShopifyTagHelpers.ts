import { parseShopifyTagList } from '@/services/shopifyTags';

export function isShopifyCompoundTagsField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest tags'
    || normalized === 'shopify tags'
    || normalized === 'shopify graphql tags'
    || normalized === 'shopify graphql tags json'
    || normalized === 'shopify_rest_tags'
    || normalized === 'shopify_tags'
    || normalized === 'shopify_graphql_tags'
    || normalized === 'shopify_graphql_tags_json'
    || normalized === 'tags';
}

export function isShopifySingleTagField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return /^shopify\s+(rest|graphql|extra)?\s*tag\s+\d+$/.test(normalized)
    || /^shopify_(rest|graphql|extra)?_tag_\d+$/.test(normalized);
}

export function getShopifySingleTagFieldIndex(fieldName: string): number {
  const normalized = fieldName.trim().toLowerCase();
  const match = normalized.match(/tag(?:_|\s+)(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function isShopifyTagsJsonField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('tags json') || normalized.endsWith('_tags_json');
}

function choosePreferredShopifyCompoundTagField(fieldNames: string[]): string | null {
  const preferredOrder = [
    'Tags',
    'tags',
    'Shopify REST Tags',
    'Shopify Tags',
    'shopify_rest_tags',
    'shopify_tags',
    'Shopify GraphQL Tags JSON',
    'shopify_graphql_tags_json',
    'Shopify GraphQL Tags',
    'shopify_graphql_tags',
  ];
  const lowerMap = new Map(fieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName]));
  for (const candidate of preferredOrder) {
    const match = lowerMap.get(candidate.toLowerCase());
    if (match) return match;
  }
  return fieldNames[0] ?? null;
}

export interface ShopifyTagFieldStrategy {
  sourceSingleFields: string[];
  sourceCompoundFields: string[];
  writeSingleFields: string[];
  writeCompoundFields: string[];
}

export function resolveShopifyTagFieldStrategy(params: {
  formValues: Record<string, string>;
  singleFieldNames: string[];
  compoundFieldNames: string[];
  writableFieldNames: string[];
}): ShopifyTagFieldStrategy {
  const { formValues, singleFieldNames, compoundFieldNames, writableFieldNames } = params;
  const writableLookup = new Set(writableFieldNames.map((fieldName) => fieldName.toLowerCase()));
  const writableSingles = singleFieldNames.filter((fieldName) => writableLookup.has(fieldName.toLowerCase()));
  const writableCompounds = compoundFieldNames.filter((fieldName) => writableLookup.has(fieldName.toLowerCase()));

  if (writableCompounds.length > 0) {
    const preferredCompound = choosePreferredShopifyCompoundTagField(writableCompounds) ?? writableCompounds[0];
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [preferredCompound],
    };
  }

  if (writableSingles.length > 0) {
    return {
      sourceSingleFields: writableSingles,
      sourceCompoundFields: [],
      writeSingleFields: writableSingles,
      writeCompoundFields: [],
    };
  }

  const singleFieldsWithValues = singleFieldNames.filter((fieldName) => parseShopifyTagList(formValues[fieldName] ?? '').length > 0);
  const compoundFieldsWithValues = compoundFieldNames.filter((fieldName) => parseShopifyTagList(formValues[fieldName] ?? '').length > 0);

  if (compoundFieldsWithValues.length > 0) {
    const preferredCompound = choosePreferredShopifyCompoundTagField(compoundFieldsWithValues) ?? compoundFieldsWithValues[0];
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [preferredCompound],
    };
  }

  if (singleFieldsWithValues.length > 0) {
    return {
      sourceSingleFields: singleFieldNames,
      sourceCompoundFields: [],
      writeSingleFields: singleFieldNames,
      writeCompoundFields: [],
    };
  }

  const preferredCompound = choosePreferredShopifyCompoundTagField(compoundFieldNames);
  if (preferredCompound) {
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [preferredCompound],
    };
  }

  return {
    sourceSingleFields: singleFieldNames,
    sourceCompoundFields: [],
    writeSingleFields: singleFieldNames,
    writeCompoundFields: [],
  };
}