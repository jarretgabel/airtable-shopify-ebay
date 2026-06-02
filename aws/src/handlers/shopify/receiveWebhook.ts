import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { ShopifyWebhookTopic } from '../../providers/shopify/client.js';
import { getConfiguredRecords, updateConfiguredRecord } from '../../providers/airtable/sources.js';
import { closeEbayListingWhenSoldOnShopify } from '../../services/crossChannelClose.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { requireSecret } from '../../shared/secrets.js';

type ShopifyWebhookPathTopic = 'orders-paid' | 'orders-cancelled' | 'refunds-create';

interface ShopifyLineItem {
  product_id?: number | string;
  id?: number | string;
}

interface ShopifyWebhookPayload {
  id?: number | string;
  admin_graphql_api_id?: string;
  name?: string;
  order_id?: number | string;
  order_name?: string;
  processed_at?: string;
  updated_at?: string;
  cancelled_at?: string;
  created_at?: string;
  line_items?: ShopifyLineItem[];
}

export interface NormalizedShopifyWebhookEvent {
  topic: ShopifyWebhookTopic;
  topicName: string;
  pathTopic: ShopifyWebhookPathTopic;
  eventId: string;
  shopDomain: string;
  apiVersion: string;
  webhookId: string;
  orderId: string;
  orderName: string;
  refundId: string;
  occurredAt: string;
}

interface ShopifyWebhookDependencies {
  getWebhookSecret?: () => string;
  verifyWebhookSignature?: (event: APIGatewayProxyEventV2, rawBody: string) => void;
  logInfo?: typeof logInfo;
  getConfiguredRecords?: typeof getConfiguredRecords;
  updateConfiguredRecord?: typeof updateConfiguredRecord;
}

const TOPIC_BY_PATH: Record<ShopifyWebhookPathTopic, { headerValue: string; topic: ShopifyWebhookTopic }> = {
  'orders-paid': { headerValue: 'orders/paid', topic: 'ORDERS_PAID' },
  'orders-cancelled': { headerValue: 'orders/cancelled', topic: 'ORDERS_CANCELLED' },
  'refunds-create': { headerValue: 'refunds/create', topic: 'REFUNDS_CREATE' },
};

const SHOPIFY_SYNC_LOCK_FIELD = 'Shopify Sync Locked';
const SHOPIFY_ORDER_ID_FIELDS = ['Shopify Order ID'];
const SHOPIFY_PRODUCT_ID_FIELDS = ['Shopify Product ID', 'Product ID'];

function getFirstProductId(payload: ShopifyWebhookPayload): string {
  if (!Array.isArray(payload.line_items) || !payload.line_items[0]) {
    return '';
  }

  const productId = payload.line_items[0].product_id;
  return typeof productId === 'number' ? String(productId) : (productId?.trim() || '');
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
  const value = fields[SHOPIFY_SYNC_LOCK_FIELD];
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'locked';
  }

  return false;
}

function isIdempotentDuplicate(fields: Record<string, unknown>, eventId: string): boolean {
  if (!eventId) {
    return false;
  }

  const lastEventId = getFieldValue(fields, ['Shopify Last Webhook Event ID']);
  return lastEventId === eventId;
}

function hasPostSaleOutcomeAlready(fields: Record<string, unknown>): boolean {
  const outcome = getFieldValue(fields, ['Post-Sale Outcome']);
  return outcome.length > 0;
}

function resolveMatchingRecordId(
  records: Array<{ id: string; fields: Record<string, unknown> }>,
  orderId: string,
  firstProductId: string,
): string | null {
  if (!orderId && !firstProductId) {
    return null;
  }

  // Primary match: line_items[0].product_id
  if (firstProductId) {
    const matchedRecord = records.find((record) => {
      const fields = record.fields;
      const storedProductId = getFieldValue(fields, SHOPIFY_PRODUCT_ID_FIELDS);
      return storedProductId === firstProductId;
    });

    if (matchedRecord) {
      return matchedRecord.id;
    }
  }

  // Fallback match: stored Shopify Order ID
  if (orderId) {
    const matchedRecord = records.find((record) => {
      const fields = record.fields;
      const storedOrderId = getFieldValue(fields, SHOPIFY_ORDER_ID_FIELDS);
      return storedOrderId === orderId;
    });

    if (matchedRecord) {
      return matchedRecord.id;
    }
  }

  return null;
}

