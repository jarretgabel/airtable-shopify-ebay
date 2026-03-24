import { useEffect, useMemo, useRef, useState } from 'react';

import {
  CONDITION_FIELD,
  getDropdownOptions,
  isAllowOffersField,
  isShippingServiceField,
  SHIPPING_SERVICE_FIELD,
  SHIPPING_SERVICE_OPTIONS,
} from '@/stores/approvalStore';
import { shopifyService } from '@/services/shopify';
import { buildShopifyBodyHtml } from '@/services/shopifyBodyHtml';
import { buildShopifyCollectionIdsFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
import { parseShopifyTagList, serializeShopifyTagsCsv, serializeShopifyTagsJson } from '@/services/shopifyTags';
import { ImageUrlListEditor } from './ImageUrlListEditor';
import { ShopifyTaxonomyTypeSelect } from './ShopifyTaxonomyTypeSelect';
import { ShopifyBodyHtmlPreview } from './ShopifyBodyHtmlPreview';
import { ShopifyKeyFeaturesEditor } from './ShopifyKeyFeaturesEditor';
import { ShopifyCollectionsSelect } from './ShopifyCollectionsSelect';
import { ShopifyTagsEditor } from './ShopifyTagsEditor';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const requiredBadgeClass = 'inline-block rounded-full border border-rose-400/45 bg-rose-500/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-rose-200';
const SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD = 'Shopify GraphQL Collection IDs';

function toHumanReadableLabel(fieldName: string): string {
  if (fieldName === CONDITION_FIELD) return 'Condition';

  const withSpaces = fieldName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withSpaces) return fieldName;

  return withSpaces
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z0-9]+$/.test(word)) return word;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function isReadOnlyApprovalField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest product id' || normalized === 'shopify product id';
}

function isShopifyTypeField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === 'type';
}

function isShopifyCompoundTagsField(fieldName: string): boolean {
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

function isShopifySingleTagField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return /^shopify\s+(rest|graphql|extra)?\s*tag\s+\d+$/.test(normalized)
    || /^shopify_(rest|graphql|extra)?_tag_\d+$/.test(normalized);
}

function isShopifyCompoundCollectionField(fieldName: string): boolean {
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

function isShopifySingleCollectionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return /^shopify\s+graphql\s+collection\s+\d+\s+id$/.test(normalized)
    || /^shopify\s+collection\s+\d+\s+id$/.test(normalized)
    || /^collection\s+\d+\s+id$/.test(normalized)
    || /^shopify_graphql_collection_\d+_id$/.test(normalized)
    || /^shopify_collection_\d+_id$/.test(normalized)
    || /^collection_\d+_id$/.test(normalized);
}

