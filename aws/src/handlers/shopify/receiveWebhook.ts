import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { ShopifyWebhookTopic } from '../../providers/shopify/client.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { requireSecret } from '../../shared/secrets.js';

type ShopifyWebhookPathTopic = 'orders-paid' | 'orders-cancelled' | 'refunds-create';

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
}

const TOPIC_BY_PATH: Record<ShopifyWebhookPathTopic, { headerValue: string; topic: ShopifyWebhookTopic }> = {
  'orders-paid': { headerValue: 'orders/paid', topic: 'ORDERS_PAID' },
  'orders-cancelled': { headerValue: 'orders/cancelled', topic: 'ORDERS_CANCELLED' },
  'refunds-create': { headerValue: 'refunds/create', topic: 'REFUNDS_CREATE' },
};

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

  return async function receiveShopifyWebhookHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      const expectedTopic = resolveExpectedTopic(event);
      const rawBody = decodeBody(event);
      verifySignature(event, rawBody);
      const payload = parsePayload(rawBody);
      const normalizedEvent = normalizeEvent(event, payload, expectedTopic);

      infoLogger('Received Shopify webhook event', normalizedEvent);

      return jsonOk({ received: true, event: normalizedEvent }, { origin });
    } catch (error) {
      logError('Failed to receive Shopify webhook', error, {
        topicPath: event.pathParameters?.topic || '',
      });
      return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_WEBHOOK_RECEIVE_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();