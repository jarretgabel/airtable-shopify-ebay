import { HttpError } from '../../shared/errors.js';
import { requireSecret } from '../../shared/secrets.js';

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
  error?: {
    message?: string;
    type?: string;
  };
}

export interface AirtableMetadataField {
  id: string;
  name: string;
  type: string;
  options?: {
    choices?: Array<{ name: string }>;
  };
}

interface AirtableMetadataTable {
  id: string;
  fields?: AirtableMetadataField[];
}

interface AirtableMetadataResponse {
  tables?: AirtableMetadataTable[];
}

interface AirtableRecordResponse {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
  error?: {
    message?: string;
    type?: string;
  };
}

interface AirtableCreateResponse {
  records: AirtableRecord[];
  error?: {
    message?: string;
    type?: string;
  };
}

interface AirtableWriteOptions {
  typecast?: boolean;
}

interface AirtableListOptions {
  fields?: string[];
  filterByFormula?: string;
  maxRecords?: number;
}

interface AirtableAttachmentUploadPayload {
  filename: string;
  contentType: string;
  file: string;
}

const AIRTABLE_MAX_RETRY_ATTEMPTS = 2;
const AIRTABLE_RETRY_BASE_DELAY_MS = 300;
const AIRTABLE_RETRY_MAX_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function parseRetryAfterDelayMs(retryAfterValue: string | null): number | null {
  if (!retryAfterValue) return null;

  const numericSeconds = Number.parseFloat(retryAfterValue);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return Math.round(numericSeconds * 1000);
  }

  const asDate = Date.parse(retryAfterValue);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
}

function computeRetryDelayMs(attempt: number, retryAfterValue: string | null): number {
  const retryAfterDelay = parseRetryAfterDelayMs(retryAfterValue);
  if (retryAfterDelay !== null) {
    return Math.min(retryAfterDelay, AIRTABLE_RETRY_MAX_DELAY_MS);
  }

  const exponentialDelay = AIRTABLE_RETRY_BASE_DELAY_MS * (2 ** attempt);
  const jitter = Math.floor(Math.random() * 120);
  return Math.min(exponentialDelay + jitter, AIRTABLE_RETRY_MAX_DELAY_MS);
}

async function airtableFetchWithRetry(input: string, init: RequestInit): Promise<Response> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(input, init);
      const canRetry = isRetryableStatus(response.status) && attempt < AIRTABLE_MAX_RETRY_ATTEMPTS;
      if (!canRetry) {
        return response;
      }

      const delayMs = computeRetryDelayMs(attempt, response.headers.get('retry-after'));
      attempt += 1;
      await sleep(delayMs);
    } catch (error) {
      if (attempt >= AIRTABLE_MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      const delayMs = computeRetryDelayMs(attempt, null);
      attempt += 1;
      await sleep(delayMs);
    }
  }
}

function buildUrl(baseId: string, tableName: string, view?: string, offset?: string, options: AirtableListOptions = {}): string {
  const encodedTableName = encodeURIComponent(tableName);
  const url = new URL(`${AIRTABLE_API_BASE}/${baseId}/${encodedTableName}`);

  if (view) {
    url.searchParams.set('view', view);
  }

  if (offset) {
    url.searchParams.set('offset', offset);
  }

  for (const field of options.fields ?? []) {
    const trimmed = field.trim();
    if (trimmed) {
      url.searchParams.append('fields[]', trimmed);
    }
  }

  if (options.filterByFormula) {
    url.searchParams.set('filterByFormula', options.filterByFormula);
  }

  if (typeof options.maxRecords === 'number' && Number.isFinite(options.maxRecords) && options.maxRecords > 0) {
    url.searchParams.set('maxRecords', String(Math.trunc(options.maxRecords)));
  }

  return url.toString();
}

function buildRecordUrl(baseId: string, tableName: string, recordId?: string): string {
  const encodedTableName = encodeURIComponent(tableName);
  const encodedRecordId = recordId ? `/${encodeURIComponent(recordId)}` : '';
  return `${AIRTABLE_API_BASE}/${baseId}/${encodedTableName}${encodedRecordId}`;
}

