import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getConfiguredRecords, updateConfiguredRecord } from '../../providers/airtable/sources.js';
import { closeShopifyProductWhenSoldOnEbay } from '../../services/crossChannelClose.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getOptionalSecret } from '../../shared/secrets.js';

interface EbayWebhookPayload {
  eventType?: string;
  listingId?: string;
  offerId?: string;
  sku?: string;
  status?: string;
  occurredAt?: string;
  updatedAt?: string;
  recordId?: string;
  orderId?: string;
}

interface NormalizedEbayWebhookEvent {
  eventType: string;
  listingId: string;
  offerId: string;
  sku: string;
  status: string;
  occurredAt: string;
  recordId: string;
  orderId: string;
}

interface EbayWebhookDependencies {
  getConfiguredRecords?: typeof getConfiguredRecords;
  updateConfiguredRecord?: typeof updateConfiguredRecord;
  getWebhookSecret?: () => string | undefined;
}

const EBAY_SYNC_LOCK_FIELD = 'eBay Sync Locked';
const EBAY_LISTING_ID_FIELDS = ['eBay Listing ID', 'eBay Item ID', 'Listing ID', 'Item ID'];
const EBAY_OFFER_ID_FIELDS = ['eBay Offer ID', 'Offer ID'];
const EBAY_SKU_FIELDS = ['eBay Inventory SKU', 'SKU'];

function readHeader(event: APIGatewayProxyEventV2, name: string): string {
  const entries = Object.entries(event.headers || {});
  const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1]?.trim() || '';
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeWebhookPayload(event: APIGatewayProxyEventV2): EbayWebhookPayload {
  return requireJsonBody<EbayWebhookPayload>(event, 'ebay', 'INVALID_EBAY_WEBHOOK_BODY');
}

function requireWebhookSecret(event: APIGatewayProxyEventV2, getWebhookSecret: () => string | undefined): void {
  const configuredSecret = getWebhookSecret()?.trim();
  if (!configuredSecret) {
    return;
  }

  const providedSecret = readHeader(event, 'x-ebay-webhook-secret')
    || readHeader(event, 'x-webhook-secret')
    || getOptionalQueryParam(event, 'token')
    || '';

  if (providedSecret !== configuredSecret) {
    throw new HttpError(401, 'eBay webhook secret is invalid.', {
      service: 'ebay',
      code: 'EBAY_WEBHOOK_SECRET_INVALID',
      retryable: false,
    });
  }
}

function normalizeWebhookEvent(payload: EbayWebhookPayload): NormalizedEbayWebhookEvent {
  return {
    eventType: trimString(payload.eventType) || 'listing.updated',
    listingId: trimString(payload.listingId),
    offerId: trimString(payload.offerId),
    sku: trimString(payload.sku),
    status: trimString(payload.status).toUpperCase(),
    occurredAt: trimString(payload.occurredAt) || trimString(payload.updatedAt),
    recordId: trimString(payload.recordId),
  };
}

function getFieldValue(fields: Record<string, unknown>, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    const value = fields[fieldName];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function isSyncLocked(fields: Record<string, unknown>): boolean {
  const value = fields[EBAY_SYNC_LOCK_FIELD];
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'locked';
  }

  return false;
}

function isDedupedEvent(fields: Record<string, unknown>, eventType: string, occurredAt: string): boolean {
  // Skip if same eventType and occurredAt already stored (dedup using timestamp+eventType)
  if (!eventType || !occurredAt) {
    return false;
  }

  const lastEventType = getFieldValue(fields, ['eBay Last Webhook Event']);
  const lastEventAt = getFieldValue(fields, ['eBay Last Webhook At']);

  return lastEventType === eventType && lastEventAt === occurredAt;
}

function hasPostSaleOutcomeAlready(fields: Record<string, unknown>): boolean {
  const outcome = getFieldValue(fields, ['Post-Sale Outcome']);
  return outcome.length > 0;
}

function resolveMatchingRecordId(records: Array<{ id: string; fields: Record<string, unknown> }>, event: NormalizedEbayWebhookEvent): string {
  if (event.recordId) {
    return event.recordId;
  }

  const matchedRecord = records.find((record) => {
    const fields = record.fields;
    const listingId = getFieldValue(fields, EBAY_LISTING_ID_FIELDS);
    const offerId = getFieldValue(fields, EBAY_OFFER_ID_FIELDS);
    const sku = getFieldValue(fields, EBAY_SKU_FIELDS);

    return (event.listingId && listingId === event.listingId)
      || (event.offerId && offerId === event.offerId)
      || (event.sku && sku === event.sku);
  });

  if (!matchedRecord) {
    throw new HttpError(404, 'No matching eBay listing record was found.', {
      service: 'ebay',
      code: 'EBAY_WEBHOOK_RECORD_NOT_FOUND',
      retryable: false,
    });
  }

  return matchedRecord.id;
}

