import { HttpError } from '../../shared/errors.js';
import { requireSecret } from '../../shared/secrets.js';

const JOTFORM_API_BASE = 'https://api.jotform.com';

interface JotFormApiResponse<T> {
  responseCode: number;
  message: string;
  content: T;
}

export interface JotFormForm {
  id: string;
  username: string;
  title: string;
  height: string;
  status: 'ENABLED' | 'DISABLED' | 'DELETED';
  created_at: string;
  updated_at: string;
  last_submission: string | null;
  new: number;
  count: number;
  type: 'LEGACY' | 'CARD';
  favorite: '0' | '1';
  archived: '0' | '1';
  url: string;
}

export interface JotFormSubmission {
  id: string;
  form_id: string;
  ip: string;
  created_at: string;
  status: 'ACTIVE' | 'DELETED';
  new: '0' | '1';
  flag: '0' | '1';
  notes: string;
  answers: Record<string, unknown>;
}

interface JotFormRequestParams {
  limit?: number;
  offset?: number;
  orderby?: string;
  direction?: string;
}

async function requestJotForm<T>(path: string, params: JotFormRequestParams = {}): Promise<T> {
  const url = new URL(path, JOTFORM_API_BASE);
  url.searchParams.set('apiKey', requireSecret('JOTFORM_API_KEY'));

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpError(response.status, `JotForm API error: HTTP ${response.status} on ${path}`, {
      service: 'jotform',
      code: 'JOTFORM_HTTP_ERROR',
      retryable: response.status >= 500,
    });
  }

  const body = await response.json() as JotFormApiResponse<T>;
  if (body.responseCode !== 200) {
    throw new HttpError(502, `JotForm API error ${body.responseCode}: ${body.message}`, {
      service: 'jotform',
      code: 'JOTFORM_API_ERROR',
      retryable: true,
    });
  }

  return body.content;
}

export function getForms(params: JotFormRequestParams = {}): Promise<JotFormForm[]> {
  return requestJotForm<JotFormForm[]>('/user/forms', params);
}

export function getFormSubmissions(
  formId: string,
  params: JotFormRequestParams = {},
): Promise<JotFormSubmission[]> {
  return requestJotForm<JotFormSubmission[]>(`/form/${formId}/submissions`, params);
}