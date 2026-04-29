import { parseShopifyTagList, serializeShopifyTagsCsv } from '@/services/shopifyTags';
import type { ShopifyProduct } from '@/types/shopify';
import {
  ApprovalFieldMap,
  coerceStructuredToString,
  coerceToString,
  getField,
  getRawField,
  normalizeKey,
  parseInteger,
  parseJsonArray,
} from '@/services/shopifyDraftFromAirtable/shared';

function parseImageAltTextList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const value = (item as Record<string, unknown>).alt;
          return typeof value === 'string' ? value.trim() : '';
        }
        return '';
      })
      .filter((value) => value.length > 0);
  }

  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const parsed = parseJsonArray<unknown>(trimmed);
  if (parsed) return parseImageAltTextList(parsed);

  return trimmed.split(/[\n,]/).map((value) => value.trim()).filter((value) => value.length > 0);
}

function getStructuredImageSource(image: Record<string, unknown>): string {
  const directSource = typeof image.src === 'string' ? image.src.trim() : '';
  if (directSource) return directSource;

  const directUrl = typeof image.url === 'string' ? image.url.trim() : '';
  if (directUrl) return directUrl;

  const originalSource = typeof image.originalSource === 'string'
    ? image.originalSource.trim()
    : typeof image.original_source === 'string'
      ? image.original_source.trim()
      : '';
  if (originalSource) return originalSource;

  const thumbnailLarge = image.thumbnails
    && typeof image.thumbnails === 'object'
    && (image.thumbnails as Record<string, unknown>).large
    && typeof (image.thumbnails as Record<string, unknown>).large === 'object'
      ? ((image.thumbnails as Record<string, unknown>).large as Record<string, unknown>).url
      : '';

  return typeof thumbnailLarge === 'string' ? thumbnailLarge.trim() : '';
}

export function buildImages(fields: ApprovalFieldMap): ShopifyProduct['images'] | undefined {
  const imageAltTexts = parseImageAltTextList(getRawField(fields, [
    'Images Alt Text',
    'Images Alt Text (comma separated)',
    'Images Alt Text (comma-separated)',
    'Image Alt Text',
    'images_alt_text',
    'image_alt_text',
  ]));

  const rawImages = getRawField(fields, [
    'Shopify REST Images JSON',
    'Shopify Images JSON',
    'shopify_rest_images_json',
    'shopify_images_json',
    'Shopify REST Images',
    'Shopify Images',
    'shopify_rest_images',
    'shopify_images',
    'Images',
    'Images (comma separated)',
    'Images (comma-separated)',
    'images',
    'Image URL',
    'Image URLs',
    'Image-URL',
    'Image-URLs',
    'image_url',
    'image_urls',
  ]);
  const imagesJson = parseJsonArray<unknown>(rawImages);
  if (imagesJson && imagesJson.length > 0) {
    const normalizedImages = imagesJson
      .map((item, index) => {
        if (typeof item === 'string') {
          const src = item.trim();
          if (!src) return null;
          return { src, alt: imageAltTexts[index] ?? '', position: index + 1 };
        }

        if (!item || typeof item !== 'object') return null;
        const image = item as Record<string, unknown>;
        const src = getStructuredImageSource(image);
        if (!src) return null;

        const rawAlt = image.alt;
        const altFromImage = typeof rawAlt === 'string'
          ? rawAlt
          : typeof image.altText === 'string'
            ? image.altText
            : typeof image.alt_text === 'string'
              ? image.alt_text
              : '';
        const alt = imageAltTexts[index] ?? altFromImage;
        const rawPosition = image.position;
        const position = typeof rawPosition === 'number' && Number.isFinite(rawPosition)
          ? rawPosition
          : index + 1;

        return { src, alt, position };
      })
      .filter((image): image is { src: string; alt: string; position: number } => image !== null);

    if (normalizedImages.length > 0) return normalizedImages;
  }

  if (typeof rawImages === 'string' && rawImages.trim()) {
    const parts = rawImages.trim().split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts.map((url, i) => ({ src: url, alt: imageAltTexts[i] ?? '', position: i + 1 }));
    }
  }

  const images: NonNullable<ShopifyProduct['images']> = [];
  for (let i = 1; i <= 10; i += 1) {
    const src = getField(fields, [
      `Shopify REST Image ${i} Src`,
      `Shopify Image ${i} Src`,
      `Shopify GraphQL Media ${i} Original Source`,
      `Shopify Extra Media ${i} Original Source`,
      `shopify_rest_image_${i}_src`,
    ]);
    if (!src) continue;

    images.push({
      src,
      alt: getField(fields, [
        `Shopify REST Image ${i} Alt`,
        `Shopify Image ${i} Alt`,
        `Shopify GraphQL Media ${i} Alt`,
        `Shopify Extra Media ${i} Alt`,
        `shopify_rest_image_${i}_alt`,
      ]) || imageAltTexts[i - 1] || undefined,
      position: parseInteger(getField(fields, [`Shopify REST Image ${i} Position`, `shopify_rest_image_${i}_position`])),
    });
  }

  return images.length > 0 ? images : undefined;
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