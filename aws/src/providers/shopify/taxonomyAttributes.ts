import type { ShopifyTaxonomyCategoryAttribute } from './client.js';

export const SHOPIFY_TAXONOMY_ATTRIBUTES_FIELD_CANDIDATES = [
  'Shopify Taxonomy Attributes JSON',
  'Shopify Taxonomy Attributes',
  'shopify_taxonomy_attributes_json',
] as const;

interface TaxonomyChoiceSelection {
  id: string;
  name: string;
  type: 'choice';
  values: Array<{ id: string; name: string }>;
}

interface TaxonomyMeasurementSelection {
  id: string;
  name: string;
  type: 'measurement';
  value: number;
  option: { key: string; value: string };
}

interface TaxonomyTextSelection {
  id: string;
  name: string;
  type: 'text';
  value: string;
}

export interface ShopifyTaxonomyAttributesDocument {
  version: 1;
  categoryId: string;
  categoryFullName: string;
  attributes: Array<TaxonomyChoiceSelection | TaxonomyMeasurementSelection | TaxonomyTextSelection>;
}

export function findShopifyTaxonomyAttributesValue(fields: Record<string, unknown>): string {
  for (const candidate of SHOPIFY_TAXONOMY_ATTRIBUTES_FIELD_CANDIDATES) {
    const value = fields[candidate];
    if (typeof value === 'string' && value.trim()) return value.trim();
    const matched = Object.entries(fields).find(([key, entry]) => key.toLowerCase() === candidate.toLowerCase() && typeof entry === 'string' && entry.trim());
    if (matched) return matched[1] as string;
  }
  return '';
}

export function parseShopifyTaxonomyAttributes(value: string): ShopifyTaxonomyAttributesDocument | null {
  if (!value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const document = parsed as Partial<ShopifyTaxonomyAttributesDocument>;
    if (document.version !== 1 || typeof document.categoryId !== 'string' || !Array.isArray(document.attributes)) return null;
    return document as ShopifyTaxonomyAttributesDocument;
  } catch {
    return null;
  }
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function buildShopifyTaxonomyChoiceMetafields(
  document: ShopifyTaxonomyAttributesDocument | null,
  definitions: ShopifyTaxonomyCategoryAttribute[],
): Array<{ namespace: string; key: string; type: string; value: string }> {
  if (!document) return [];
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  return document.attributes.flatMap((selection) => {
    if (selection.type !== 'choice') return [];
    const definition = definitionsById.get(selection.id);
    if (!definition || definition.type !== 'choice') return [];
    const validIds = new Set(definition.values.map((value) => value.id));
    const valueIds = selection.values.map((value) => value.id).filter((id) => validIds.has(id));
    if (valueIds.length === 0) return [];
    return [{ namespace: 'shopify', key: slugify(definition.name), type: 'list.metaobject_reference', value: JSON.stringify(valueIds) }];
  });
}
