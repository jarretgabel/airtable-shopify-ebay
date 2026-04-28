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

interface AirtableAttachmentUploadPayload {
  filename: string;
  contentType: string;
  file: string;
}

function buildUrl(baseId: string, tableName: string, view?: string, offset?: string): string {
  const encodedTableName = encodeURIComponent(tableName);
  const url = new URL(`${AIRTABLE_API_BASE}/${baseId}/${encodedTableName}`);

  if (view) {
    url.searchParams.set('view', view);
  }

  if (offset) {
    url.searchParams.set('offset', offset);
  }

  return url.toString();
}

function buildRecordUrl(baseId: string, tableName: string, recordId?: string): string {
  const encodedTableName = encodeURIComponent(tableName);
  const encodedRecordId = recordId ? `/${encodeURIComponent(recordId)}` : '';
  return `${AIRTABLE_API_BASE}/${baseId}/${encodedTableName}${encodedRecordId}`;
}

async function fetchPage(baseId: string, tableName: string, view?: string, offset?: string): Promise<AirtableListResponse> {
  const response = await fetch(buildUrl(baseId, tableName, view, offset), {
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

export async function getRecords(baseId: string, tableName: string, view?: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const page = await fetchPage(baseId, tableName, view, offset);
    records.push(...page.records);
    offset = page.offset;
  } while (offset);

  return records;
}

export async function getListings(tableName: string, view?: string): Promise<AirtableRecord[]> {
  return getRecords(requireSecret('AIRTABLE_BASE_ID'), tableName, view);
}

export async function createRecord(
  baseId: string,
  tableName: string,
  fields: Record<string, unknown>,
  options: AirtableWriteOptions = {},
): Promise<AirtableRecord> {
  const response = await fetch(buildRecordUrl(baseId, tableName), {
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
  const response = await fetch(buildRecordUrl(baseId, tableName, recordId), {
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
  const response = await fetch(buildRecordUrl(baseId, tableName, recordId), {
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
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
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
  const response = await fetch(
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