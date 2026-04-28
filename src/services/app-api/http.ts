import { AppApiHttpError } from './errors';
import { getAppApiBaseUrl } from './flags';

interface ApiErrorBody {
  message?: string;
  service?: string;
  code?: string;
  retryable?: boolean;
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

  return response.json() as Promise<T>;
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