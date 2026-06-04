import { parseShopifyTagList, serializeShopifyTagsCsv } from '@/services/shopifyTags';
import type { ShopifyProduct } from '@/types/shopify';
import { getIncludedWorkflowImageMetadata, parseWorkflowImageMetadata } from '@/services/workflowImageMetadata';
import {
  ApprovalFieldMap,
  coerceStructuredToString,
  coerceToString,
  getField,
  getRawField,
  normalizeKey,
  parseJsonArray,
} from '@/services/shopifyDraftFromAirtable/shared';

export function buildImages(fields: ApprovalFieldMap): ShopifyProduct['images'] | undefined {
  const workflowMetadata = getIncludedWorkflowImageMetadata(parseWorkflowImageMetadata(getRawField(fields, [
    'Workflow Image Metadata JSON',
    'Workflow Image Metadata',
    'workflow_image_metadata_json',
    'workflow_image_metadata',
  ])));
  if (workflowMetadata.length > 0) {
    return workflowMetadata.map((record, index) => ({
      src: record.url,
      alt: record.alt,
      position: index + 1,
    }));
  }
  return undefined;
}

export function buildTags(fields: ApprovalFieldMap): string | undefined {
  const tagsFromSingles: string[] = [];

  for (let i = 1; i <= 10; i += 1) {
    const tag = getField(fields, [
      `Shopify REST Tag ${i}`,
      `Shopify Tag ${i}`,
      `Shopify GraphQL Tag ${i}`,
      `Shopify Extra Tag ${i}`,
      `shopify_rest_tag_${i}`,
    ]);
    if (tag) tagsFromSingles.push(...parseShopifyTagList(tag));
  }

  const compound = getRawField(fields, [
    'Shopify REST Tags',
    'Shopify Tags',
    'Shopify GraphQL Tags',
    'Shopify GraphQL Tags JSON',
    'Tags',
    'shopify_rest_tags',
    'shopify_tags',
    'shopify_graphql_tags',
    'shopify_graphql_tags_json',
    'tags',
  ]);
  const tagsFromCompound = parseShopifyTagList(compound);

  const serialized = serializeShopifyTagsCsv([...tagsFromSingles, ...tagsFromCompound]);
  return serialized.length > 0 ? serialized : undefined;
}

function normalizeCollectionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const embeddedGidMatch = trimmed.match(/gid:\/\/shopify\/Collection\/\d+/i);
  if (embeddedGidMatch) return embeddedGidMatch[0];
  if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Collection/${trimmed}`;
  return '';
}

export function buildShopifyCollectionIdsFromApprovalFields(fields: ApprovalFieldMap): string[] {
  const collectionIds: string[] = [];

  const pushCollectionCandidate = (entry: unknown) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      collectionIds.push(String(entry));
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
      collectionIds.push(String(candidate));
    }
  };

  const collectionIdCandidates = [
    'Collection',
    'Collections',
    'Shopify Collection',
    'Shopify Collection ID',
    'Shopify Collections',
    'Shopify Collection IDs',
    'Shopify GraphQL Collection ID',
    'Shopify GraphQL Collection IDs',
    'Shopify GraphQL Collections JSON',
    'shopify_collection',
    'shopify_collection_id',
    'shopify_collections',
    'shopify_collection_ids',
    'shopify_graphql_collection_id',
    'shopify_graphql_collection_ids',
    'shopify_graphql_collections_json',
  ];

  const normalizedLookup = new Map<string, unknown>();
  Object.entries(fields).forEach(([key, value]) => {
    normalizedLookup.set(normalizeKey(key), value);
  });

  collectionIdCandidates.forEach((candidateFieldName) => {
    const rawValue = fields[candidateFieldName] ?? normalizedLookup.get(normalizeKey(candidateFieldName));
    if (rawValue === null || rawValue === undefined) return;

    const parsedCompoundCollections = parseJsonArray<unknown>(rawValue);
    if (parsedCompoundCollections && parsedCompoundCollections.length > 0) {
      parsedCompoundCollections.forEach(pushCollectionCandidate);
      return;
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach(pushCollectionCandidate);
      return;
    }

    if (rawValue && typeof rawValue === 'object') {
      pushCollectionCandidate(rawValue);
      return;
    }

    const parsedDelimitedCollections = coerceStructuredToString(rawValue)
      .split(/[\n,;|]/)
      .map((token) => token.trim())
      .filter(Boolean);
    collectionIds.push(...parsedDelimitedCollections);
  });

  for (let i = 1; i <= 25; i += 1) {
    const collectionId = getField(fields, [
      `Shopify GraphQL Collection ${i} ID`,
      `Shopify Collection ${i} ID`,
      `Collection ${i} ID`,
      `collection_${i}_id`,
      `shopify_graphql_collection_${i}_id`,
      `shopify_collection_${i}_id`,
    ]);
    if (collectionId) collectionIds.push(collectionId);
  }

  const seen = new Set<string>();
  return collectionIds
    .map(normalizeCollectionId)
    .filter((collectionId) => {
      if (!collectionId) return false;
      const key = collectionId.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function sanitizeImages(images: ShopifyProduct['images'] | undefined): ShopifyProduct['images'] | undefined {
  if (!images || images.length === 0) return undefined;

  const sanitized = images
    .map((image, index) => ({
      src: coerceToString(image?.src),
      alt: coerceToString(image?.alt ?? ''),
      position: typeof image?.position === 'number' ? image.position : index + 1,
    }))
    .filter((image) => image.src.length > 0);

  return sanitized.length > 0 ? sanitized : undefined;
}