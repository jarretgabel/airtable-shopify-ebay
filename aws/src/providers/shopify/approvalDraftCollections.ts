import type { ApprovalFieldMap } from './approvalDraftTypes.js';
import { coerceStructuredToString, getField, normalizeKey, parseJsonArray } from './approvalDraftFieldUtils.js';

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
    const candidate = record.collectionId ?? record.collection_id ?? record.collectionGid ?? record.collection_gid ?? record.admin_graphql_api_id ?? record.gid ?? record.id;
    if (typeof candidate === 'string' || typeof candidate === 'number') collectionIds.push(String(candidate));
  };

  const collectionIdCandidates = ['Collection', 'Collections', 'Shopify Collection', 'Shopify Collection ID', 'Shopify Collections', 'Shopify Collection IDs', 'Shopify GraphQL Collection ID', 'Shopify GraphQL Collection IDs', 'Shopify GraphQL Collections JSON', 'shopify_collection', 'shopify_collection_id', 'shopify_collections', 'shopify_collection_ids', 'shopify_graphql_collection_id', 'shopify_graphql_collection_ids', 'shopify_graphql_collections_json'];
  const normalizedLookup = new Map<string, unknown>();
  Object.entries(fields).forEach(([key, value]) => normalizedLookup.set(normalizeKey(key), value));
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
    collectionIds.push(...coerceStructuredToString(rawValue).split(/[\n,;|]/).map((token) => token.trim()).filter(Boolean));
  });
  for (let i = 1; i <= 25; i += 1) {
    const collectionId = getField(fields, [`Shopify GraphQL Collection ${i} ID`, `Shopify Collection ${i} ID`, `Collection ${i} ID`, `collection_${i}_id`, `shopify_graphql_collection_${i}_id`, `shopify_collection_${i}_id`]);
    if (collectionId) collectionIds.push(collectionId);
  }
  const seen = new Set<string>();
  return collectionIds.map(normalizeCollectionId).filter((collectionId) => {
    if (!collectionId) return false;
    const key = collectionId.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}