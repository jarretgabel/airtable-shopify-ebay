export const SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD = 'Shopify GraphQL Collection IDs';

export function isShopifyCompoundCollectionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'collection'
    || normalized === 'collections'
    || normalized === 'shopify collection'
    || normalized === 'shopify collections'
    || normalized === 'shopify collection id'
    || normalized === 'shopify collection ids'
    || normalized === 'shopify graphql collection id'
    || normalized === 'shopify graphql collection ids'
    || normalized === 'shopify graphql collections json'
    || normalized === 'shopify_collection'
    || normalized === 'shopify_collections'
    || normalized === 'shopify_collection_id'
    || normalized === 'shopify_collection_ids'
    || normalized === 'shopify_graphql_collection_id'
    || normalized === 'shopify_graphql_collection_ids'
    || normalized === 'shopify_graphql_collections_json';
}

export function isShopifySingleCollectionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return /^shopify\s+graphql\s+collection\s+\d+\s+id$/.test(normalized)
    || /^shopify\s+collection\s+\d+\s+id$/.test(normalized)
    || /^collection\s+\d+\s+id$/.test(normalized)
    || /^shopify_graphql_collection_\d+_id$/.test(normalized)
    || /^shopify_collection_\d+_id$/.test(normalized)
    || /^collection_\d+_id$/.test(normalized);
}

