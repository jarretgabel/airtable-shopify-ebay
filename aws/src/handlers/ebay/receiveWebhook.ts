import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getConfiguredRecords, updateConfiguredRecord } from '../../store/index.js';
import { buildSalePriceFields } from '../../shared/contracts/salePrice.js';
import { buildSoldReadyFields } from '../../shared/contracts/soldReadyWorkflow.js';
import { retainShopifyProductWhenSoldOnEbay } from '../../services/crossChannelClose.js';
import { sendSaleAlert } from '../../services/saleAlert.js';
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
  refundAmount?: number | string;
  refundReason?: string;
  salePrice?: number | string;
  reason?: string;
  note?: string;
  amount?: {
    value?: number | string;
  };
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
  refundAmount: number | null;
  refundReason: string;
  salePrice: number | null;
}

interface EbayWebhookDependencies {
  getConfiguredRecords?: typeof getConfiguredRecords;
  updateConfiguredRecord?: typeof updateConfiguredRecord;
  getWebhookSecret?: () => string | undefined;
  retainShopifyProductWhenSoldOnEbay?: typeof retainShopifyProductWhenSoldOnEbay;
}

const EBAY_SYNC_LOCK_FIELD = 'eBay Sync Locked';
const EBAY_LISTING_ID_FIELDS = ['eBay Listing ID', 'eBay Item ID', 'Listing ID', 'Item ID'];
const EBAY_OFFER_ID_FIELDS = ['eBay Offer ID', 'Offer ID'];
const EBAY_SKU_FIELDS = ['eBay Inventory SKU', 'SKU'];

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeCurrencyAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

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