function buildUpdateFields(
  topic: ShopifyWebhookTopic,
  orderId: string,
  orderName: string,
  eventId: string,
  occurredAt: string,
  currentFields: Record<string, unknown>,
): Record<string, unknown> {
  const updateFields: Record<string, unknown> = {};

  // Always update webhook audit fields
  if (eventId) {
    updateFields['Shopify Last Webhook Event ID'] = eventId;
  }

  if (occurredAt) {
    updateFields['Shopify Last Webhook At'] = occurredAt;
  }

  // Update event type
  let eventTypeValue = '';
  if (topic === 'ORDERS_PAID') {
    eventTypeValue = 'orders/paid';
    // Persist order identifiers on paid event
    if (orderId) {
      updateFields['Shopify Order ID'] = orderId;
    }
    if (orderName) {
      updateFields['Shopify Order Name'] = orderName;
    }
  } else if (topic === 'ORDERS_CANCELLED') {
    eventTypeValue = 'orders/cancelled';
    // Write post-sale outcome only if not already set
    if (!hasPostSaleOutcomeAlready(currentFields)) {
      updateFields['Post-Sale Outcome'] = 'Cancelled';
      updateFields['Post-Sale Outcome At'] = occurredAt;
    }
  } else if (topic === 'REFUNDS_CREATE') {
    eventTypeValue = 'refunds/create';
    // Write post-sale outcome only if not already set
    if (!hasPostSaleOutcomeAlready(currentFields)) {
      updateFields['Post-Sale Outcome'] = 'Refunded';
      updateFields['Post-Sale Outcome At'] = occurredAt;
    }
  }

  if (eventTypeValue) {
    updateFields['Shopify Last Webhook Event'] = eventTypeValue;
  }

  // Explicit relist block: never write Restock Disposition
  // (omitted from updateFields by design)

  return updateFields;
}

function readHeader(event: APIGatewayProxyEventV2, name: string): string {
  const entries = Object.entries(event.headers || {});
  const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1]?.trim() || '';
}

function decodeBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) {
    return '';
  }

  return event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
}

function getWebhookSecret(): string {
  return requireSecret('SHOPIFY_WEBHOOK_SECRET');
}

function resolveExpectedTopic(event: APIGatewayProxyEventV2): { pathTopic: ShopifyWebhookPathTopic; headerValue: string; topic: ShopifyWebhookTopic } {
  const pathTopic = event.pathParameters?.topic?.trim() as ShopifyWebhookPathTopic | undefined;
  if (!pathTopic || !(pathTopic in TOPIC_BY_PATH)) {
    throw new HttpError(400, 'Unsupported Shopify webhook topic path.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_TOPIC_PATH_INVALID',
      retryable: false,
    });
  }

  return {
    pathTopic,
    ...TOPIC_BY_PATH[pathTopic],
  };
}

function verifyWebhookSignature(event: APIGatewayProxyEventV2, rawBody: string, secret: string): void {
  const providedSignature = readHeader(event, 'x-shopify-hmac-sha256');
  if (!providedSignature) {
    throw new HttpError(401, 'Shopify webhook signature is missing.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_SIGNATURE_MISSING',
      retryable: false,
    });
  }

  const normalizedSecret = secret.trim();
  if (!normalizedSecret) {
    throw new HttpError(500, 'Missing required environment variable: SHOPIFY_WEBHOOK_SECRET', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_SECRET_MISSING',
      retryable: false,
    });
  }

  const expectedSignature = createHmac('sha256', normalizedSecret)
    .update(rawBody, 'utf8')
    .digest('base64');

  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new HttpError(401, 'Shopify webhook signature is invalid.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_SIGNATURE_INVALID',
      retryable: false,
    });
  }
}

function parsePayload(rawBody: string): ShopifyWebhookPayload {
  if (!rawBody.trim()) {
    throw new HttpError(400, 'Request body is required.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_BODY_MISSING',
      retryable: false,
    });
  }

  try {
    return JSON.parse(rawBody) as ShopifyWebhookPayload;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_BODY_INVALID',
      retryable: false,
    });
  }
}

function stringifyId(value: string | number | undefined): string {
  if (typeof value === 'number') {
    return String(value);
  }

  return value?.trim() || '';
}

function normalizeEvent(
  event: APIGatewayProxyEventV2,
  payload: ShopifyWebhookPayload,
  expectedTopic: { pathTopic: ShopifyWebhookPathTopic; headerValue: string; topic: ShopifyWebhookTopic },
): NormalizedShopifyWebhookEvent {
  const receivedTopic = readHeader(event, 'x-shopify-topic').toLowerCase();
  if (receivedTopic !== expectedTopic.headerValue) {
    throw new HttpError(400, 'Shopify webhook topic does not match the callback path.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_TOPIC_MISMATCH',
      retryable: false,
    });
  }

  const orderId = stringifyId(payload.order_id) || stringifyId(payload.id);
  const refundId = expectedTopic.topic === 'REFUNDS_CREATE' ? stringifyId(payload.id) : '';
  const orderName = payload.order_name?.trim() || payload.name?.trim() || '';

  return {
    topic: expectedTopic.topic,
    topicName: receivedTopic,
    pathTopic: expectedTopic.pathTopic,
    eventId: readHeader(event, 'x-shopify-event-id'),
    shopDomain: readHeader(event, 'x-shopify-shop-domain'),
    apiVersion: readHeader(event, 'x-shopify-api-version'),
    webhookId: readHeader(event, 'x-shopify-webhook-id'),
    orderId,
    orderName,
    refundId,
    occurredAt: payload.processed_at?.trim()
      || payload.cancelled_at?.trim()
      || payload.updated_at?.trim()
      || payload.created_at?.trim()
      || '',
  };
}

