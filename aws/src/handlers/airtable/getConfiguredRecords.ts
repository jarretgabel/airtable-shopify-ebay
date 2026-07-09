import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import {
  getConfiguredRecords,
  getConfiguredRecordsSummary,
  type AirtableConfiguredRecordsSubset,
  type AirtableConfiguredRecordsSource,
} from '../../providers/airtable/sources.js';
import { getOrLoadConfiguredRecordsCache } from '../../providers/airtable/configuredRecordsCache.js';

const DEFAULT_APPROVAL_QUEUE_FIELDS = [
  'Workflow Status',
  'Shopify Approved',
  'eBay Approved',
  'Shopify REST Title',
  'Shopify Title',
  'Item Title',
  'Title',
  'eBay Title',
  'Vendor',
  'Shopify REST Variant 1 Price',
  'Shopify Variant 1 Price',
  'Buy It Now/Starting Price',
  'Buy It Now / Starting Price',
  'Price',
  'eBay Offer Price Value',
  'eBay Offer Auction Start Price Value',
  'Quantity',
  'Qty',
  'Shopify Status',
  'Shopify REST Status',
  'eBay Offer Status',
  'eBay Format',
  'eBay Offer Format',
  'Listing Format',
];

function resolveRequestedFields(
  source: AirtableConfiguredRecordsSource,
  subset: AirtableConfiguredRecordsSubset | undefined,
  rawFields: string | undefined,
): string[] | undefined {
  const requestedFields = rawFields
    ?.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (requestedFields && requestedFields.length > 0) {
    return requestedFields;
  }

  if (subset === 'ready-for-publishing' || subset === 'listings-page') {
    return undefined;
  }

  if (
    source === 'approval-ebay'
    || source === 'approval-shopify'
    || source === 'approval-combined'
  ) {
    return DEFAULT_APPROVAL_QUEUE_FIELDS;
  }

  return undefined;
}

function validateSource(value: string): AirtableConfiguredRecordsSource {
  if (
    value === 'users'
    || value === 'user-guide'
    || value === 'inventory-directory'
    || value === 'used-gear-workflow'
    || value === 'approval-ebay'
    || value === 'approval-shopify'
    || value === 'approval-combined'
  ) {
    return value;
  }

  throw new HttpError(400, 'Unsupported Airtable configured source', {
    service: 'airtable',
    code: 'AIRTABLE_SOURCE_NOT_ALLOWED',
    retryable: false,
  });
}

function validateSubset(value: string | undefined): AirtableConfiguredRecordsSubset | undefined {
  if (!value) return undefined;
  if (value === 'ready-for-publishing') return value;
  if (value === 'listings-page') return value;

  throw new HttpError(400, 'Unsupported Airtable configured subset', {
    service: 'airtable',
    code: 'AIRTABLE_SUBSET_NOT_ALLOWED',
    retryable: false,
  });
}

function validateMaxRecords(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1000) {
    throw new HttpError(400, 'maxRecords must be an integer between 1 and 1000.', {
      service: 'airtable',
      code: 'AIRTABLE_MAX_RECORDS_INVALID',
      retryable: false,
    });
  }

  return parsed;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const source = validateSource(requireQueryParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const summary = getOptionalQueryParam(event, 'summary');

    if (summary === 'queue') {
      const queueSummary = await getConfiguredRecordsSummary(source);
      logInfo('Fetched Airtable configured records summary', { source, ...queueSummary });
      return jsonOk(queueSummary, { origin });
    }

    const subset = validateSubset(getOptionalQueryParam(event, 'subset'));
    const maxRecords = validateMaxRecords(getOptionalQueryParam(event, 'maxRecords'));
    const fields = resolveRequestedFields(source, subset, getOptionalQueryParam(event, 'fields'));
    const shouldCacheCombinedSubset = source === 'approval-combined'
      && (subset === 'ready-for-publishing' || subset === 'listings-page');

    const records = shouldCacheCombinedSubset
      ? await getOrLoadConfiguredRecordsCache(
        {
          source,
          subset,
          fields,
          maxRecords,
        },
        () => getConfiguredRecords(source, { fields, subset, maxRecords }),
      )
      : await getConfiguredRecords(source, { fields, subset, maxRecords });
    logInfo('Fetched Airtable configured records', { source, count: records.length });
    return jsonOk(records, { origin });
  } catch (error) {
    logError('Failed to fetch Airtable configured records', error, {
      source: event.queryStringParameters?.source || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_GET_CONFIGURED_RECORDS_FAILED'), { origin });
  }
}