// `secretRequired` is true when the real environment secret is the source. A caller that injects its own secret
// getter (an already-authenticated internal caller, or a test) may opt out by returning no secret.
function requireWebhookSecret(event: APIGatewayProxyEventV2, getWebhookSecret: () => string | undefined, secretRequired: boolean): void {
  const configuredSecret = getWebhookSecret()?.trim();
  if (!configuredSecret) {
    if (secretRequired) {
      throw new HttpError(500, 'Missing required environment variable: EBAY_WEBHOOK_SECRET', {
        service: 'ebay',
        code: 'EBAY_WEBHOOK_SECRET_MISSING',
        retryable: false,
      });
    }

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
  const refundReason = trimString(payload.refundReason) || trimString(payload.reason) || trimString(payload.note);
  const refundAmount = parseNumericValue(payload.refundAmount)
    ?? parseNumericValue(payload.amount?.value);

  return {
    eventType: trimString(payload.eventType) || 'listing.updated',
    listingId: trimString(payload.listingId),
    offerId: trimString(payload.offerId),
    sku: trimString(payload.sku),
    status: trimString(payload.status).toUpperCase(),
    occurredAt: trimString(payload.occurredAt) || trimString(payload.updatedAt),
    recordId: trimString(payload.recordId),
    orderId: trimString(payload.orderId),
    refundAmount: refundAmount !== null ? normalizeCurrencyAmount(refundAmount) : null,
    refundReason,
    salePrice: parseNumericValue(payload.salePrice),
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

function getExistingNumericFieldValue(fields: Record<string, unknown>, fieldNames: string[]): number | null {
  for (const fieldName of fieldNames) {
    const parsed = parseNumericValue(fields[fieldName]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function resolveRefundOutcome(currentFields: Record<string, unknown>, refundAmount: number | null): 'Refunded' | 'Partial Refund' {
  if (refundAmount === null || refundAmount <= 0) {
    return 'Refunded';
  }

  const paidAmount = getExistingNumericFieldValue(currentFields, ['Paid Amount']);
  if (paidAmount !== null && paidAmount > 0 && refundAmount < paidAmount) {
    return 'Partial Refund';
  }

  return 'Refunded';
}

function shouldTriggerCrossChannelClose(event: NormalizedEbayWebhookEvent): boolean {
  if (!event.eventType.startsWith('order.')) {
    return false;
  }

  return event.eventType !== 'order.cancelled' && event.eventType !== 'order.refunded';
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
          updateFields['Post-Sale Outcome'] = resolveRefundOutcome(currentFields, event.refundAmount);
          updateFields['Post-Sale Outcome At'] = event.occurredAt;
        }
      }

      if (event.eventType === 'order.refunded') {
        if (event.refundAmount !== null && getExistingNumericFieldValue(currentFields, ['Refund Amount']) === null) {
          updateFields['Refund Amount'] = event.refundAmount;
        }

        if (event.refundReason && !getFieldValue(currentFields, ['Refund Reason'])) {
          updateFields['Refund Reason'] = event.refundReason;
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
  const secretRequired = dependencies.getWebhookSecret === undefined;
  const retainShopifyProduct = dependencies.retainShopifyProductWhenSoldOnEbay ?? retainShopifyProductWhenSoldOnEbay;

  return async function receiveEbayWebhookHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      requireWebhookSecret(event, getWebhookSecret, secretRequired);
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

      // A sale's side effect must finish before the event is recorded as processed. Otherwise a retried delivery
      // would be skipped as a duplicate and a failed retention would never recover.
      const alertResults: string[] = [];
      if (shouldTriggerCrossChannelClose(normalizedEvent)) {
        let retryableFailure = '';
        try {
          const retainResult = await retainShopifyProduct(recordId, { ...currentRecord.fields, ...updateFields });
          alertResults.push(`Shopify retention: ${retainResult.success ? 'ok' : 'FAILED'} - ${retainResult.message}`);

          if (retainResult.success) {
            logInfo('Shopify product retention completed for eBay order event', {
              recordId,
              eventType: normalizedEvent.eventType,
              message: retainResult.message,
            });
          } else {
            logError('Shopify product retention failed', new Error(retainResult.message), {
              recordId,
              eventType: normalizedEvent.eventType,
              retryable: retainResult.retryable ?? false,
            });
            if (retainResult.retryable) {
              retryableFailure = retainResult.message;
            }
          }
        } catch (retainError) {
          logError('Exception during Shopify product retention (eBay order event)', retainError, {
            recordId,
            eventType: normalizedEvent.eventType,
          });
          retryableFailure = retainError instanceof Error ? retainError.message : String(retainError);
        }

        if (retryableFailure) {
          throw new HttpError(503, `Shopify retention needs a retry: ${retryableFailure}`, {
            service: 'shopify',
            code: 'EBAY_SALE_SIDE_EFFECT_RETRYABLE',
            retryable: true,
          });
        }
      }

      // Sale side effects finished; advance the workflow like the manual Mark Sold button does.
      if (shouldTriggerCrossChannelClose(normalizedEvent)) {
        Object.assign(updateFields, buildSalePriceFields(currentRecord.fields, { price: normalizedEvent.salePrice, channel: 'eBay' }));
        Object.assign(updateFields, buildSoldReadyFields(currentRecord.fields, normalizedEvent.occurredAt || new Date().toISOString()));
      }

      const updatedRecord = await updateRecord('used-gear-workflow', recordId, updateFields, { typecast: true });

      logInfo('Applied eBay webhook update to Airtable', {
        recordId,
        listingId: normalizedEvent.listingId,
        offerId: normalizedEvent.offerId,
        sku: normalizedEvent.sku,
        updatedFieldNames: Object.keys(updateFields),
      });
      if (normalizedEvent.eventType.startsWith('order.')) await sendSaleAlert({
        channel: 'eBay',
        action: normalizedEvent.eventType,
        recordId,
        fields: { ...currentRecord.fields, ...updateFields },
        orderId: normalizedEvent.orderId,
        ebayListingId: normalizedEvent.listingId,
        results: alertResults,
      });

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