function buildUpdateFields(event: NormalizedEbayWebhookEvent, currentFields: Record<string, unknown>): Record<string, unknown> {
  const updateFields: Record<string, unknown> = {};

  if (event.listingId) {
    updateFields['eBay Listing ID'] = event.listingId;
  }

  if (event.offerId) {
    updateFields['eBay Offer ID'] = event.offerId;
  }

  if (event.status) {
    updateFields['eBay Offer Status'] = event.status;
    updateFields['eBay Listing Status'] = event.status;
  }

  if (event.occurredAt) {
    updateFields['eBay Last Webhook At'] = event.occurredAt;
  }

  if (event.eventType) {
    updateFields['eBay Last Webhook Event'] = event.eventType;

    // Write post-sale outcome for order events (e.g., order.cancelled, order.refunded)
    if (event.eventType.startsWith('order.')) {
      if (!hasPostSaleOutcomeAlready(currentFields)) {
        if (event.eventType === 'order.cancelled') {
          updateFields['Post-Sale Outcome'] = 'Cancelled';
          updateFields['Post-Sale Outcome At'] = event.occurredAt;
        } else if (event.eventType === 'order.refunded') {
          updateFields['Post-Sale Outcome'] = 'Refunded';
          updateFields['Post-Sale Outcome At'] = event.occurredAt;
        }
      }
    }
  }

  // Explicit relist block: never write Restock Disposition
  // (omitted from updateFields by design)

  return updateFields;
}

export function createHandler(dependencies: EbayWebhookDependencies = {}) {
  const listRecords = dependencies.getConfiguredRecords ?? getConfiguredRecords;
  const updateRecord = dependencies.updateConfiguredRecord ?? updateConfiguredRecord;
  const getWebhookSecret = dependencies.getWebhookSecret ?? (() => getOptionalSecret('EBAY_WEBHOOK_SECRET'));

  return async function receiveEbayWebhookHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      requireWebhookSecret(event, getWebhookSecret);
      const payload = decodeWebhookPayload(event);
      const normalizedEvent = normalizeWebhookEvent(payload);
      const records = await listRecords('used-gear-workflow');
      const recordId = resolveMatchingRecordId(records as Array<{ id: string; fields: Record<string, unknown> }>, normalizedEvent);
      const currentRecord = records.find((record) => record.id === recordId);

      if (!currentRecord) {
        throw new HttpError(404, 'No matching eBay listing record was found.', {
          service: 'ebay',
          code: 'EBAY_WEBHOOK_RECORD_NOT_FOUND',
          retryable: false,
        });
      }

      if (isSyncLocked(currentRecord.fields)) {
        logInfo('Skipped automatic eBay listing sync because the record is locked.', {
          recordId,
          listingId: normalizedEvent.listingId,
          offerId: normalizedEvent.offerId,
          sku: normalizedEvent.sku,
        });

        return jsonOk({
          received: true,
          skipped: true,
          locked: true,
          recordId,
          event: normalizedEvent,
        }, { origin });
      }

      // Check dedup: skip if same eventType and occurredAt already stored
      if (isDedupedEvent(currentRecord.fields, normalizedEvent.eventType, normalizedEvent.occurredAt)) {
        logInfo('Skipped duplicate eBay webhook event (dedup)', {
          recordId,
          eventType: normalizedEvent.eventType,
          occurredAt: normalizedEvent.occurredAt,
        });

        return jsonOk({
          received: true,
          skipped: true,
          deduped: true,
          recordId,
          event: normalizedEvent,
        }, { origin });
      }

      const updateFields = buildUpdateFields(normalizedEvent, currentRecord.fields);
      const updatedRecord = await updateRecord('used-gear-workflow', recordId, updateFields, { typecast: true });

      logInfo('Applied eBay webhook update to Airtable', {
        recordId,
        listingId: normalizedEvent.listingId,
        offerId: normalizedEvent.offerId,
        sku: normalizedEvent.sku,
        updatedFieldNames: Object.keys(updateFields),
      });

      // If item sold or order event on eBay (order.cancelled, order.refunded, etc.), trigger cross-channel Shopify close
      if (normalizedEvent.eventType.startsWith('order.')) {
        try {
          const closeResult = await closeShopifyProductWhenSoldOnEbay(
            recordId,
            {
              ...currentRecord.fields,
              ...updateFields,
            },
          );

          if (closeResult.success) {
            logInfo('Cross-channel Shopify close triggered from eBay order event', {
              recordId,
              eventType: normalizedEvent.eventType,
              message: closeResult.message,
            });
          } else {
            logError('Cross-channel Shopify close failed', new Error(closeResult.message), {
              recordId,
              eventType: normalizedEvent.eventType,
            });
          }
        } catch (closeError) {
          logError('Exception during cross-channel Shopify close (eBay order event)', closeError, {
            recordId,
            eventType: normalizedEvent.eventType,
          });
        }
      }

      return jsonOk({
        received: true,
        skipped: false,
        locked: false,
        deduped: false,
        recordId,
        event: normalizedEvent,
        updatedFields: updateFields,
        record: updatedRecord,
      }, { origin });
    } catch (error) {
      logError('Failed to receive eBay webhook', error);
      return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_WEBHOOK_RECEIVE_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();