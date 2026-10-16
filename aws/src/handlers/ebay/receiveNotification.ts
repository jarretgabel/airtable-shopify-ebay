import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getNotificationPublicKey, getOrderLineItems } from '../../providers/ebay/client.js';
import {
  buildEbayNotificationEndpoint,
  computeEbayChallengeResponse,
  describePayloadShape,
  mapEbayNotification,
  verifyEbayNotificationSignature,
  type EbayNotificationEnvelope,
  type MappedEbayOrderEvent,
} from '../../services/ebayNotifications.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getOptionalSecret } from '../../shared/secrets.js';
import { createHandler as createListingWebhookHandler } from './receiveWebhook.js';

interface EbayNotificationDependencies {
  getVerificationToken?: () => string | undefined;
  getEndpoint?: () => string | undefined;
  verifySignature?: typeof verifyEbayNotificationSignature;
  getOrderLineItems?: typeof getOrderLineItems;
  processEvent?: (payload: Record<string, unknown>) => Promise<{ statusCode: number }>;
}

function readHeader(event: APIGatewayProxyEventV2, name: string): string {
  const match = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1]?.trim() || '';
}

function readRawBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) {
    return '';
  }

  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}

function defaultEndpoint(): string | undefined {
  return buildEbayNotificationEndpoint(getOptionalSecret('EBAY_WEBHOOK_BASE_URL') ?? '') || undefined;
}

// Signature was already verified, so the listing handler's own shared-secret check is skipped.
function createDefaultProcessEvent(): NonNullable<EbayNotificationDependencies['processEvent']> {
  const listingHandler = createListingWebhookHandler({ getWebhookSecret: () => undefined });

  return async (payload) => {
    const result = await listingHandler({
      version: '2.0',
      routeKey: '$default',
      rawPath: '/api/hooks/ebay/listings',
      rawQueryString: '',
      headers: { 'content-type': 'application/json' },
      requestContext: { http: { method: 'POST', path: '/api/hooks/ebay/listings' } },
      isBase64Encoded: false,
      body: JSON.stringify(payload),
    } as unknown as APIGatewayProxyEventV2);

    return { statusCode: typeof result === 'string' ? 200 : result.statusCode ?? 200 };
  };
}

export function createHandler(dependencies: EbayNotificationDependencies = {}) {
  const getVerificationToken = dependencies.getVerificationToken ?? (() => getOptionalSecret('EBAY_NOTIFICATION_VERIFICATION_TOKEN'));
  const getEndpoint = dependencies.getEndpoint ?? defaultEndpoint;
  const verifySignature = dependencies.verifySignature ?? verifyEbayNotificationSignature;
  const lookupOrderLineItems = dependencies.getOrderLineItems ?? getOrderLineItems;
  const processEvent = dependencies.processEvent ?? createDefaultProcessEvent();

  async function answerChallenge(event: APIGatewayProxyEventV2, origin: string | undefined): Promise<APIGatewayProxyResultV2> {
    const challengeCode = getOptionalQueryParam(event, 'challenge_code')?.trim();
    if (!challengeCode) {
      throw new HttpError(400, 'challenge_code is required.', { service: 'ebay', code: 'EBAY_CHALLENGE_CODE_REQUIRED', retryable: false });
    }

    const verificationToken = getVerificationToken()?.trim();
    const endpoint = getEndpoint()?.trim();
    if (!verificationToken || !endpoint) {
      throw new HttpError(503, 'eBay notification verification token and endpoint are not configured.', {
        service: 'ebay',
        code: 'EBAY_NOTIFICATION_NOT_CONFIGURED',
        retryable: true,
      });
    }

    return jsonOk({ challengeResponse: computeEbayChallengeResponse(challengeCode, verificationToken, endpoint) }, { origin });
  }

  async function receiveNotification(event: APIGatewayProxyEventV2, origin: string | undefined): Promise<APIGatewayProxyResultV2> {
    const rawBody = readRawBody(event);
    await verifySignature({
      signatureHeader: readHeader(event, 'x-ebay-signature'),
      rawBody,
      getPublicKey: getNotificationPublicKey,
    });

    let envelope: EbayNotificationEnvelope;
    try {
      envelope = JSON.parse(rawBody) as EbayNotificationEnvelope;
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON', { service: 'ebay', code: 'INVALID_EBAY_NOTIFICATION_BODY', retryable: false });
    }

    let mapped;
    try {
      mapped = await mapEbayNotification(envelope, { getOrderLineItems: lookupOrderLineItems });
    } catch (error) {
      // 401/403 means the token or its scopes are wrong. Fixing that and letting eBay redeliver recovers the sale,
      // whereas acknowledging it would lose the sale silently.
      const status = getStatusCode(error);
      if (status >= 500 || status === 401 || status === 403 || status === 429) {
        throw new HttpError(503, 'eBay order lookup failed and the notification should be redelivered.', {
          service: 'ebay',
          code: 'EBAY_NOTIFICATION_LOOKUP_RETRYABLE',
          retryable: true,
        });
      }

      // Other permanent failures (for example an unknown order) are acknowledged so eBay does not disable the subscription.
      logError('eBay notification order lookup failed permanently; the sale was not processed', error, {
        topic: envelope.metadata?.topic,
        notificationId: envelope.notification?.notificationId,
      });
      return jsonOk({ received: true, processed: 0, lookupFailed: true }, { origin });
    }

    if (mapped.kind === 'ignored') {
      logInfo('Ignored eBay notification', {
        reason: mapped.reason,
        notificationId: envelope.notification?.notificationId,
        payloadShape: describePayloadShape(envelope.notification?.data),
      });
      return jsonOk({ received: true, ignored: mapped.reason }, { origin });
    }

    let retry = false;
    const outcomes: Array<{ listingId: string; statusCode: number }> = [];
    for (const mappedEvent of mapped.events) {
      const { statusCode } = await processEvent({ ...mappedEvent } as MappedEbayOrderEvent & Record<string, unknown>);
      outcomes.push({ listingId: mappedEvent.listingId, statusCode });
      if (statusCode >= 500) {
        retry = true;
      } else if (statusCode >= 400) {
        logInfo('eBay notification event was not applied', { listingId: mappedEvent.listingId, orderId: mappedEvent.orderId, statusCode });
      }
    }

    if (retry) {
      throw new HttpError(503, 'eBay sale processing failed and should be retried.', {
        service: 'ebay',
        code: 'EBAY_NOTIFICATION_RETRYABLE',
        retryable: true,
      });
    }

    return jsonOk({ received: true, processed: outcomes.length, outcomes }, { origin });
  }

  return async function receiveEbayNotificationHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      return event.requestContext.http.method === 'GET'
        ? await answerChallenge(event, origin)
        : await receiveNotification(event, origin);
    } catch (error) {
      logError('eBay notification handling failed', error);
      return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_NOTIFICATION_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();