async function fetchPage(baseId: string, tableName: string, view?: string, offset?: string, options: AirtableListOptions = {}): Promise<AirtableListResponse> {
  const response = await airtableFetchWithRetry(buildUrl(baseId, tableName, view, offset, options), {
    headers: {
      Authorization: `Bearer ${requireSecret('AIRTABLE_API_KEY')}`,
    },
  });

  const body = await response.json() as AirtableListResponse;
  if (!response.ok) {
    throw new HttpError(response.status, body.error?.message || `Airtable API error: HTTP ${response.status}`, {
      service: 'airtable',
      code: 'AIRTABLE_HTTP_ERROR',
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  return body;
}

export async function getRecords(baseId: string, tableName: string, view?: string, options: AirtableListOptions = {}): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const page = await fetchPage(baseId, tableName, view, offset, options);
    records.push(...page.records);
    offset = page.offset;
  } while (offset);

  return records;
}

export async function getListings(tableName: string, view?: string): Promise<AirtableRecord[]> {
  return getRecords(requireSecret('AIRTABLE_BASE_ID'), tableName, view);
}

export async function getRecord(
  baseId: string,
  tableName: string,
  recordId: string,
): Promise<AirtableRecord> {
  const response = await airtableFetchWithRetry(buildRecordUrl(baseId, tableName, recordId), {
    headers: {
      Authorization: `Bearer ${requireSecret('AIRTABLE_API_KEY')}`,
    },
  });

  const body = await response.json() as AirtableRecordResponse;
  if (!response.ok) {
    throw new HttpError(response.status, body.error?.message || `Airtable API error: HTTP ${response.status}`, {
      service: 'airtable',
      code: 'AIRTABLE_HTTP_ERROR',
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  return body;
}

export async function createRecord(
  baseId: string,
  tableName: string,
  fields: Record<string, unknown>,
  options: AirtableWriteOptions = {},
): Promise<AirtableRecord> {
  const response = await airtableFetchWithRetry(buildRecordUrl(baseId, tableName), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireSecret('AIRTABLE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [{ fields }],
      ...(options.typecast ? { typecast: true } : {}),
    }),
  });

  const body = await response.json() as AirtableCreateResponse;
  if (!response.ok) {
    throw new HttpError(response.status, body.error?.message || `Airtable API error: HTTP ${response.status}`, {
      service: 'airtable',
      code: 'AIRTABLE_HTTP_ERROR',
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  return body.records[0];
}

export async function updateRecord(
  baseId: string,
  tableName: string,
  recordId: string,
  fields: Record<string, unknown>,
  options: AirtableWriteOptions = {},
): Promise<AirtableRecord> {
  const response = await airtableFetchWithRetry(buildRecordUrl(baseId, tableName, recordId), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${requireSecret('AIRTABLE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields,
      ...(options.typecast ? { typecast: true } : {}),
    }),
  });

  const body = await response.json() as AirtableRecordResponse;
  if (!response.ok) {
    throw new HttpError(response.status, body.error?.message || `Airtable API error: HTTP ${response.status}`, {
      service: 'airtable',
      code: 'AIRTABLE_HTTP_ERROR',
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  return body;
}

export async function deleteRecord(baseId: string, tableName: string, recordId: string): Promise<void> {
  const response = await airtableFetchWithRetry(buildRecordUrl(baseId, tableName, recordId), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${requireSecret('AIRTABLE_API_KEY')}`,
    },
  });

  const body = await response.json().catch(() => ({})) as AirtableRecordResponse;
  if (!response.ok) {
    throw new HttpError(response.status, body.error?.message || `Airtable API error: HTTP ${response.status}`, {
      service: 'airtable',
      code: 'AIRTABLE_HTTP_ERROR',
      retryable: response.status === 429 || response.status >= 500,
    });
  }
}

export async function getTableMetadata(baseId: string, tableId: string): Promise<AirtableMetadataField[]> {
  const response = await airtableFetchWithRetry(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      Authorization: `Bearer ${requireSecret('AIRTABLE_API_KEY')}`,
    },
  });

  const body = await response.json() as AirtableMetadataResponse;
  if (!response.ok) {
    throw new HttpError(response.status, `Airtable metadata error: HTTP ${response.status}`, {
      service: 'airtable',
      code: 'AIRTABLE_METADATA_HTTP_ERROR',
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const table = body.tables?.find((entry) => entry.id === tableId);
  if (!table) {
    throw new HttpError(404, 'Airtable metadata table not found', {
      service: 'airtable',
      code: 'AIRTABLE_METADATA_TABLE_NOT_FOUND',
      retryable: false,
    });
  }

  return table.fields ?? [];
}

export async function uploadAttachment(
  baseId: string,
  recordId: string,
  fieldId: string,
  payload: AirtableAttachmentUploadPayload,
): Promise<void> {
  const response = await airtableFetchWithRetry(
    `https://content.airtable.com/v0/${baseId}/${encodeURIComponent(recordId)}/${encodeURIComponent(fieldId)}/uploadAttachment`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requireSecret('AIRTABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, `Unable to upload attachment (${response.status}).`, {
      service: 'airtable',
      code: 'AIRTABLE_ATTACHMENT_UPLOAD_FAILED',
      retryable: response.status === 429 || response.status >= 500,
    });
  }
}