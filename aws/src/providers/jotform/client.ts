import { HttpError } from '../../shared/errors.js';
import { requireSecret } from '../../shared/secrets.js';

const JOTFORM_API_BASE = 'https://api.jotform.com';

interface JotFormApiResponse<T> {
  responseCode: number;
  message: string;
  content: T;
}

interface JotFormWebhookRecord {
  id?: string;
  url?: string;
  webhookURL?: string;
  webhookUrl?: string;
}

export interface JotFormAnswer {
  name: string;
  order: string;
  text: string;
  type: string;
  answer?: string | string[] | Record<string, string>;
  prettyFormat?: string;
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
  answers: Record<string, JotFormAnswer>;
}

interface JotFormRequestParams {
  limit?: number;
  offset?: number;
  orderby?: string;
  direction?: string;
}

export interface JotFormWebhookSubscriptionRecord {
  id: string;
  webhookUrl: string;
}

export interface JotFormWebhookSubscriptionInput {
  formId: string;
  webhookUrl: string;
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

async function requestJotFormFormMutation<T>(formId: string, pathSuffix: string, body: Record<string, unknown>): Promise<T> {
  const url = new URL(`/form/${formId}${pathSuffix}`, JOTFORM_API_BASE);
  url.searchParams.set('apiKey', requireSecret('JOTFORM_API_KEY'));

  const formBody = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    formBody.set(key, String(value));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  });

  const rawPayload = await response.text();
  let payload: JotFormApiResponse<T> | null = null;
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload) as JotFormApiResponse<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new HttpError(response.status, payload?.message?.trim() || `JotForm API error: HTTP ${response.status} on /form/${formId}${pathSuffix}`, {
      service: 'jotform',
      code: 'JOTFORM_HTTP_ERROR',
      retryable: response.status >= 500,
    });
  }

  if (!payload) {
    throw new HttpError(502, 'JotForm API returned an empty response.', {
      service: 'jotform',
      code: 'JOTFORM_API_EMPTY_RESPONSE',
      retryable: false,
    });
  }

  if (payload.responseCode !== 200) {
    throw new HttpError(502, `JotForm API error ${payload.responseCode}: ${payload.message}`, {
      service: 'jotform',
      code: 'JOTFORM_API_ERROR',
      retryable: true,
    });
  }

  return payload.content;
}

function normalizeWebhookRecord(record: JotFormWebhookRecord): JotFormWebhookSubscriptionRecord | null {
  const id = record.id?.trim() ?? '';
  const webhookUrl = record.webhookURL?.trim() || record.webhookUrl?.trim() || record.url?.trim() || '';
  if (!id || !webhookUrl) {
    return null;
  }

  return { id, webhookUrl };
}

function normalizeWebhookCollection(content: unknown): JotFormWebhookSubscriptionRecord[] {
  if (Array.isArray(content)) {
    return content
      .map((record) => (record && typeof record === 'object' ? normalizeWebhookRecord(record as JotFormWebhookRecord) : null))
      .filter((record): record is JotFormWebhookSubscriptionRecord => record !== null);
  }

  if (!content || typeof content !== 'object') {
    return [];
  }

  const record = content as Record<string, unknown>;
  const normalized = normalizeWebhookRecord(record as JotFormWebhookRecord);
  if (normalized) {
    return [normalized];
  }

  return Object.entries(record).flatMap(([id, value]) => {
    if (typeof value === 'string') {
      const webhookUrl = value.trim();
      return webhookUrl ? [{ id: id.trim(), webhookUrl }] : [];
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    const normalizedRecord = normalizeWebhookRecord({ id, ...(value as JotFormWebhookRecord) });
    return normalizedRecord ? [normalizedRecord] : [];
  });
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

export function getSubmission(submissionId: string): Promise<JotFormSubmission> {
  return requestJotForm<JotFormSubmission>(`/submission/${submissionId}`);
}

export function listFormWebhooks(formId: string): Promise<JotFormWebhookSubscriptionRecord[]> {
  return requestJotForm<unknown>(`/form/${formId}/webhooks`)
    .then((content) => normalizeWebhookCollection(content));
}

export async function registerFormWebhook(
  input: JotFormWebhookSubscriptionInput,
): Promise<JotFormWebhookSubscriptionRecord> {
  try {
    const content = await requestJotFormFormMutation<unknown>(input.formId, '/webhooks', { webhookURL: input.webhookUrl });
    const normalized = normalizeWebhookCollection(content)[0];
    if (!normalized) {
      throw new HttpError(502, 'JotForm webhook registration returned no webhook record.', {
        service: 'jotform',
        code: 'JOTFORM_WEBHOOK_REGISTRATION_EMPTY',
        retryable: false,
      });
    }

    return normalized;
  } catch (error) {
    if (error instanceof HttpError && error.message.includes('already in WebHooks List')) {
      const existingWebhook = (await listFormWebhooks(input.formId)).find((webhook) => webhook.webhookUrl === input.webhookUrl);
      if (existingWebhook) {
        return existingWebhook;
      }
    }

    throw error;
  }
}

export async function deleteFormWebhook(formId: string, webhookId: string): Promise<void> {
  const url = new URL(`/form/${formId}/webhooks/${webhookId}`, JOTFORM_API_BASE);
  url.searchParams.set('apiKey', requireSecret('JOTFORM_API_KEY'));

  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new HttpError(response.status, `JotForm API error: HTTP ${response.status} on /form/${formId}/webhooks/${webhookId}`, {
      service: 'jotform',
      code: 'JOTFORM_HTTP_ERROR',
      retryable: response.status >= 500,
    });
  }

  const payload = await response.json() as JotFormApiResponse<unknown>;
  if (payload.responseCode !== 200) {
    throw new HttpError(502, `JotForm API error ${payload.responseCode}: ${payload.message}`, {
      service: 'jotform',
      code: 'JOTFORM_API_ERROR',
      retryable: true,
    });
  }
}