function getShopifySingleCollectionFieldIndex(fieldName: string): number {
  const normalized = fieldName.trim().toLowerCase();
  const match = normalized.match(/collection(?:_|\s+)(\d+)(?:_|\s+)id$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizeShopifyCollectionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const embeddedGidMatch = trimmed.match(/gid:\/\/shopify\/Collection\/\d+/i);
  if (embeddedGidMatch) return embeddedGidMatch[0];
  if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Collection/${trimmed}`;
  return '';
}

function parseShopifyCollectionIds(raw: unknown): string[] {
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
      // Ignore values that are clearly collection IDs; display-name hydration should only search by labels.
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

function isShopifyCollectionJsonField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('collections json') || normalized.endsWith('_collections_json');
}

function isSingularCollectionAliasField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'collection'
    || normalized === 'shopify collection'
    || normalized === 'shopify collection id'
    || normalized === 'shopify graphql collection id'
    || normalized === 'shopify_collection'
    || normalized === 'shopify_collection_id'
    || normalized === 'shopify_graphql_collection_id';
}

function isCollectionDisplayNameField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify collections'
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
  const preferredOrder = [
    'Collections',
  ];

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

interface ShopifyCollectionFieldStrategy {
  sourceSingleFields: string[];
  sourceCompoundFields: string[];
  writeSingleFields: string[];
  writeCompoundFields: string[];
}

function resolveShopifyCollectionFieldStrategy(params: {
  formValues: Record<string, string>;
  singleFieldNames: string[];
  compoundFieldNames: string[];
  writableFieldNames: string[];
}): ShopifyCollectionFieldStrategy {
  const { formValues, singleFieldNames, compoundFieldNames, writableFieldNames } = params;
  const writableLookup = new Set(writableFieldNames.map((fieldName) => fieldName.toLowerCase()));
  const writableSingles = singleFieldNames.filter((fieldName) => {
    if (!writableLookup.has(fieldName.toLowerCase())) return false;
    return !isSingularCollectionAliasField(fieldName);
  });
  const writableCompounds = compoundFieldNames.filter((fieldName) => {
    if (!writableLookup.has(fieldName.toLowerCase())) return false;
    return !isSingularCollectionAliasField(fieldName);
  });
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
    const preferredCompound = choosePreferredShopifyCompoundCollectionField(compoundFieldsWithValues)
      ?? compoundFieldsWithValues[0];
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

function getShopifySingleTagFieldIndex(fieldName: string): number {
  const normalized = fieldName.trim().toLowerCase();
  const match = normalized.match(/tag(?:_|\s+)(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function isShopifyTagsJsonField(fieldName: string): boolean {
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

interface ShopifyTagFieldStrategy {
  sourceSingleFields: string[];
  sourceCompoundFields: string[];
  writeSingleFields: string[];
  writeCompoundFields: string[];
}

function resolveShopifyTagFieldStrategy(params: {
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
    const preferredCompound = choosePreferredShopifyCompoundTagField(writableCompounds)
      ?? writableCompounds[0];
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
    const preferredCompound = choosePreferredShopifyCompoundTagField(compoundFieldsWithValues)
      ?? compoundFieldsWithValues[0];
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

function isShopifyBodyHtmlField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html'
    || normalized === 'shopify body html'
    || normalized === 'shopify graphql description html'
    || normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'shopify_rest_body_html'
    || normalized === 'shopify rest body html template'
    || normalized === 'shopify body html template'
    || normalized === 'shopify_rest_body_html_template'
    || normalized === 'shopify_body_html_template';
}

function isShopifyBodyDescriptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify body description'
    || normalized === 'shopify rest body description'
    || normalized === 'item description'
    || normalized === 'description'
    || normalized === 'shopify_body_description'
    || normalized === 'shopify_rest_body_description';
}

function isShopifyKeyFeaturesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'shopify body key features'
    || normalized === 'shopify rest body key features'
    || normalized === 'shopify body key features json'
    || normalized === 'shopify rest body key features json'
    || normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json'
    || normalized === 'shopify_body_key_features'
    || normalized === 'shopify_rest_body_key_features'
    || normalized === 'shopify_body_key_features_json'
    || normalized === 'shopify_rest_body_key_features_json') {
    return true;
  }

  const squashed = normalized.replace(/[^a-z0-9]/g, '');
  return squashed.includes('keyfeature')
    || squashed.includes('keyvaluepair')
    || squashed.includes('featurevaluepair')
    || squashed.includes('featurepairs')
    || squashed.includes('keypairs');
}

function isShopifyBodyHtmlPrimaryField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html'
    || normalized === 'shopify body html'
    || normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'shopify_rest_body_html';
}

function isShopifyBodyHtmlTemplateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html template'
    || normalized === 'shopify body html template'
    || normalized === 'shopify_rest_body_html_template'
    || normalized === 'shopify_body_html_template';
}

function isLegacyShopifySingleImageField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();

  // Human-readable naming variants from Airtable templates.
  if (/^shopify\s+rest\s+image(\s+\d+)?\s+(src|position|alt|alt\s+text)$/.test(normalized)) return true;

  // API-style snake_case naming variants.
  if (/^shopify_rest_image(_\d+)?_(src|position|alt|alt_text)$/.test(normalized)) return true;

  // Generic legacy image position fields that should not be edited directly.
  if (normalized === 'image position' || normalized === 'image_position') return true;
  if (/^image\s+position\s+\d+$/.test(normalized)) return true;
  if (/^image_position_\d+$/.test(normalized)) return true;
  if (/^image\s+\d+\s+position$/.test(normalized)) return true;
  if (/^image_\d+_position$/.test(normalized)) return true;

  // Generic legacy image alt fields that should not be edited directly.
  if (normalized === 'image alt' || normalized === 'image_alt') return true;
  if (normalized === 'image alt text' || normalized === 'image_alt_text') return true;
  if (/^image\s+alt\s+\d+$/.test(normalized)) return true;
  if (/^image_alt_\d+$/.test(normalized)) return true;
  if (/^image\s+alt\s+text\s+\d+$/.test(normalized)) return true;
  if (/^image_alt_text_\d+$/.test(normalized)) return true;
  if (/^image\s+\d+\s+alt$/.test(normalized)) return true;
  if (/^image_\d+_alt$/.test(normalized)) return true;
  if (/^image\s+\d+\s+alt\s+text$/.test(normalized)) return true;
  if (/^image_\d+_alt_text$/.test(normalized)) return true;

  return false;
}

function isHiddenApprovalField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest product id'
    || normalized === 'shopify product id'
    || normalized === 'shopify rest vendor'
    || normalized === 'shopify vendor'
    || normalized === 'vendor'
    || normalized === 'published'
    || normalized === 'shopify published'
    || normalized === 'shopify rest published at'
    || normalized === 'shopify published at'
    || normalized === 'shopify rest published scope'
    || normalized === 'shopify published scope'
    || isLegacyShopifySingleImageField(fieldName);
}

function isBooleanLikeValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'false';
}

function isGenericImageUrlField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'image url'
    || normalized === 'image urls'
    || normalized === 'image-url'
    || normalized === 'image-urls'
    || normalized === 'image_url'
    || normalized === 'image_urls'
    || /^image\s+url\s+\d+$/.test(normalized)
    || /^image\s+urls\s+\d+$/.test(normalized)
    || /^image-url-\d+$/.test(normalized)
    || /^image-urls-\d+$/.test(normalized)
    || /^image_url_\d+$/.test(normalized)
    || /^image_urls_\d+$/.test(normalized)
    || /^image\s+\d+\s+url$/.test(normalized)
    || /^image\s+\d+\s+urls$/.test(normalized)
    || /^image-\d+-url$/.test(normalized)
    || /^image-\d+-urls$/.test(normalized)
    || /^image_\d+_url$/.test(normalized)
    || /^image_\d+_urls$/.test(normalized);
}

function isGenericImagePositionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'image position'
    || normalized === 'image_position'
    || /^image\s+position\s+\d+$/.test(normalized)
    || /^image_position_\d+$/.test(normalized)
    || /^image\s+\d+\s+position$/.test(normalized)
    || /^image_\d+_position$/.test(normalized);
}

function isGenericImageAltField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'image alt'
    || normalized === 'image_alt'
    || normalized === 'image alt text'
    || normalized === 'image_alt_text'
    || /^image\s+alt\s+\d+$/.test(normalized)
    || /^image_alt_\d+$/.test(normalized)
    || /^image\s+alt\s+text\s+\d+$/.test(normalized)
    || /^image_alt_text_\d+$/.test(normalized)
    || /^image\s+\d+\s+alt$/.test(normalized)
    || /^image_\d+_alt$/.test(normalized)
    || /^image\s+\d+\s+alt\s+text$/.test(normalized)
    || /^image_\d+_alt_text$/.test(normalized);
}

function isGenericImageScalarField(fieldName: string): boolean {
  return isGenericImageUrlField(fieldName)
    || isGenericImagePositionField(fieldName)
    || isGenericImageAltField(fieldName);
}

/**
 * Returns true for fields that store a list of image URLs — either as a
 * JSON array of strings or as a JSON array of Shopify image objects { src, alt, position }.
 * These fields get the drag-and-droppable ImageUrlListEditor instead of a textarea.
 */
function isImageUrlListField(fieldName: string): boolean {
  const n = fieldName.trim().toLowerCase();
  // Shopify REST/GraphQL images JSON  (e.g. "Shopify REST Images JSON", "shopify_rest_images_json")
  if (/shopify\s*(rest|graphql)?\s*images?\s*json/.test(n)) return true;
  if (n === 'shopify_rest_images_json' || n === 'shopify_images_json') return true;

  // Shopify list-style images fields without explicit "JSON" suffix.
  if (n === 'shopify rest images' || n === 'shopify images') return true;
  if (n === 'shopify_rest_images' || n === 'shopify_images') return true;

  // Generic Airtable field used by the Shopify listing detail page.
  // Value is commonly a comma-separated list that ImageUrlListEditor can parse.
  if (isGenericImageUrlField(fieldName)) return true;

  // eBay inventory product image URLs JSON
  if (/ebay\s*inventory\s*product\s*image\s*url/.test(n)) return true;
  if (n === 'ebay_inventory_product_imageurls_json') return true;
  return false;
}

interface ApprovalFormFieldsProps {
  recordId?: string;
  forceShowShopifyCollectionsEditor?: boolean;
  allFieldNames: string[];
  writableFieldNames?: string[];
  requiredFieldNames?: string[];
  approvedFieldName: string;
  formValues: Record<string, string>;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  listingFormatOptions: string[];
  saving: boolean;
  setFormValue: (fieldName: string, value: string) => void;
  suppressImageScalarFields?: boolean;
  originalFieldValues?: Record<string, string>;
  showBodyHtmlPreview?: boolean;
  onBodyHtmlPreviewChange?: (value: string) => void;
}

function isScalarImageField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (!normalized.includes('image')) return false;
  if (isImageUrlListField(fieldName)) return false;
  return /(url|src|position|alt|alt\s+text|alt_text)/.test(normalized);
}

function isConditionMirrorSourceField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'item condition'
    || normalized === 'condition'
    || normalized === 'shopify condition'
    || normalized === 'shopify rest condition'
    || normalized === 'ebay inventory condition';
}

function isTitleLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('title');
}

function isPriceLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('price');
}

function prioritizeTitleBeforePrice(fieldNames: string[]): string[] {
  return [...fieldNames].sort((left, right) => {
    const leftIsTitle = isTitleLikeField(left);
    const rightIsTitle = isTitleLikeField(right);
    const leftIsPrice = isPriceLikeField(left);
    const rightIsPrice = isPriceLikeField(right);

    if (leftIsTitle && rightIsPrice) return -1;
    if (leftIsPrice && rightIsTitle) return 1;
    return 0;
  });
}

export function ApprovalFormFields({
  recordId,
  forceShowShopifyCollectionsEditor = false,
  allFieldNames,
  writableFieldNames = [],
  requiredFieldNames = [],
  approvedFieldName,
  formValues,
  fieldKinds,
  listingFormatOptions,
  saving,
  setFormValue,
  suppressImageScalarFields = false,
  originalFieldValues = {},
  showBodyHtmlPreview = true,
  onBodyHtmlPreviewChange,
}: ApprovalFormFieldsProps) {
  const requiredFieldNameSet = useMemo(
    () => new Set(requiredFieldNames.map((fieldName) => fieldName.toLowerCase())),
    [requiredFieldNames],
  );

  const isRequiredField = (fieldName: string): boolean => requiredFieldNameSet.has(fieldName.toLowerCase());
  const orderedFieldNames = useMemo(() => {
    const required = prioritizeTitleBeforePrice(allFieldNames.filter((fieldName) => isRequiredField(fieldName)));
    const optional = prioritizeTitleBeforePrice(allFieldNames.filter((fieldName) => !isRequiredField(fieldName)));
    return [...required, ...optional];
  }, [allFieldNames, requiredFieldNameSet]);
  const toFieldLabel = (fieldName: string): string => {
    const baseLabel = toHumanReadableLabel(fieldName);
    return baseLabel;
  };
  const getInputClassName = (fieldName: string, extra?: string): string => {
    const requiredInputClass = isRequiredField(fieldName)
      ? 'border-rose-400/45 bg-rose-500/5 focus:border-rose-300'
      : '';

    return [inputBaseClass, requiredInputClass, extra].filter(Boolean).join(' ');
  };
  const renderFieldLabel = (fieldName: string): JSX.Element => (
    <span className={`${labelClass} flex items-center gap-2`}>
      <span>{toFieldLabel(fieldName)}</span>
      {isRequiredField(fieldName) && <span className={requiredBadgeClass}>Required</span>}
    </span>
  );

  const imageUrlSourceField = allFieldNames.find((fieldName) => isGenericImageUrlField(fieldName));
  const hasCanonicalConditionField = allFieldNames.some((fieldName) => fieldName.trim().toLowerCase() === CONDITION_FIELD.toLowerCase());
  const shopifyBodyDescriptionFieldName = allFieldNames.find((fieldName) => isShopifyBodyDescriptionField(fieldName));
  const shopifyKeyFeaturesFieldName = allFieldNames.find((fieldName) => isShopifyKeyFeaturesField(fieldName));
  const shopifyBodyHtmlFieldName = allFieldNames.find((fieldName) => isShopifyBodyHtmlPrimaryField(fieldName));
  const shopifyBodyHtmlTemplateFieldName = allFieldNames.find((fieldName) => isShopifyBodyHtmlTemplateField(fieldName));
  const shopifyCompoundTagFieldNames = useMemo(
    () => allFieldNames.filter((fieldName) => isShopifyCompoundTagsField(fieldName)),
    [allFieldNames],
  );
  const shopifySingleTagFieldNames = useMemo(
    () => allFieldNames
      .filter((fieldName) => isShopifySingleTagField(fieldName))
      .sort((left, right) => getShopifySingleTagFieldIndex(left) - getShopifySingleTagFieldIndex(right)),
    [allFieldNames],
  );
  const shopifyTagStrategy = useMemo(
    () => resolveShopifyTagFieldStrategy({
      formValues,
      singleFieldNames: shopifySingleTagFieldNames,
      compoundFieldNames: shopifyCompoundTagFieldNames,
      writableFieldNames,
    }),
    [formValues, shopifyCompoundTagFieldNames, shopifySingleTagFieldNames, writableFieldNames],
  );
  const hasShopifyTagEditor = shopifyCompoundTagFieldNames.length > 0 || shopifySingleTagFieldNames.length > 0;
  const shopifyTagValues = useMemo(() => {
    const compoundTags = shopifyTagStrategy.sourceCompoundFields.flatMap((fieldName) => parseShopifyTagList(formValues[fieldName] ?? ''));
    const singleTags = shopifyTagStrategy.sourceSingleFields.flatMap((fieldName) => parseShopifyTagList(formValues[fieldName] ?? ''));
    return parseShopifyTagList([...singleTags, ...compoundTags]);
  }, [formValues, shopifyTagStrategy.sourceCompoundFields, shopifyTagStrategy.sourceSingleFields]);

  const shopifyCompoundCollectionFieldNames = useMemo(
    () => allFieldNames.filter((fieldName) => isShopifyCompoundCollectionField(fieldName)),
    [allFieldNames],
  );
  const shopifySingleCollectionFieldNames = useMemo(
    () => allFieldNames
      .filter((fieldName) => isShopifySingleCollectionField(fieldName))
      .sort((left, right) => getShopifySingleCollectionFieldIndex(left) - getShopifySingleCollectionFieldIndex(right)),
    [allFieldNames],
  );
  const shopifyCollectionStrategy = useMemo(
    () => resolveShopifyCollectionFieldStrategy({
      formValues,
      singleFieldNames: shopifySingleCollectionFieldNames,
      compoundFieldNames: shopifyCompoundCollectionFieldNames,
      writableFieldNames,
    }),
    [formValues, shopifyCompoundCollectionFieldNames, shopifySingleCollectionFieldNames, writableFieldNames],
  );
  const hasShopifyCollectionEditor = forceShowShopifyCollectionsEditor
    || shopifyCompoundCollectionFieldNames.length > 0
    || shopifySingleCollectionFieldNames.length > 0;
  const shopifyCollectionSourceFieldNames = useMemo(
    () => Array.from(new Set([
      ...shopifyCompoundCollectionFieldNames,
      ...shopifySingleCollectionFieldNames,
      SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
    ])),
    [shopifyCompoundCollectionFieldNames, shopifySingleCollectionFieldNames],
  );
  const shopifyCollectionIds = useMemo(() => {
    const collectionSourceFields = Object.fromEntries(
      shopifyCollectionSourceFieldNames.map((fieldName) => [fieldName, formValues[fieldName] ?? '']),
    );
    return buildShopifyCollectionIdsFromApprovalFields(collectionSourceFields);
  }, [formValues, shopifyCollectionSourceFieldNames]);
  const shopifyCollectionDisplayNames = useMemo(() => {
    return shopifyCollectionSourceFieldNames
      .flatMap((fieldName) => {
        const rawValue = formValues[fieldName] ?? '';
        const parsedNames = parseShopifyCollectionDisplayNames(rawValue);
        if (parsedNames.length === 0) return [];

        // Some schemas use singular "Collection" for IDs and others for display names.
        // Keep names only when this field is explicitly display-oriented or currently has no parseable IDs.
        if (!isCollectionDisplayNameField(fieldName) && parseShopifyCollectionIds(rawValue).length > 0) {
          return [];
        }

        return parsedNames;
      });
  }, [formValues, shopifyCollectionSourceFieldNames]);
  const [collectionEditorFallbackIds, setCollectionEditorFallbackIds] = useState<string[]>([]);
  const [collectionEditorLabelsById, setCollectionEditorLabelsById] = useState<Record<string, string>>({});
  const collectionHydrationAttemptKeyRef = useRef<string>('');
  const effectiveShopifyCollectionIds = shopifyCollectionIds.length > 0
    ? shopifyCollectionIds
    : collectionEditorFallbackIds;

  const shopifyCollectionDisplayNamesKey = useMemo(
    () => `${recordId ?? ''}::${shopifyCollectionDisplayNames.map((name) => name.trim().toLowerCase()).filter(Boolean).join('|')}`,
    [recordId, shopifyCollectionDisplayNames],
  );

  useEffect(() => {
    collectionHydrationAttemptKeyRef.current = '';
    setCollectionEditorFallbackIds([]);
    setCollectionEditorLabelsById({});
  }, [recordId]);

  useEffect(() => {
    if (shopifyCollectionIds.length > 0) {
      setCollectionEditorFallbackIds(shopifyCollectionIds);
    }
  }, [shopifyCollectionIds]);

  useEffect(() => {
    if (shopifyCollectionIds.length > 0 || shopifyCollectionDisplayNames.length === 0) return;

    const attemptKey = shopifyCollectionDisplayNamesKey;
    if (!attemptKey || collectionHydrationAttemptKeyRef.current === attemptKey) return;
    collectionHydrationAttemptKeyRef.current = attemptKey;

    let cancelled = false;
    void (async () => {
      const resolvedIds: string[] = [];
      const resolvedLabels: Record<string, string> = {};

      for (const name of shopifyCollectionDisplayNames) {
        try {
          const matches = await shopifyService.searchCollections(name, 25);
          const normalizedName = name.trim().toLowerCase();
          const exactMatch = matches.find((match) => match.title.trim().toLowerCase() === normalizedName);
          const chosen = exactMatch ?? (matches.length === 1 ? matches[0] : null);
          if (!chosen) continue;
          if (!resolvedIds.includes(chosen.id)) {
            resolvedIds.push(chosen.id);
          }
          resolvedLabels[chosen.id] = chosen.title;
        } catch {
          // Keep hydration resilient; unresolved names remain in the Collections text field.
        }
      }

      if (cancelled || resolvedIds.length === 0) return;
      setCollectionEditorFallbackIds(resolvedIds);
      setCollectionEditorLabelsById((current) => ({ ...current, ...resolvedLabels }));

      const nextPreviewValue = JSON.stringify(resolvedIds);
      if ((formValues[SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD] ?? '') !== nextPreviewValue) {
        setFormValue(SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD, nextPreviewValue);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formValues, setFormValue, shopifyCollectionDisplayNames, shopifyCollectionDisplayNamesKey, shopifyCollectionIds.length]);

  function setShopifyTagValues(nextTags: string[]) {
    const normalizedTags = parseShopifyTagList(nextTags);

    shopifyTagStrategy.writeSingleFields.forEach((fieldName, index) => {
      setFormValue(fieldName, normalizedTags[index] ?? '');
    });

    shopifyTagStrategy.writeCompoundFields.forEach((fieldName) => {
      const fieldKind = fieldKinds[fieldName] ?? 'text';
      setFormValue(
        fieldName,
        normalizedTags.length === 0
          ? ''
          : fieldKind === 'json' || isShopifyTagsJsonField(fieldName)
          ? serializeShopifyTagsJson(normalizedTags)
          : serializeShopifyTagsCsv(normalizedTags),
      );
    });
  }

  function setShopifyCollectionIds(nextCollectionIds: string[], collectionLabelsById: Record<string, string> = {}) {
    const normalizedCollections = parseShopifyCollectionIds(nextCollectionIds);
    setCollectionEditorFallbackIds(normalizedCollections);
    const canonicalCollectionsFieldName = allFieldNames.find((fieldName) => fieldName.trim().toLowerCase() === 'collections') ?? 'Collections';

    const effectiveCollectionLabelsById: Record<string, string> = {
      ...collectionEditorLabelsById,
      ...collectionLabelsById,
    };
    setCollectionEditorLabelsById(effectiveCollectionLabelsById);

    const normalizedCollectionLabels = normalizedCollections
      .map((collectionId) => effectiveCollectionLabelsById[collectionId]?.trim() ?? '')
      .filter(Boolean);

    shopifyCollectionStrategy.writeSingleFields.forEach((fieldName, index) => {
      if (isSingularCollectionAliasField(fieldName)) return;

      if (isCollectionDisplayNameField(fieldName)) {
        const fieldKind = fieldKinds[fieldName] ?? 'text';
        const nextSingleLabel = normalizedCollectionLabels[index] ?? '';
        if (fieldKind === 'json') {
          const nextSingle = nextSingleLabel ? [nextSingleLabel] : [];
          setFormValue(fieldName, nextSingle.length > 0 ? JSON.stringify(nextSingle) : '');
          return;
        }

        setFormValue(fieldName, nextSingleLabel);
        return;
      }

      setFormValue(fieldName, normalizedCollections[index] ?? '');
    });


    const canonicalCollectionsFieldKind = fieldKinds[canonicalCollectionsFieldName] ?? 'text';
    if (normalizedCollections.length === 0) {
      setFormValue(canonicalCollectionsFieldName, '');
    } else if (canonicalCollectionsFieldKind === 'json' || isShopifyCollectionJsonField(canonicalCollectionsFieldName)) {
      setFormValue(canonicalCollectionsFieldName, JSON.stringify(normalizedCollections));
    } else {
      setFormValue(canonicalCollectionsFieldName, normalizedCollections.join(', '));
    }
    const writtenCollectionFields = new Set<string>([
      ...shopifyCollectionStrategy.writeSingleFields,
      ...shopifyCollectionStrategy.writeCompoundFields,
    ].map((fieldName) => fieldName.toLowerCase()));

    shopifyCollectionStrategy.writeCompoundFields.forEach((fieldName) => {
      const fieldKind = fieldKinds[fieldName] ?? 'text';

      if (normalizedCollections.length === 0) {
        setFormValue(fieldName, '');
        return;
      }

      if (isCollectionDisplayNameField(fieldName)) {
        if (fieldKind === 'json') {
          setFormValue(fieldName, normalizedCollectionLabels.length > 0 ? JSON.stringify(normalizedCollectionLabels) : '');
          return;
        }

        setFormValue(
          fieldName,
          normalizedCollectionLabels.join(', '),
        );
        return;
      }

      if (fieldKind === 'json' || isShopifyCollectionJsonField(fieldName)) {
        setFormValue(fieldName, JSON.stringify(normalizedCollections));
        return;
      }

      setFormValue(
        fieldName,
        normalizedCollections.join(', '),
      );
    });

    const fallbackIdField = [
      ...shopifyCollectionStrategy.sourceCompoundFields,
      ...shopifyCollectionStrategy.sourceSingleFields,
      ...shopifyCompoundCollectionFieldNames,
      ...shopifySingleCollectionFieldNames,
    ].find((fieldName) => {
      const normalizedName = fieldName.trim().toLowerCase();
      return !isCollectionDisplayNameField(fieldName) && !writtenCollectionFields.has(normalizedName);
    });

    if (fallbackIdField) {
      if (isSingularCollectionAliasField(fallbackIdField)) {
        setFormValue(
          SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
          normalizedCollections.length > 0 ? JSON.stringify(normalizedCollections) : '',
        );
        return;
      }

      const fieldKind = fieldKinds[fallbackIdField] ?? 'text';

      if (normalizedCollections.length === 0) {
        setFormValue(fallbackIdField, '');
      } else if (fieldKind === 'json' || isShopifyCollectionJsonField(fallbackIdField)) {
        setFormValue(fallbackIdField, JSON.stringify(normalizedCollections));
      } else {
        setFormValue(
          fallbackIdField,
          normalizedCollections.join(', '),
        );
      }
    }
    setFormValue(
      SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
      normalizedCollections.length > 0 ? JSON.stringify(normalizedCollections) : '',
    );

  }

  const derivedShopifyBodyHtml = useMemo(() => {
    if (!shopifyBodyDescriptionFieldName && !shopifyKeyFeaturesFieldName) return '';

    const descriptionValue = shopifyBodyDescriptionFieldName ? (formValues[shopifyBodyDescriptionFieldName] ?? '') : '';
    const keyFeaturesValue = shopifyKeyFeaturesFieldName ? (formValues[shopifyKeyFeaturesFieldName] ?? '') : '';
    const templateValue = shopifyBodyHtmlTemplateFieldName
      ? (originalFieldValues[shopifyBodyHtmlTemplateFieldName] ?? '')
      : shopifyBodyHtmlFieldName
        ? (originalFieldValues[shopifyBodyHtmlFieldName] ?? '')
        : '';

    return buildShopifyBodyHtml(descriptionValue, keyFeaturesValue, templateValue);
  }, [formValues, originalFieldValues, shopifyBodyDescriptionFieldName, shopifyBodyHtmlTemplateFieldName, shopifyKeyFeaturesFieldName]);

  useEffect(() => {
    if (!shopifyBodyHtmlFieldName) return;

    const nextBodyHtml = derivedShopifyBodyHtml;
    const currentBodyHtml = formValues[shopifyBodyHtmlFieldName] ?? '';

    if (currentBodyHtml !== nextBodyHtml) {
      setFormValue(shopifyBodyHtmlFieldName, nextBodyHtml);
    }
  }, [
    derivedShopifyBodyHtml,
    setFormValue,
    shopifyBodyHtmlFieldName,
    formValues,
  ]);

  useEffect(() => {
    onBodyHtmlPreviewChange?.(derivedShopifyBodyHtml);
  }, [derivedShopifyBodyHtml, onBodyHtmlPreviewChange]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {orderedFieldNames.map((fieldName) => {
        if (isShippingServiceField(fieldName)) return null;
        if (fieldName === approvedFieldName) return null;
        if (isHiddenApprovalField(fieldName)) return null;
        if (hasShopifyTagEditor && (isShopifyCompoundTagsField(fieldName) || isShopifySingleTagField(fieldName))) return null;
        if (hasShopifyCollectionEditor && (isShopifyCompoundCollectionField(fieldName) || isShopifySingleCollectionField(fieldName))) return null;
        if (isShopifyBodyDescriptionField(fieldName)) return null;
        if (isShopifyBodyHtmlField(fieldName)) return null;
        if (isShopifyKeyFeaturesField(fieldName)) return null;
        if (isGenericImageScalarField(fieldName)) return null;
        if (suppressImageScalarFields && isScalarImageField(fieldName)) return null;
        if (hasCanonicalConditionField && fieldName !== CONDITION_FIELD && isConditionMirrorSourceField(fieldName)) return null;

        const value = formValues[fieldName] ?? '';
        const kind = fieldKinds[fieldName] ?? 'text';
        const readOnlyField = isReadOnlyApprovalField(fieldName) || isShopifyBodyHtmlField(fieldName);
        const inputDisabled = saving || readOnlyField;
        const isLongText = kind === 'json' || value.length > 120;
        const booleanLike = isBooleanLikeValue(value);
        const dropdownOptions =
          fieldName.trim().toLowerCase() === 'listing format' ? listingFormatOptions : getDropdownOptions(fieldName);

        if (isAllowOffersField(fieldName) || kind === 'boolean' || booleanLike) {
          const normalizedBooleanValue = value.trim().toLowerCase() === 'true' ? 'true' : 'false';
          return (
            <label key={fieldName} className="flex flex-col gap-2">
              {renderFieldLabel(fieldName)}
              <select
                className={getInputClassName(fieldName)}
                value={normalizedBooleanValue}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={inputDisabled}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </label>
          );
        }

        if (dropdownOptions) {
          const optionSet = new Set(dropdownOptions);
          const options = value && !optionSet.has(value) ? [value, ...dropdownOptions] : dropdownOptions;

          return (
            <label key={fieldName} className="flex flex-col gap-2">
              {renderFieldLabel(fieldName)}
              <select
                className={getInputClassName(fieldName)}
                value={value}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={inputDisabled}
              >
                <option value="">Select an option</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (isShopifyTypeField(fieldName)) {
          return (
            <ShopifyTaxonomyTypeSelect
              key={fieldName}
              fieldName={fieldName}
              label={isRequiredField(fieldName) ? `${toFieldLabel(fieldName)} (Required)` : toFieldLabel(fieldName)}
              value={value}
              onChange={(nextValue) => setFormValue(fieldName, nextValue)}
              disabled={inputDisabled}
            />
          );
        }

        // Image URL list fields — must come before isLongText since kind === 'json' for these fields.
        if (isImageUrlListField(fieldName)) {
          return (
            <ImageUrlListEditor
              key={fieldName}
              fieldLabel={isRequiredField(fieldName) ? `${toFieldLabel(fieldName)} (Required)` : toFieldLabel(fieldName)}
              value={value}
              onChange={(newValue) => setFormValue(fieldName, newValue)}
              disabled={inputDisabled}
            />
          );
        }

        if (isLongText) {
          return (
            <label key={fieldName} className="col-span-1 flex flex-col gap-2 md:col-span-2">
              {renderFieldLabel(fieldName)}
              <textarea
                className={getInputClassName(fieldName, 'min-h-[110px] resize-y font-mono leading-[1.4]')}
                value={value}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={inputDisabled}
              />
            </label>
          );
        }

        return (
          <label key={fieldName} className="flex flex-col gap-2">
            {renderFieldLabel(fieldName)}
            <input
              className={getInputClassName(fieldName)}
              type={kind === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(event) => setFormValue(fieldName, event.target.value)}
              disabled={inputDisabled}
            />
          </label>
        );
      })}

      {shopifyBodyDescriptionFieldName && (
        <label className="col-span-1 flex flex-col gap-2 md:col-span-2">
          <span className={labelClass}>Description</span>
          <textarea
            className={`${inputBaseClass} min-h-[110px] resize-y leading-[1.4]`}
            value={formValues[shopifyBodyDescriptionFieldName] ?? ''}
            onChange={(event) => setFormValue(shopifyBodyDescriptionFieldName, event.target.value)}
            placeholder="Short product description used in listing body HTML"
            disabled={saving}
          />
        </label>
      )}

      {shopifyKeyFeaturesFieldName && (
        <ShopifyKeyFeaturesEditor
          keyFeaturesFieldName={shopifyKeyFeaturesFieldName}
          keyFeaturesValue={formValues[shopifyKeyFeaturesFieldName] ?? ''}
          setFormValue={setFormValue}
          disabled={saving}
        />
      )}

      {hasShopifyTagEditor && (
        <ShopifyTagsEditor
          tags={shopifyTagValues}
          onChange={setShopifyTagValues}
          disabled={saving}
          maxTags={shopifyTagStrategy.writeSingleFields.length > 0 ? shopifyTagStrategy.writeSingleFields.length : undefined}
        />
      )}

      {hasShopifyCollectionEditor && (
        <ShopifyCollectionsSelect
          fieldName={shopifyCollectionStrategy.writeCompoundFields[0] ?? shopifyCollectionStrategy.writeSingleFields[0] ?? 'Collections'}
          label="Collections"
          value={effectiveShopifyCollectionIds}
          labelsById={collectionEditorLabelsById}
          onChange={setShopifyCollectionIds}
          disabled={saving}
        />
      )}

      {showBodyHtmlPreview && (shopifyBodyDescriptionFieldName || shopifyKeyFeaturesFieldName || shopifyBodyHtmlFieldName) && (
        <ShopifyBodyHtmlPreview value={derivedShopifyBodyHtml} />
      )}

      <label className="flex flex-col gap-2">
        <span className={labelClass}>Shipping Services</span>
        <select
          className={inputBaseClass}
          value={formValues[SHIPPING_SERVICE_FIELD] ?? ''}
          onChange={(event) => setFormValue(SHIPPING_SERVICE_FIELD, event.target.value)}
          disabled={saving}
        >
          <option value="">Select an option</option>
          {SHIPPING_SERVICE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {imageUrlSourceField && (
        <ImageUrlListEditor
          key={imageUrlSourceField}
          fieldLabel="Images"
          value={formValues[imageUrlSourceField] ?? ''}
          onChange={(newValue) => setFormValue(imageUrlSourceField, newValue)}
          disabled={saving || isReadOnlyApprovalField(imageUrlSourceField)}
        />
      )}
    </div>
  );
}
