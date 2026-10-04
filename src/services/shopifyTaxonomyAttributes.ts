import type { ShopifyTaxonomyCategoryAttribute } from './shopify';

export const SHOPIFY_TAXONOMY_ATTRIBUTES_FIELD = 'Shopify Taxonomy Attributes JSON';

export interface ShopifyTaxonomyAttributeChoiceValue {
  id: string;
  name: string;
}

export interface ShopifyTaxonomyChoiceSelection {
  id: string;
  name: string;
  type: 'choice';
  values: ShopifyTaxonomyAttributeChoiceValue[];
}

export interface ShopifyTaxonomyMeasurementSelection {
  id: string;
  name: string;
  type: 'measurement';
  value: number;
  option: { key: string; value: string };
}

export interface ShopifyTaxonomyTextSelection {
  id: string;
  name: string;
  type: 'text';
  value: string;
}

export type ShopifyTaxonomyAttributeSelection =
  | ShopifyTaxonomyChoiceSelection
  | ShopifyTaxonomyMeasurementSelection
  | ShopifyTaxonomyTextSelection;

export interface ShopifyTaxonomyAttributesDocument {
  version: 1;
  categoryId: string;
  categoryFullName: string;
  attributes: ShopifyTaxonomyAttributeSelection[];
}

export function slugifyShopifyTaxonomyAttributeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export function serializeShopifyTaxonomyAttributes(document: ShopifyTaxonomyAttributesDocument): string {
  return JSON.stringify(document, null, 2);
}

export function buildEmptyShopifyTaxonomyAttributes(categoryId: string, categoryFullName: string): ShopifyTaxonomyAttributesDocument {
  return { version: 1, categoryId, categoryFullName, attributes: [] };
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
    if (!definition || definition.type !== 'choice' || selection.values.length === 0) return [];
    const definitionValueIds = new Set(definition.values.map((value) => value.id));
    const valueIds = selection.values.map((value) => value.id).filter((id) => definitionValueIds.has(id));
    if (valueIds.length === 0) return [];
    return [{
      namespace: 'shopify',
      key: slugifyShopifyTaxonomyAttributeName(definition.name),
      type: 'list.metaobject_reference',
      value: JSON.stringify(valueIds),
    }];
  });
}