export function createHandler(dependencies: ShopifyWebhookDependencies = {}) {
  const getSecret = dependencies.getWebhookSecret ?? getWebhookSecret;
  const verifySignature = dependencies.verifyWebhookSignature ?? ((event, rawBody) => {
    verifyWebhookSignature(event, rawBody, getSecret());
  });
  const infoLogger = dependencies.logInfo ?? logInfo;
  const listRecords = dependencies.getConfiguredRecords ?? getConfiguredRecords;
  const updateRecord = dependencies.updateConfiguredRecord ?? updateConfiguredRecord;

  return async function receiveShopifyWebhookHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      const expectedTopic = resolveExpectedTopic(event);
      const rawBody = decodeBody(event);
      verifySignature(event, rawBody);
      const payload = parsePayload(rawBody);
      const normalizedEvent = normalizeEvent(event, payload, expectedTopic);

      // Attempt to find matching record for writeback
      const firstProductId = getFirstProductId(payload);
      const records = await listRecords('used-gear-workflow');
      const matchedRecordId = resolveMatchingRecordId(
        records as Array<{ id: string; fields: Record<string, unknown> }>,
        normalizedEvent.orderId,
        firstProductId,
      );

      if (!matchedRecordId) {
        // No match found: return graceful response to prevent Shopify retry storms
        infoLogger('Received Shopify webhook event (unmatched, no record found)', {
          ...normalizedEvent,
          firstProductId,
        });

        return jsonOk({
          received: true,
          skipped: true,
          unmatched: true,
          event: normalizedEvent,
        }, { origin });
      }

      const currentRecord = records.find((record) => record.id === matchedRecordId);

      if (!currentRecord) {
        throw new HttpError(404, 'No matching Shopify listing record was found.', {
          service: 'shopify',
          code: 'SHOPIFY_WEBHOOK_RECORD_NOT_FOUND',
          retryable: false,
        });
      }

      // Check sync lock
      if (isSyncLocked(currentRecord.fields)) {
        infoLogger('Skipped automatic Shopify webhook sync because the record is locked.', {
          recordId: matchedRecordId,
          topic: normalizedEvent.topic,
          orderId: normalizedEvent.orderId,
        });

        return jsonOk({
          received: true,
          skipped: true,
          locked: true,
          recordId: matchedRecordId,
          event: normalizedEvent,
        }, { origin });
      }

      // Check idempotency: skip if this event ID was already processed
      if (isIdempotentDuplicate(currentRecord.fields, normalizedEvent.eventId)) {
        infoLogger('Skipped duplicate Shopify webhook event (idempotent)', {
          recordId: matchedRecordId,
          eventId: normalizedEvent.eventId,
          topic: normalizedEvent.topic,
        });

        return jsonOk({
          received: true,
          skipped: true,
          idempotent: true,
          recordId: matchedRecordId,
          event: normalizedEvent,
        }, { origin });
      }

      // Build update fields with all guards applied
      const updateFields = buildUpdateFields(
        normalizedEvent.topic,
        normalizedEvent.orderId,
        normalizedEvent.orderName,
        normalizedEvent.eventId,
        normalizedEvent.occurredAt,
        currentRecord.fields,
      );

      // Apply the update
      const updatedRecord = await updateRecord('used-gear-workflow', matchedRecordId, updateFields, { typecast: true });

      infoLogger('Applied Shopify webhook update to Airtable', {
        recordId: matchedRecordId,
        topic: normalizedEvent.topic,
        orderId: normalizedEvent.orderId,
        eventId: normalizedEvent.eventId,
        updatedFieldNames: Object.keys(updateFields),
      });

      // If item sold on Shopify (ORDERS_PAID), trigger cross-channel eBay close
      if (normalizedEvent.topic === 'ORDERS_PAID') {
        try {
          const closeResult = await closeEbayListingWhenSoldOnShopify(
            matchedRecordId,
            {
              ...currentRecord.fields,
              ...updateFields,
            },
          );

          if (closeResult.success) {
            infoLogger('Cross-channel eBay close triggered from Shopify sale', {
              recordId: matchedRecordId,
              orderId: normalizedEvent.orderId,
              message: closeResult.message,
            });
          } else {
            logError('Cross-channel eBay close failed', new Error(closeResult.message), {
              recordId: matchedRecordId,
              orderId: normalizedEvent.orderId,
            });
          }
        } catch (closeError) {
          logError('Exception during cross-channel eBay close (Shopify sale)', closeError, {
            recordId: matchedRecordId,
            orderId: normalizedEvent.orderId,
          });
        }
      }

      return jsonOk({
        received: true,
        skipped: false,
        locked: false,
        idempotent: false,
        unmatched: false,
        recordId: matchedRecordId,
        event: normalizedEvent,
        updatedFields: updateFields,
        record: updatedRecord,
      }, { origin });
    } catch (error) {
      logError('Failed to receive Shopify webhook', error, {
        topicPath: event.pathParameters?.topic || '',
      });
      return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_WEBHOOK_RECEIVE_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();