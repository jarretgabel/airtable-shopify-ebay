import { getCollections, searchCollections, type ShopifyCollectionMatch } from './client.js';
import type { ApprovalFieldMap } from './approvalPreviewFieldResolvers.js';

function normalizeCollectionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const embeddedGidMatch = trimmed.match(/gid:\/\/shopify\/Collection\/\d+/i);
  if (embeddedGidMatch) return embeddedGidMatch[0];
  if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Collection/${trimmed}`;
  return '';
}

function parseShopifyCollectionDisplayNames(raw: unknown): string[] {
  const values: string[] = [];

  const parseEntry = (entry: unknown) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      values.push(String(entry));
      return;
    }

    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    const candidate = record.title ?? record.name ?? record.collectionTitle ?? record.collection_name;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      values.push(String(candidate));
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(parseEntry);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach(parseEntry);
      } else {
        values.push(...trimmed.split(/[\n,]/).map((token) => token.trim()).filter(Boolean));
      }
    } catch {
      values.push(...trimmed.split(/[\n,]/).map((token) => token.trim()).filter(Boolean));
    }
  }

  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(value)) return false;
      if (/^\d+$/.test(value)) return false;
      return true;
    })
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isCollectionCandidateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('collection') && !normalized.includes('product collection');
}

export async function resolveCollectionPreview(fields: ApprovalFieldMap, collectionIds: string[]): Promise<{
  collectionIds: string[];
  collectionLabelsById: Record<string, string>;
}> {
  const normalizedCollectionIds = Array.from(new Set(collectionIds.map((collectionId) => normalizeCollectionId(collectionId)).filter(Boolean)));
  const collectionLabelsById: Record<string, string> = {};

  if (normalizedCollectionIds.length > 0) {
    try {
      const collections = await getCollections(250);
      const collectionsById = new Map(collections.map((collection) => [collection.id.toLowerCase(), collection]));
      normalizedCollectionIds.forEach((collectionId) => {
        const match = collectionsById.get(collectionId.toLowerCase());
        if (match?.title) {
          collectionLabelsById[collectionId] = match.title;
        }
      });
    } catch {
      // Keep preview resilient when Shopify collection hydration fails.
    }

    return { collectionIds: normalizedCollectionIds, collectionLabelsById };
  }

  const displayNames = Object.entries(fields)
    .filter(([fieldName]) => isCollectionCandidateField(fieldName))
    .flatMap(([, value]) => parseShopifyCollectionDisplayNames(value));

  const seenNames = new Set<string>();
  const uniqueDisplayNames = displayNames.filter((value) => {
    const key = value.toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  if (uniqueDisplayNames.length === 0) {
    return { collectionIds: normalizedCollectionIds, collectionLabelsById };
  }

  const resolvedIds: string[] = [];
  await Promise.all(uniqueDisplayNames.map(async (name) => {
    try {
      const matches = await searchCollections(name, 25);
      const normalizedName = name.trim().toLowerCase();
      const exactMatch = matches.find((match) => match.title.trim().toLowerCase() === normalizedName);
      const chosen: ShopifyCollectionMatch | null = exactMatch ?? (matches.length === 1 ? matches[0] : null);
      if (!chosen) return;
      const collectionId = normalizeCollectionId(chosen.id);
      if (!collectionId) return;
      if (!resolvedIds.includes(collectionId)) {
        resolvedIds.push(collectionId);
      }
      collectionLabelsById[collectionId] = chosen.title;
    } catch {
      // Keep preview resilient; unresolved display names simply won't hydrate to IDs.
    }
  }));

  return {
    collectionIds: resolvedIds,
    collectionLabelsById,
  };
}