import { isReadyForRequiredFields } from '@/components/approval/requiredFieldStatus';
import {
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalEbayConstants';
import { findEbayPriceFieldName } from '@/components/approval/listingApprovalFieldHelpers';
import {
  SHOPIFY_PRICE_FIELD_CANDIDATES,
  SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES,
  SHOPIFY_TITLE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalShopifyConstants';
import { displayValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

export interface CombinedListingsRequiredFieldNames {
  combinedRequiredFieldNames: string[];
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
}

const READY_FOR_PUBLISH_WORKFLOW_STATUSES = new Set(['Approved for Publish']);
const ACTIVE_LISTING_WORKFLOW_STATUSES = new Set(['Listed, Shopify', 'Listed, eBay']);
const VISIBLE_COMBINED_WORKFLOW_STATUSES = new Set([
  'Awaiting Pre-Listing Review',
  'Approved for Publish',
  'Listed, Shopify',
  'Listed, eBay',
]);

function resolveFieldName(fieldNames: string[], candidates: string[]): string {
  const fieldNameSet = new Set(fieldNames.map((fieldName) => fieldName.toLowerCase()));
  const exactMatch = fieldNames.find((fieldName) => candidates.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()));
  if (exactMatch) return exactMatch;

  return candidates.find((candidate) => !fieldNameSet.has(candidate.toLowerCase())) ?? candidates[0] ?? '';
}

export function getRecordFieldText(record: AirtableRecord, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    if (!fieldName.trim()) continue;
    const rawValue = record.fields[fieldName];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    const text = displayValue(rawValue).trim();
    if (text && text !== '—') return text;
  }

  return '';
}

export function normalizeCombinedWorkflowStatus(record: AirtableRecord): string {
  return getRecordFieldText(record, ['Workflow Status']).trim();
}

export function isCombinedRecordAlreadyListed(record: AirtableRecord): boolean {
  return ACTIVE_LISTING_WORKFLOW_STATUSES.has(normalizeCombinedWorkflowStatus(record));
}

export function isCombinedRecordVisibleOnListingsPage(record: AirtableRecord): boolean {
  return VISIBLE_COMBINED_WORKFLOW_STATUSES.has(normalizeCombinedWorkflowStatus(record));
}

export function getCombinedListingsRequiredFieldNames(records: AirtableRecord[]): CombinedListingsRequiredFieldNames {
  const allFieldNames = Array.from(new Set(records.flatMap((record) => Object.keys(record.fields))));

  const shopifyRequiredFieldNames = Array.from(new Set([
    resolveFieldName(allFieldNames, [...SHOPIFY_TITLE_FIELD_CANDIDATES]),
    resolveFieldName(allFieldNames, [...SHOPIFY_PRICE_FIELD_CANDIDATES]),
    resolveFieldName(allFieldNames, [...SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES]),
  ].filter((fieldName) => fieldName.trim().length > 0)));

  const ebayPriceFieldName = findEbayPriceFieldName(allFieldNames)
    || resolveFieldName(allFieldNames, [...EBAY_PRICE_FIELD_CANDIDATES]);
  const ebayRequiredFieldNames = Array.from(new Set([
    resolveFieldName(allFieldNames, [...EBAY_TITLE_FIELD_CANDIDATES]),
    ebayPriceFieldName,
  ].filter((fieldName) => fieldName.trim().length > 0)));

  return {
    shopifyRequiredFieldNames,
    ebayRequiredFieldNames,
    combinedRequiredFieldNames: Array.from(new Set([...shopifyRequiredFieldNames, ...ebayRequiredFieldNames])),
  };
}

export function isCombinedRecordReadyForPublishing(
  record: AirtableRecord,
  combinedRequiredFieldNames: string[],
  shopifyRequiredFieldNames: string[],
  ebayRequiredFieldNames: string[],
): boolean {
  return READY_FOR_PUBLISH_WORKFLOW_STATUSES.has(normalizeCombinedWorkflowStatus(record))
    && isReadyForRequiredFields(record.fields, combinedRequiredFieldNames)
    && isReadyForRequiredFields(record.fields, shopifyRequiredFieldNames)
    && isReadyForRequiredFields(record.fields, ebayRequiredFieldNames);
}

export function filterCombinedReadyForPublishingRecords(
  records: AirtableRecord[],
  requiredFieldNames: CombinedListingsRequiredFieldNames,
): AirtableRecord[] {
  return records.filter((record) => isCombinedRecordVisibleOnListingsPage(record)
    && !isCombinedRecordAlreadyListed(record)
    && isCombinedRecordReadyForPublishing(
      record,
      requiredFieldNames.combinedRequiredFieldNames,
      requiredFieldNames.shopifyRequiredFieldNames,
      requiredFieldNames.ebayRequiredFieldNames,
    ));
}

export function filterCombinedActiveListingRecords(records: AirtableRecord[]): AirtableRecord[] {
  return records.filter((record) => isCombinedRecordVisibleOnListingsPage(record) && isCombinedRecordAlreadyListed(record));
}

export function filterCombinedNeedsFurtherWorkRecords(
  records: AirtableRecord[],
  requiredFieldNames: CombinedListingsRequiredFieldNames,
): AirtableRecord[] {
  return records.filter((record) => isCombinedRecordVisibleOnListingsPage(record)
    && !isCombinedRecordAlreadyListed(record)
    && !isCombinedRecordReadyForPublishing(
      record,
      requiredFieldNames.combinedRequiredFieldNames,
      requiredFieldNames.shopifyRequiredFieldNames,
      requiredFieldNames.ebayRequiredFieldNames,
    ));
}

export function getCombinedReadyForPublishingCount(records: AirtableRecord[]): number {
  return filterCombinedReadyForPublishingRecords(records, getCombinedListingsRequiredFieldNames(records)).length;
}