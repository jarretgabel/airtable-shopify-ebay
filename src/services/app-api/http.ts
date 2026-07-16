import { AppApiHttpError } from './errors';
import { getAppApiBaseUrl, isLocalBrowserSession } from './flags';

function getProcessEnvVar(name: string): string | undefined {
  const runtimeGlobal = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtimeGlobal.process?.env?.[name];
}

interface ApiErrorBody {
  message?: string;
  service?: string;
  code?: string;
  retryable?: boolean;
}

interface CsrfAwareBody {
  csrfToken?: string;
}

const CSRF_STORAGE_KEY = 'app_api_csrf_token';
const APP_API_REQUEST_TIMEOUT_MS = 12000;

export interface AppApiRequestOptions {
  timeoutMs?: number;
}

let csrfTokenCache: string | null = null;

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readStoredCsrfToken(): string {
  if (csrfTokenCache !== null) {
    return csrfTokenCache;
  }

  const stored = canUseSessionStorage() ? window.sessionStorage.getItem(CSRF_STORAGE_KEY) || '' : '';
  csrfTokenCache = stored;
  return stored;
}

function persistCsrfToken(token: string): void {
  csrfTokenCache = token;
  if (canUseSessionStorage()) {
    if (token) {
      window.sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
    }
  }
}

function isUnsafeMethod(method: string | undefined): boolean {
  const normalized = (method || 'GET').toUpperCase();
  return normalized !== 'GET' && normalized !== 'HEAD' && normalized !== 'OPTIONS';
}


function withAuthAndCsrfHeader(headers: HeadersInit | undefined, method: string | undefined): HeadersInit {
  let result: HeadersInit = headers ?? {};
  const airtableApiKey = getProcessEnvVar('VITE_AIRTABLE_API_KEY');

  // Add Authorization and X-API-KEY headers for API key if present (Node.js scripts)
  if (airtableApiKey) {
    result = {
      ...result,
      Authorization: `Bearer ${airtableApiKey}`,
      'X-API-KEY': airtableApiKey,
    };
  }

  // Add CSRF token for unsafe methods
  if (isUnsafeMethod(method)) {
    const csrfToken = readStoredCsrfToken();
    if (csrfToken) {
      result = {
        ...result,
        'x-csrf-token': csrfToken,
      };
    }
  }

  return result;
}

function maybePersistCsrfToken(body: unknown): void {
  const csrfToken = (body as CsrfAwareBody | null | undefined)?.csrfToken;
  if (typeof csrfToken === 'string' && csrfToken.trim()) {
    persistCsrfToken(csrfToken.trim());
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  if (typeof window !== 'undefined' && isLocalBrowserSession()) {
    const url = new URL(path, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  const configuredBaseUrl = getAppApiBaseUrl().trim();
  const processBaseUrl = getProcessEnvVar('VITE_APP_API_BASE_URL')?.trim() ?? '';
  const base = configuredBaseUrl
    || processBaseUrl
    || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const url = new URL(path, base);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function shouldUseRequestTimeout(): boolean {
  const nodeEnv = getProcessEnvVar('NODE_ENV');
  const vitest = getProcessEnvVar('VITEST');
  return nodeEnv !== 'test' && vitest !== 'true';
}

function buildRequestSignal(
  existingSignal: AbortSignal | null | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const onAbort = () => {
    controller.abort();
  };

  if (existingSignal) {
    if (existingSignal.aborted) {
      controller.abort();
    } else {
      existingSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      if (existingSignal) {
        existingSignal.removeEventListener('abort', onAbort);
      }
    },
  };
}

async function readErrorBody(response: Response): Promise<ApiErrorBody & { message: string }> {
  const fallbackMessage = `Request failed: ${response.status}`;
  const text = await response.text();

  if (!text) {
    return { message: fallbackMessage };
  }

  try {
    const body = JSON.parse(text) as ApiErrorBody;
    if (body?.message) {
      return {
        ...body,
        message: body.message,
      };
    }
  } catch {
    return { message: text };
  }

  return { message: fallbackMessage };
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  params?: Record<string, string | number | undefined>,
  options: AppApiRequestOptions = {},
): Promise<T> {
  if (isLocalBrowserSession() && /^https?:\/\//i.test(path)) {
    const requestOrigin = new URL(path).origin;
    if (requestOrigin !== window.location.origin) {
      throw new AppApiHttpError('Remote app API URLs are blocked in localhost browser sessions.', {
        statusCode: 403,
        code: 'LOCAL_REMOTE_API_BLOCKED',
        retryable: false,
      });
    }
  }

  const timeoutEnabled = shouldUseRequestTimeout();
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
    ? Number(options.timeoutMs)
    : APP_API_REQUEST_TIMEOUT_MS;
  const timeoutContext = timeoutEnabled ? buildRequestSignal(init.signal, timeoutMs) : null;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      credentials: 'include',
      ...init,
      ...(timeoutContext ? { signal: timeoutContext.signal } : {}),
      headers: withAuthAndCsrfHeader(init.headers, init.method),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new AppApiHttpError(`Request timed out after ${timeoutMs}ms.`, {
        statusCode: 504,
        code: 'APP_API_TIMEOUT',
        retryable: true,
      });
    }

    throw error;
  } finally {
    timeoutContext?.cleanup();
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new AppApiHttpError(body.message, {
      statusCode: response.status,
      service: body.service,
      code: body.code,
      retryable: body.retryable,
    });
  }

  const body = await response.json() as T;
  maybePersistCsrfToken(body);
  return body;
}

export function clearCsrfToken(): void {
  persistCsrfToken('');
}

export async function getJson<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  options?: AppApiRequestOptions,
): Promise<T> {
  return requestJson<T>(path, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  }, params, options);
}

export async function postJson<T>(path: string, body: unknown, options?: AppApiRequestOptions): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, undefined, options);
}

export async function patchJson<T>(path: string, body: unknown, options?: AppApiRequestOptions): Promise<T> {
  return requestJson<T>(path, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, undefined, options);
}

export async function deleteJson<T>(path: string, options?: AppApiRequestOptions): Promise<T> {
  return requestJson<T>(path, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  }, undefined, options);
}