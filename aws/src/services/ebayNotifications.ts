import { createHash, createVerify } from 'node:crypto';
import { HttpError } from '../shared/errors.js';

export const EBAY_NOTIFICATION_PATH = '/api/hooks/ebay/notifications';

const ALLOWED_DIGESTS = new Set(['SHA1', 'SHA256', 'SHA384', 'SHA512']);

export interface EbayNotificationPublicKey {
  key: string;
  algorithm?: string;
  digest?: string;
}

export interface EbayOrderLineItem {
  legacyItemId?: string;
  sku?: string;
  salePrice?: number;
}

export interface EbayNotificationEnvelope {
  metadata?: { topic?: string };
  notification?: {
    notificationId?: string;
    eventDate?: string;
    // Real ORDER_CONFIRMATION notifications nest everything under data.order (confirmed from eBay's own test notification).
    data?: {
      orderId?: unknown;
      order?: { orderId?: unknown; orderLineItems?: Array<{ listingId?: unknown }> };
    };
  };
}

export interface MappedEbayOrderEvent {
  eventType: 'order.created';
  listingId: string;
  sku: string;
  orderId: string;
  occurredAt: string;
  salePrice?: number;
}

export type MappedEbayNotification =
  | { kind: 'events'; events: MappedEbayOrderEvent[] }
  | { kind: 'ignored'; reason: string };

// The challenge hash includes the endpoint, so the handler and the registration must derive the identical URL.
// A base URL that already ends in /api (as in .env.example) must not produce /api/api/....
export function buildEbayNotificationEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  return trimmed ? `${trimmed}${EBAY_NOTIFICATION_PATH}` : '';
}

export function computeEbayChallengeResponse(challengeCode: string, verificationToken: string, endpoint: string): string {
  return createHash('sha256').update(challengeCode).update(verificationToken).update(endpoint).digest('hex');
}

function invalidSignature(message: string): HttpError {
  return new HttpError(401, message, {
    service: 'ebay',
    code: 'EBAY_NOTIFICATION_SIGNATURE_INVALID',
    retryable: false,
  });
}

function parseSignatureHeader(header: string): { kid: string; signature: string; digest: string } {
  let parsed: { kid?: unknown; signature?: unknown; digest?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    throw invalidSignature('eBay notification signature header is malformed.');
  }

  const kid = typeof parsed?.kid === 'string' ? parsed.kid.trim() : '';
  const signature = typeof parsed?.signature === 'string' ? parsed.signature.trim() : '';
  if (!kid || !signature) {
    throw invalidSignature('eBay notification signature header is incomplete.');
  }

  return { kid, signature, digest: typeof parsed.digest === 'string' ? parsed.digest : '' };
}

// Fails closed. A public-key lookup failure is rethrown untouched so a retryable eBay outage is retried by eBay.
export async function verifyEbayNotificationSignature(input: {
  signatureHeader: string;
  rawBody: string;
  getPublicKey: (keyId: string) => Promise<EbayNotificationPublicKey>;
}): Promise<void> {
  if (!input.signatureHeader.trim()) {
    throw invalidSignature('eBay notification signature header is missing.');
  }

  const header = parseSignatureHeader(input.signatureHeader.trim());
  const publicKey = await input.getPublicKey(header.kid);
  const digest = (publicKey.digest || header.digest || 'SHA1').toUpperCase();
  if (!ALLOWED_DIGESTS.has(digest)) {
    throw invalidSignature('eBay notification digest is not supported.');
  }

  const keyBody = publicKey.key.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  const pem = `-----BEGIN PUBLIC KEY-----\n${keyBody}\n-----END PUBLIC KEY-----`;

  let valid = false;
  try {
    valid = createVerify(digest).update(input.rawBody).verify(pem, header.signature, 'base64');
  } catch {
    valid = false;
  }

  if (!valid) {
    throw invalidSignature('eBay notification signature does not match.');
  }
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Only ORDER_CONFIRMATION is mapped. Cancellation, return and inquiry payload shapes have not been confirmed
// against real notifications, so those topics are logged and ignored instead of guessed at.
export async function mapEbayNotification(
  envelope: EbayNotificationEnvelope,
  dependencies: { getOrderLineItems: (orderId: string) => Promise<EbayOrderLineItem[]> },
): Promise<MappedEbayNotification> {
  const topic = trim(envelope?.metadata?.topic);
  if (!topic) {
    return { kind: 'ignored', reason: 'topic-missing' };
  }

  if (topic !== 'ORDER_CONFIRMATION') {
    return { kind: 'ignored', reason: `topic-not-mapped:${topic}` };
  }

  const data = envelope.notification?.data;
  const orderId = trim(data?.order?.orderId) || trim(data?.orderId);
  if (!orderId) {
    return { kind: 'ignored', reason: 'order-id-missing' };
  }

  const occurredAt = trim(envelope.notification?.eventDate);
  // The notification already lists each line item's listing id; the Fulfillment API is only needed when it does not.
  const inlineItems = (data?.order?.orderLineItems ?? []).map((item) => ({ legacyItemId: trim(item.listingId), sku: '' }));
  const hasInlineIds = inlineItems.some((item) => item.legacyItemId);
  let lineItems: EbayOrderLineItem[];
  if (hasInlineIds) {
    // Inline items carry no price. Looking it up is best effort: a failure must not block the sale itself.
    const priced = await dependencies.getOrderLineItems(orderId).catch((): EbayOrderLineItem[] => []);
    lineItems = inlineItems.map((item) => {
      const match = priced.find((candidate) => trim(candidate.legacyItemId) === item.legacyItemId);
      return match?.salePrice !== undefined ? { ...item, salePrice: match.salePrice } : item;
    });
  } else {
    lineItems = await dependencies.getOrderLineItems(orderId);
  }
  const events = lineItems
    .map((item) => ({ listingId: trim(item.legacyItemId), sku: trim(item.sku), ...(item.salePrice !== undefined ? { salePrice: item.salePrice } : {}) }))
    .filter((item) => item.listingId || item.sku)
    .map((item): MappedEbayOrderEvent => ({ eventType: 'order.created', ...item, orderId, occurredAt }));

  return events.length > 0
    ? { kind: 'events', events }
    : { kind: 'ignored', reason: 'order-has-no-listing-identifiers' };
}

// Key paths only, never values, so unmapped notifications can be logged to learn their shape without storing buyer data.
export function describePayloadShape(value: unknown, prefix = '', depth = 0): string[] {
  if (value === null || typeof value !== 'object' || depth > 5) {
    return prefix ? [prefix] : [];
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? describePayloadShape(value[0], `${prefix}[]`, depth + 1) : [`${prefix}[]`];
  }

  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length === 0
    ? [prefix]
    : entries.flatMap(([key, child]) => describePayloadShape(child, prefix ? `${prefix}.${key}` : key, depth + 1)).sort();
}
