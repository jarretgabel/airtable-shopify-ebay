import type { AirtableRecord } from '@/types/airtable';

const TITLE_FIELD_CANDIDATES = [
  'Shopify REST Title',
  'Shopify Title',
  'Item Title',
  'Title',
  'Name',
  'eBay Title',
] as const;

const DESCRIPTION_FIELD_CANDIDATES = [
  'Shopify Body Description',
  'Shopify REST Body Description',
  'eBay Inventory Product Description',
  'Item Description',
  'Description',
] as const;

const PRICE_FIELD_CANDIDATES = [
  'Shopify REST Variant 1 Price',
  'Shopify Variant 1 Price',
  'eBay Offer Price Value',
  'eBay Offer Auction Start Price Value',
  'Buy It Now/Starting Price',
  'Buy It Now / Starting Price',
  'Variant-Compare-Price',
  'Variant Compare Price',
  'Price',
] as const;

type AirtableFields = AirtableRecord['fields'];

function getTrimmedFieldValue(fields: AirtableFields, fieldName: string): string {
  const value = fields[fieldName];
  return typeof value === 'string' ? value.trim() : '';
}

function findFirstFieldValue(
  fields: AirtableFields,
  fieldNames: readonly string[],
): { fieldName: string | null; value: string } {
  for (const fieldName of fieldNames) {
    const value = getTrimmedFieldValue(fields, fieldName);
    if (value) {
      return { fieldName, value };
    }
  }

  return { fieldName: null, value: '' };
}

function buildDerivedTitle(fields: AirtableFields): string {
  const make = getTrimmedFieldValue(fields, 'Make');
  const model = getTrimmedFieldValue(fields, 'Model');
  const componentType = getTrimmedFieldValue(fields, 'Component Type');
  const parts = [make, model].filter(Boolean);
  return parts.join(' ') || componentType;
}

function buildDerivedDescription(fields: AirtableFields): string {
  return getTrimmedFieldValue(fields, 'Inventory Notes');
}

export interface UsedGearWorkflowListingReadiness {
  title: string;
  titleFieldName: string | null;
  description: string;
  descriptionFieldName: string | null;
  price: string;
  priceFieldName: string | null;
  blockers: UsedGearWorkflowListingReadinessBlocker[];
  missingRequirements: string[];
}

export type UsedGearWorkflowListingReadinessActionTarget = 'inventory-editor' | 'incoming-gear' | 'testing' | 'photos' | 'listings-approval';

export interface UsedGearWorkflowListingReadinessBlocker {
  message: string;
  actionLabel: string;
  actionTarget: UsedGearWorkflowListingReadinessActionTarget;
}

export function getUsedGearWorkflowListingReadiness(record: AirtableRecord): UsedGearWorkflowListingReadiness {
  const titleMatch = findFirstFieldValue(record.fields, TITLE_FIELD_CANDIDATES);
  const descriptionMatch = findFirstFieldValue(record.fields, DESCRIPTION_FIELD_CANDIDATES);
  const priceMatch = findFirstFieldValue(record.fields, PRICE_FIELD_CANDIDATES);

  const title = titleMatch.value || buildDerivedTitle(record.fields);
  const description = descriptionMatch.value || buildDerivedDescription(record.fields);
  const blockers: UsedGearWorkflowListingReadinessBlocker[] = [];

  if (!priceMatch.value) {
    blockers.push({
      message: 'Capture a listing price before approving the row for publish.',
      actionLabel: 'Open Price Editor',
      actionTarget: 'inventory-editor',
    });
  }

  const missingRequirements = blockers.map((blocker) => blocker.message);

  return {
    title,
    titleFieldName: titleMatch.fieldName,
    description,
    descriptionFieldName: descriptionMatch.fieldName,
    price: priceMatch.value,
    priceFieldName: priceMatch.fieldName,
    blockers,
    missingRequirements,
  };
}

export function assertUsedGearWorkflowReadyForPublish(record: AirtableRecord) {
  const readiness = getUsedGearWorkflowListingReadiness(record);
  if (readiness.missingRequirements.length > 0) {
    throw new Error(readiness.missingRequirements[0]);
  }
}