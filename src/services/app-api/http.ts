import { AppApiHttpError } from './errors';
import { getAppApiBaseUrl } from './flags';

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

function withCsrfHeader(headers: HeadersInit | undefined, method: string | undefined): HeadersInit {
  if (!isUnsafeMethod(method)) {
    return headers ?? {};
  }

  const csrfToken = readStoredCsrfToken();
  if (!csrfToken) {
    return headers ?? {};
  }

  return {
    ...(headers ?? {}),
    'x-csrf-token': csrfToken,
  };
}

function maybePersistCsrfToken(body: unknown): void {
  const csrfToken = (body as CsrfAwareBody | null | undefined)?.csrfToken;
  if (typeof csrfToken === 'string' && csrfToken.trim()) {
    persistCsrfToken(csrfToken.trim());
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = getAppApiBaseUrl();
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(path, base || origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return base ? url.toString() : `${url.pathname}${url.search}`;
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

async function requestJson<T>(path: string, init: RequestInit, params?: Record<string, string | number | undefined>): Promise<T> {
  const response = await fetch(buildUrl(path, params), {
    credentials: 'include',
    ...init,
    headers: withCsrfHeader(init.headers, init.method),
  });

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

export async function getJson<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  return requestJson<T>(path, {
    headers: {
      Accept: 'application/json',
    },
  }, params);
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function deleteJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  });
}