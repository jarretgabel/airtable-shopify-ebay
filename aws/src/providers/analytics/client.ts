import { HttpError } from '../../shared/errors.js';
import { getOptionalSecret } from '../../shared/secrets.js';

export interface WorkflowEventPayload {
  [key: string]: string | number | boolean | null | undefined;
}

export interface WorkflowEvent {
  name: string;
  at: string;
  payload: WorkflowEventPayload;
}

function isValidPayloadValue(value: unknown): value is WorkflowEventPayload[string] {
  return value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function normalizeWorkflowEvent(input: unknown): WorkflowEvent {
  if (!input || typeof input !== 'object') {
    throw new HttpError(400, 'Workflow event body must be an object.', {
      service: 'analytics',
      code: 'INVALID_ANALYTICS_EVENT',
      retryable: false,
    });
  }

  const record = input as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const at = typeof record.at === 'string' ? record.at.trim() : '';
  const payloadInput = record.payload;

  if (!name) {
    throw new HttpError(400, 'Workflow event name is required.', {
      service: 'analytics',
      code: 'MISSING_ANALYTICS_EVENT_NAME',
      retryable: false,
    });
  }

  if (!at || Number.isNaN(Date.parse(at))) {
    throw new HttpError(400, 'Workflow event timestamp must be a valid ISO date string.', {
      service: 'analytics',
      code: 'INVALID_ANALYTICS_EVENT_TIMESTAMP',
      retryable: false,
    });
  }

  if (payloadInput !== undefined && (!payloadInput || typeof payloadInput !== 'object' || Array.isArray(payloadInput))) {
    throw new HttpError(400, 'Workflow event payload must be an object.', {
      service: 'analytics',
      code: 'INVALID_ANALYTICS_EVENT_PAYLOAD',
      retryable: false,
    });
  }

  const payload: WorkflowEventPayload = {};
  for (const [key, value] of Object.entries((payloadInput ?? {}) as Record<string, unknown>)) {
    if (!isValidPayloadValue(value)) {
      throw new HttpError(400, `Workflow event payload field ${key} has an unsupported value.`, {
        service: 'analytics',
        code: 'INVALID_ANALYTICS_EVENT_PAYLOAD_VALUE',
        retryable: false,
      });
    }

    payload[key] = value;
  }

  return { name, at, payload };
}

export async function forwardWorkflowEvent(event: WorkflowEvent): Promise<void> {
  const endpoint = getOptionalSecret('ANALYTICS_FORWARD_ENDPOINT');
  if (!endpoint) return;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new HttpError(500, 'ANALYTICS_FORWARD_ENDPOINT must be a valid absolute URL.', {
      service: 'analytics',
      code: 'INVALID_ANALYTICS_FORWARD_ENDPOINT',
      retryable: false,
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(response.status, `Analytics forward failed: ${body || response.statusText}`, {
      service: 'analytics',
      code: 'ANALYTICS_FORWARD_FAILED',
      retryable: response.status >= 500,
    });
  }
}