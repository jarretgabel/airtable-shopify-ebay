import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import {
  getConfiguredRecords,
  getConfiguredRecordsSummary,
  getListingStore,
  type AirtableConfiguredRecordsSubset,
  type AirtableConfiguredRecordsSource,
} from '../../store/index.js';
import type { ListingReadOptions } from '../../store/listingStore.js';
import { resolveDataBackend } from '../../store/backend.js';
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
  'Shopify Price',
  'Shopify REST Variant 1 Price',
  'Shopify Variant 1 Price',
  'eBay Price',
  'Buy It Now Price',
  'Buy It Now/Starting Bid Price',
  'Buy It Now / Starting Bid Price',
  'Starting Auction Price',
  'Ebay Price',
  'Buy It Now/Starting Price',
  'Buy It Now / Starting Price',
  'Buy It Now/Starting Bid',
  'Buy It Now USD',
  'Starting Bid USD',
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
    || value === 'shopify-vendors'
    || value === 'workflow-image-roles'
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
  if (value === 'post-publish') return value;
  if (value === 'workflow-progress') return value;
  if (value === 'parking-lot-arrival') return value;
  if (value === 'pending-review') return value;
  if (value === 'parking-lot') return value;
  if (value === 'trash-review') return value;

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

function parseNonNegativeInt(value: string | undefined, name: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== value.trim()) {
    throw new HttpError(400, `${name} must be a non-negative integer.`, { service: 'airtable', code: 'AIRTABLE_PAGING_INVALID', retryable: false });
  }
  return parsed;
}

function parseSort(value: string | undefined): ListingReadOptions['sort'] {
  if (!value) return undefined;
  const desc = value.startsWith('-');
  const field = (desc ? value.slice(1) : value).trim();
  if (!field || field.length > 120) {
    throw new HttpError(400, 'sort must be a field name, optionally prefixed with "-" for descending.', { service: 'airtable', code: 'AIRTABLE_SORT_INVALID', retryable: false });
  }
  return { field, direction: desc ? 'desc' : 'asc' };
}

function parseFilters(value: string | undefined): ListingReadOptions['filters'] {
  if (!value) return undefined;
  const invalid = () => new HttpError(400, 'filters must be a JSON object of field to string or string array.', { service: 'airtable', code: 'AIRTABLE_FILTERS_INVALID', retryable: false });
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw invalid();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalid();
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > 10) throw invalid();
  const filters: Record<string, string | string[]> = {};
  for (const [field, expected] of entries) {
    const ok = typeof expected === 'string' || (Array.isArray(expected) && expected.length <= 50 && expected.every((item) => typeof item === 'string'));
    if (!ok || field.length > 120) throw invalid();
    filters[field] = expected as string | string[];
  }
  return filters;
}

function validateSearchQuery(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 120) {
    throw new HttpError(400, 'search must be 120 characters or fewer.', {
      service: 'airtable',
      code: 'AIRTABLE_SEARCH_INVALID',
      retryable: false,
    });
  }

  return trimmed;
}

function resolveSearchFields(rawSearchFields: string | undefined): string[] | undefined {
  const fields = rawSearchFields
    ?.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!fields || fields.length === 0) {
    return undefined;
  }

  return Array.from(new Set(fields));
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
    const searchQuery = validateSearchQuery(getOptionalQueryParam(event, 'search'));
    const searchFields = resolveSearchFields(getOptionalQueryParam(event, 'searchFields'));
    const fields = resolveRequestedFields(source, subset, getOptionalQueryParam(event, 'fields'));
    // This in-memory cache is not invalidated by Postgres writes, so it only fronts Airtable.
    const shouldCacheCombinedSubset = source === 'approval-combined'
      && resolveDataBackend(source) === 'airtable'
      && (subset === 'ready-for-publishing' || subset === 'listings-page')
      && !searchQuery;

    const offset = parseNonNegativeInt(getOptionalQueryParam(event, 'offset'), 'offset');
    const sort = parseSort(getOptionalQueryParam(event, 'sort'));
    const filters = parseFilters(getOptionalQueryParam(event, 'filters'));
    const acceptEncoding = event.headers['accept-encoding'] ?? event.headers['Accept-Encoding'] ?? '';
    const ifNoneMatch = event.headers['if-none-match'] ?? event.headers['If-None-Match'];

    if (offset !== undefined || sort || filters) {
      const store = getListingStore(source);
      if (!store.getRecordsPage) {
        throw new HttpError(400, 'offset, sort and filters need the Postgres backend for this source.', { service: 'airtable', code: 'AIRTABLE_PAGING_UNSUPPORTED', retryable: false });
      }
      const page = await store.getRecordsPage(source, { fields, subset, maxRecords, searchQuery, searchFields, offset, sort, filters });
      logInfo('Fetched Airtable configured records page', { source, count: page.records.length, total: page.total });
      return jsonOk(page.records, { origin, acceptEncoding, etag: { ifNoneMatch }, extraHeaders: { 'x-total-count': String(page.total) } });
    }

    const records = shouldCacheCombinedSubset
      ? await getOrLoadConfiguredRecordsCache(
        {
          source,
          subset,
          fields,
          maxRecords,
          searchQuery,
          searchFields,
        },
        () => getConfiguredRecords(source, {
          fields,
          subset,
          maxRecords,
          searchQuery,
          searchFields,
        }),
      )
      : await getConfiguredRecords(source, {
        fields,
        subset,
        maxRecords,
        searchQuery,
        searchFields,
      });
    logInfo('Fetched Airtable configured records', { source, count: records.length });
    return jsonOk(records, {
      origin,
      acceptEncoding: event.headers['accept-encoding'] ?? event.headers['Accept-Encoding'] ?? '',
      etag: { ifNoneMatch: event.headers['if-none-match'] ?? event.headers['If-None-Match'] },
    });
  } catch (error) {
    logError('Failed to fetch Airtable configured records', error, {
      source: event.queryStringParameters?.source || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_GET_CONFIGURED_RECORDS_FAILED'), { origin });
  }
}