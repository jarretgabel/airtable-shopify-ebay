import { createHash } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { gzipSync } from 'node:zlib';
import { HttpError } from './errors.js';

interface JsonResponseOptions {
  origin?: string;
  cookies?: string[];
  /** Request Accept-Encoding. When it allows gzip, large bodies are compressed to stay under Lambda's 6 MB response limit. */
  acceptEncoding?: string;
  /** Adds a content-hash ETag and answers 304 when the request's If-None-Match still matches. Always revalidated (no-cache). */
  etag?: { ifNoneMatch?: string };
  /** Extra response headers; exposed to cross-origin callers. */
  extraHeaders?: Record<string, string>;
}

const GZIP_MIN_BYTES = 256 * 1024;

const DEFAULT_ALLOWED_ORIGINS = ['http://127.0.0.1:3000', 'http://localhost:3000'];

function normalizeOrigin(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const origin = new URL(trimmed);
    return `${origin.protocol}//${origin.host}`;
  } catch {
    return undefined;
  }
}

function getAllowedOrigins(): string[] {
  const configured = (process.env.APP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => normalizeOrigin(value) || '')
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function buildJsonHeaders(origin?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(origin
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-headers': 'content-type,authorization,x-csrf-token',
          'access-control-allow-credentials': 'true',
          vary: 'origin',
        }
      : {}),
  };
}

interface IntegerParamOptions {
  defaultValue: number;
  min: number;
  max: number;
  service: string;
  code: string;
}

export function jsonOk(body: unknown, options: JsonResponseOptions = {}): APIGatewayProxyResultV2 {
  const serialized = JSON.stringify(body);
  const headers = buildJsonHeaders(options.origin);
  const cookies = options.cookies ? { cookies: options.cookies } : {};
  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders);
    if (options.origin) headers['access-control-expose-headers'] = Object.keys(options.extraHeaders).join(',');
  }

  if (options.etag) {
    const tag = `"${createHash('sha1').update(serialized).digest('base64url')}"`;
    headers.etag = tag;
    headers['cache-control'] = 'private, no-cache';
    if (options.etag.ifNoneMatch?.split(',').some((candidate) => candidate.trim().replace(/^W\//, '') === tag)) {
      return { statusCode: 304, headers: { ...headers, ...(options.origin ? { 'access-control-expose-headers': [headers['access-control-expose-headers'], 'etag'].filter(Boolean).join(',') } : {}) }, ...cookies, body: '' };
    }
  }

  if (options.acceptEncoding !== undefined) {
    headers.vary = headers.vary ? `${headers.vary}, accept-encoding` : 'accept-encoding';
    if (/\bgzip\b/i.test(options.acceptEncoding) && Buffer.byteLength(serialized) >= GZIP_MIN_BYTES) {
      return {
        statusCode: 200,
        headers: { ...headers, 'content-encoding': 'gzip' },
        ...cookies,
        isBase64Encoded: true,
        body: gzipSync(serialized).toString('base64'),
      };
    }
  }

  return { statusCode: 200, headers, ...cookies, body: serialized };
}

export function jsonError(statusCode: number, body: unknown, options: JsonResponseOptions = {}): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: buildJsonHeaders(options.origin),
    ...(options.cookies ? { cookies: options.cookies } : {}),
    body: JSON.stringify(body),
  };
}

export function getRequestOrigin(event: APIGatewayProxyEventV2): string | undefined {
  const origin = normalizeOrigin(event.headers.origin || event.headers.Origin || '');
  if (!origin) {
    return undefined;
  }

  return getAllowedOrigins().includes(origin) ? origin : undefined;
}

export function getOptionalQueryParam(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const value = event.queryStringParameters?.[name]?.trim();
  return value ? value : undefined;
}

export function requireQueryParam(
  event: APIGatewayProxyEventV2,
  name: string,
  service: string,
  code: string,
): string {
  const value = getOptionalQueryParam(event, name);
  if (!value) {
    throw new HttpError(400, `${name} is required`, { service, code, retryable: false });
  }
  return value;
}

export function requirePathParam(
  event: APIGatewayProxyEventV2,
  name: string,
  service: string,
  code: string,
): string {
  const value = event.pathParameters?.[name]?.trim();
  if (!value) {
    throw new HttpError(400, `${name} is required`, { service, code, retryable: false });
  }
  return value;
}

export function requireJsonBody<T>(
  event: APIGatewayProxyEventV2,
  service: string,
  code: string,
): T {
  if (!event.body) {
    throw new HttpError(400, 'Request body is required', { service, code, retryable: false });
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON', {
      service,
      code,
      retryable: false,
    });
  }
}

export function readIntegerQueryParam(
  event: APIGatewayProxyEventV2,
  name: string,
  options: IntegerParamOptions,
): number {
  const rawValue = getOptionalQueryParam(event, name);
  if (!rawValue) {
    return options.defaultValue;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < options.min) {
    throw new HttpError(400, `${name} must be an integer >= ${options.min}`, {
      service: options.service,
      code: options.code,
      retryable: false,
    });
  }

  return Math.min(parsedValue, options.max);
}