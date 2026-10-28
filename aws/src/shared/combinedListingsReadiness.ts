import {
  EBAY_FORMAT_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
  SHOPIFY_INVENTORY_QUANTITY_FIELD_CANDIDATES,
  SHOPIFY_PRICE_FIELD_CANDIDATES,
  SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES,
  SHOPIFY_TITLE_FIELD_CANDIDATES,
  findEbayPriceFieldName,
} from './listingFieldCandidates.js';
import { isReadyForRequiredFields } from './requiredFieldStatus.js';
import { displayReadableValue } from './valueDisplay.js';

export interface ReadinessRecord {
  id: string;
  fields: Record<string, unknown>;
}

function displayValue(value: unknown): string {
  return displayReadableValue(value, '—');
}

export interface CombinedListingsRequiredFieldNames {
  combinedRequiredFieldNames: string[];
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
}

const READY_FOR_PUBLISH_WORKFLOW_STATUSES = new Set(['Awaiting Pre-Listing Review', 'Approved for Publish']);
const ACTIVE_LISTING_WORKFLOW_STATUSES = new Set(['Listed, Shopify', 'Listed, eBay']);
const VISIBLE_COMBINED_WORKFLOW_STATUSES = new Set([
  'Awaiting Pre-Listing Review',
  'Approved for Publish',
  'Listed, Shopify',
  'Listed, eBay',
]);
const LISTING_SKU_FIELD_CANDIDATES = [
  'SKU',
  'eBay Inventory SKU',
  'Shopify Variant 1 SKU',
  'Shopify SKU',
  'Variant SKU',
];

function resolveFieldName(fieldNames: string[], candidates: string[]): string {
  const exactMatch = fieldNames.find((fieldName) => candidates.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()));
  return exactMatch ?? '';
}

export function getRecordFieldText(record: ReadinessRecord, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    if (!fieldName.trim()) continue;
    const rawValue = record.fields[fieldName];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    const text = displayValue(rawValue).trim();
    if (text && text !== '—') return text;
  }

  return '';
}

export function normalizeCombinedWorkflowStatus(record: ReadinessRecord): string {
  return getRecordFieldText(record, ['Workflow Status']).trim();
}

function getCombinedListingSku(record: ReadinessRecord): string {
  return getRecordFieldText(record, LISTING_SKU_FIELD_CANDIDATES).trim();
}

export function isCombinedRecordAlreadyListed(record: ReadinessRecord): boolean {
  return ACTIVE_LISTING_WORKFLOW_STATUSES.has(normalizeCombinedWorkflowStatus(record));
}

export function isCombinedRecordVisibleOnListingsPage(record: ReadinessRecord): boolean {
  return VISIBLE_COMBINED_WORKFLOW_STATUSES.has(normalizeCombinedWorkflowStatus(record));
}

export function getCombinedListingsRequiredFieldNames(records: ReadinessRecord[]): CombinedListingsRequiredFieldNames {
  const allFieldNames = Array.from(new Set(records.flatMap((record) => Object.keys(record.fields))));

  const shopifyRequiredFieldNames = Array.from(new Set([
    resolveFieldName(allFieldNames, [...SHOPIFY_TITLE_FIELD_CANDIDATES]),
    resolveFieldName(allFieldNames, [...SHOPIFY_PRICE_FIELD_CANDIDATES]),
    resolveFieldName(allFieldNames, [...SHOPIFY_INVENTORY_QUANTITY_FIELD_CANDIDATES]),
    resolveFieldName(allFieldNames, [...SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES]),
  ].filter((fieldName) => fieldName.trim().length > 0)));

  const ebayPriceFieldName = findEbayPriceFieldName(allFieldNames)
    || resolveFieldName(allFieldNames, [...EBAY_PRICE_FIELD_CANDIDATES]);
  const ebayFormatFieldName = resolveFieldName(allFieldNames, [...EBAY_FORMAT_FIELD_CANDIDATES])
    || 'Ebay Listing Format';
  const ebayRequiredFieldNames = Array.from(new Set([
    resolveFieldName(allFieldNames, [...EBAY_TITLE_FIELD_CANDIDATES]),
    ebayFormatFieldName,
    ebayPriceFieldName,
  ].filter((fieldName) => fieldName.trim().length > 0)));

  return {
    shopifyRequiredFieldNames,
    ebayRequiredFieldNames,
    combinedRequiredFieldNames: Array.from(new Set([...shopifyRequiredFieldNames, ...ebayRequiredFieldNames])),
  };
}

export function isCombinedRecordReadyForPublishing(
  record: ReadinessRecord,
  combinedRequiredFieldNames: string[],
  shopifyRequiredFieldNames: string[],
  ebayRequiredFieldNames: string[],
): boolean {
  if (!READY_FOR_PUBLISH_WORKFLOW_STATUSES.has(normalizeCombinedWorkflowStatus(record))) {
    return false;
  }

  // A combined row is only publish-ready when every required listing field and a SKU are present.
  return isReadyForRequiredFields(record.fields, combinedRequiredFieldNames)
    && isReadyForRequiredFields(record.fields, shopifyRequiredFieldNames)
    && isReadyForRequiredFields(record.fields, ebayRequiredFieldNames)
    && getCombinedListingSku(record).length > 0;
}

export function filterCombinedReadyForPublishingRecords<T extends ReadinessRecord>(
  records: T[],
  requiredFieldNames: CombinedListingsRequiredFieldNames,
): T[] {
  return records.filter((record) => isCombinedRecordVisibleOnListingsPage(record)
    && !isCombinedRecordAlreadyListed(record)
    && isCombinedRecordReadyForPublishing(
      record,
      requiredFieldNames.combinedRequiredFieldNames,
      requiredFieldNames.shopifyRequiredFieldNames,
      requiredFieldNames.ebayRequiredFieldNames,
    ));
}

export function filterCombinedActiveListingRecords<T extends ReadinessRecord>(records: T[]): T[] {
  return records.filter((record) => isCombinedRecordVisibleOnListingsPage(record) && isCombinedRecordAlreadyListed(record));
}

export function filterCombinedNeedsFurtherWorkRecords<T extends ReadinessRecord>(
  records: T[],
  requiredFieldNames: CombinedListingsRequiredFieldNames,
): T[] {
  return records.filter((record) => isCombinedRecordVisibleOnListingsPage(record)
    && getCombinedListingSku(record).length > 0
    && !isCombinedRecordAlreadyListed(record)
    && !isCombinedRecordReadyForPublishing(
      record,
      requiredFieldNames.combinedRequiredFieldNames,
      requiredFieldNames.shopifyRequiredFieldNames,
      requiredFieldNames.ebayRequiredFieldNames,
    ));
}

export function getCombinedReadyForPublishingCount(records: ReadinessRecord[]): number {
  return filterCombinedReadyForPublishingRecords(records, getCombinedListingsRequiredFieldNames(records)).length;
}