export function getShopifySingleCollectionFieldIndex(fieldName: string): number {
  const normalized = fieldName.trim().toLowerCase();
  const match = normalized.match(/collection(?:_|\s+)(\d+)(?:_|\s+)id$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function normalizeShopifyCollectionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const embeddedGidMatch = trimmed.match(/gid:\/\/shopify\/Collection\/\d+/i);
  if (embeddedGidMatch) return embeddedGidMatch[0];
  if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Collection/${trimmed}`;
  return '';
}

export function parseShopifyCollectionIds(raw: unknown): string[] {
  const values: string[] = [];

  const parseEntry = (entry: unknown) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      values.push(String(entry));
      return;
    }

    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    const candidate = record.collectionId
      ?? record.collection_id
      ?? record.collectionGid
      ?? record.collection_gid
      ?? record.admin_graphql_api_id
      ?? record.gid
      ?? record.id;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      values.push(String(candidate));
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(parseEntry);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsed.forEach(parseEntry);
        } else {
          parseEntry(parsed);
          values.push(...trimmed.split(/[\n,;|]/).map((token) => token.trim()).filter(Boolean));
        }
      } catch {
        values.push(...trimmed.split(/[\n,;|]/).map((token) => token.trim()).filter(Boolean));
      }
    }
  }

  const seen = new Set<string>();
  return values
    .map(normalizeShopifyCollectionId)
    .filter((collectionId) => {
      if (!collectionId) return false;
      const key = collectionId.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function isShopifyCollectionJsonField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('collections json') || normalized.endsWith('_collections_json');
}

export function isSingularCollectionAliasField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'collection'
    || normalized === 'shopify collection'
    || normalized === 'shopify collection id'
    || normalized === 'shopify graphql collection id'
    || normalized === 'shopify_collection'
    || normalized === 'shopify_collection_id'
    || normalized === 'shopify_graphql_collection_id';
}

export function isCollectionDisplayNameField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'collections'
    || normalized === 'shopify collections'
    || normalized === 'shopify_collections';
}

function choosePreferredShopifyCompoundCollectionField(fieldNames: string[]): string | null {
  const preferredOrder = [
    'Collections',
    'Shopify Collection IDs',
    'Shopify GraphQL Collection IDs',
    'Shopify GraphQL Collections JSON',
    'shopify_collection_ids',
    'shopify_graphql_collection_ids',
    'shopify_graphql_collections_json',
  ];

  const lowerMap = new Map(fieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName]));
  for (const candidate of preferredOrder) {
    const match = lowerMap.get(candidate.toLowerCase());
    if (match) return match;
  }

  return fieldNames[0] ?? null;
}

function choosePreferredShopifyDisplayCollectionField(fieldNames: string[]): string | null {
  const preferredOrder = ['Collections'];
  const lowerMap = new Map(fieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName]));
  for (const candidate of preferredOrder) {
    const match = lowerMap.get(candidate.toLowerCase());
    if (match) return match;
  }
  return fieldNames[0] ?? null;
}

function choosePreferredShopifyIdCollectionField(fieldNames: string[]): string | null {
  const preferredOrder = [
    'Shopify Collection IDs',
    'Shopify GraphQL Collection IDs',
    'Shopify GraphQL Collections JSON',
    'shopify_collection_ids',
    'shopify_graphql_collection_ids',
    'shopify_graphql_collections_json',
  ];
  const lowerMap = new Map(fieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName]));
  for (const candidate of preferredOrder) {
    const match = lowerMap.get(candidate.toLowerCase());
    if (match) return match;
  }
  return fieldNames[0] ?? null;
}

export interface ShopifyCollectionFieldStrategy {
  sourceSingleFields: string[];
  sourceCompoundFields: string[];
  writeSingleFields: string[];
  writeCompoundFields: string[];
}

export function resolveShopifyCollectionFieldStrategy(params: {
  formValues: Record<string, string>;
  singleFieldNames: string[];
  compoundFieldNames: string[];
  writableFieldNames: string[];
}): ShopifyCollectionFieldStrategy {
  const { formValues, singleFieldNames, compoundFieldNames, writableFieldNames } = params;
  const writableLookup = new Set(writableFieldNames.map((fieldName) => fieldName.toLowerCase()));
  const writableSingles = singleFieldNames.filter((fieldName) => !isSingularCollectionAliasField(fieldName) && writableLookup.has(fieldName.toLowerCase()));
  const writableCompounds = compoundFieldNames.filter((fieldName) => !isSingularCollectionAliasField(fieldName) && writableLookup.has(fieldName.toLowerCase()));
  const writableDisplayCompounds = writableCompounds.filter((fieldName) => isCollectionDisplayNameField(fieldName));
  const writableIdCompounds = writableCompounds.filter((fieldName) => !isCollectionDisplayNameField(fieldName));

  if (writableCompounds.length > 0) {
    const preferredDisplayCompound = choosePreferredShopifyDisplayCollectionField(writableDisplayCompounds);
    const preferredIdCompound = choosePreferredShopifyIdCollectionField(writableIdCompounds);
    const orderedWritableCompounds = Array.from(new Set([
      preferredDisplayCompound,
      preferredIdCompound,
      ...writableCompounds,
    ].filter((fieldName): fieldName is string => Boolean(fieldName))));

    return {
      sourceSingleFields: singleFieldNames,
      sourceCompoundFields: compoundFieldNames,
      writeSingleFields: writableSingles,
      writeCompoundFields: orderedWritableCompounds,
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

  const singleFieldsWithValues = singleFieldNames.filter((fieldName) => parseShopifyCollectionIds(formValues[fieldName] ?? '').length > 0);
  const compoundFieldsWithValues = compoundFieldNames.filter((fieldName) => parseShopifyCollectionIds(formValues[fieldName] ?? '').length > 0);

  if (compoundFieldsWithValues.length > 0) {
    const preferredCompound = choosePreferredShopifyCompoundCollectionField(compoundFieldsWithValues) ?? compoundFieldsWithValues[0];
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

  const canonicalCollectionsField = compoundFieldNames.find((fieldName) => fieldName.trim().toLowerCase() === 'collections') ?? 'Collections';
  const preferredCompound = choosePreferredShopifyCompoundCollectionField(compoundFieldNames);
  if (preferredCompound) {
    return {
      sourceSingleFields: [],
      sourceCompoundFields: [preferredCompound],
      writeSingleFields: [],
      writeCompoundFields: [canonicalCollectionsField],
    };
  }

  return {
    sourceSingleFields: singleFieldNames,
    sourceCompoundFields: [],
    writeSingleFields: singleFieldNames,
    writeCompoundFields: [canonicalCollectionsField],
  };
}