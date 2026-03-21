import axios, { AxiosInstance } from 'axios';
import { AirtableRecord, GetRecordsOptions } from '@/types/airtable';

interface ParsedAirtableReference {
  baseId: string;
  tableName: string;
  viewId?: string;
}

function normalizeId(raw: string, prefix: 'app' | 'tbl' | 'viw'): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
}

function parseAirtableReferenceCandidates(
  reference: string,
  fallbackTableName: string,
  defaultBaseId: string,
): ParsedAirtableReference[] {
  const trimmed = reference.trim();
  if (!trimmed) {
    throw new Error('Airtable table reference is empty');
  }

  const cleaned = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^airtable\.com\//, '')
    .replace(/^www\.airtable\.com\//, '')
    .replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);

  if (parts.length < 2) {
    throw new Error(
      'Airtable table reference must be in the format "baseId/tableId" or "baseId/viewId"',
    );
  }

  const firstPart = parts[0];
  const secondPart = parts[1];
  const candidates: ParsedAirtableReference[] = [];
  const fallback = fallbackTableName?.trim();

  const pushUniqueCandidate = (candidate: ParsedAirtableReference) => {
    if (
      candidates.some(
        (current) =>
          current.baseId === candidate.baseId &&
          current.tableName === candidate.tableName &&
          current.viewId === candidate.viewId,
      )
    ) {
      return;
    }
    candidates.push(candidate);
  };

  const secondLooksLikeView = secondPart.startsWith('viw') || !secondPart.startsWith('tbl');

  if (secondLooksLikeView) {
    const viewId = normalizeId(secondPart, 'viw');

    if (firstPart.startsWith('app')) {
      if (!fallback) {
        throw new Error('Airtable table name is required when reference uses a view ID');
      }
      pushUniqueCandidate({
        baseId: normalizeId(firstPart, 'app'),
        tableName: fallback,
        viewId,
      });
      return candidates;
    }

    // Shorthand refs are ambiguous (base/view vs table/view). Prefer current base first
    // to avoid fail-first 403 requests in the browser console.
    pushUniqueCandidate({
      baseId: defaultBaseId,
      tableName: normalizeId(firstPart, 'tbl'),
      viewId,
    });

    if (fallback) {
      pushUniqueCandidate({
        baseId: defaultBaseId,
        tableName: fallback,
        viewId,
      });
    }

    return candidates;
  }

  // Explicit base/table interpretation.
  pushUniqueCandidate({
    baseId: normalizeId(firstPart, 'app'),
    tableName: normalizeId(secondPart, 'tbl'),
  });

  return candidates;
}

class AirtableService {
  private apiKey: string;
  private baseId: string;
  private client: AxiosInstance;

  constructor() {
    this.apiKey = import.meta.env.VITE_AIRTABLE_API_KEY;
    this.baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;

    if (!this.apiKey || !this.baseId) {
      throw new Error('Airtable API key and Base ID must be set in environment variables');
    }

    this.client = this.createClient(this.baseId);
  }

  private createClient(baseId: string): AxiosInstance {
    return axios.create({
      baseURL: `https://api.airtable.com/v0/${baseId}`,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch all records from a specified table
   */
  async getRecords(tableName: string, options: GetRecordsOptions = {}): Promise<AirtableRecord[]> {
    try {
      const records: AirtableRecord[] = [];
      let offset: string | undefined = undefined;

      // Handle pagination
      while (true) {
        const params: Record<string, string> = {};
        if (options.view) {
          params.view = options.view;
        }
        if (offset) {
          params.offset = offset;
        }

        const response = await this.client.get(`/${tableName}`, { params });
        records.push(...response.data.records);

        if (!response.data.offset) {
          break;
        }
        offset = response.data.offset;
      }

      return records;
    } catch (error) {
      console.error(`Error fetching records from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Fetch a single record by ID
   */
  async getRecord(tableName: string, recordId: string): Promise<AirtableRecord> {
    try {
      const response = await this.client.get(`/${tableName}/${recordId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching record ${recordId} from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async createRecord(tableName: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
    try {
      const response = await this.client.post(`/${tableName}`, {
        records: [
          {
            fields,
          },
        ],
      });
      return response.data.records[0];
    } catch (error) {
      console.error(`Error creating record in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update a record
   */
  async updateRecord(
    tableName: string,
    recordId: string,
    fields: Record<string, unknown>
  ): Promise<AirtableRecord> {
    try {
      const response = await this.client.patch(`/${tableName}/${recordId}`, {
        fields,
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating record ${recordId} in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record
   */
  async deleteRecord(tableName: string, recordId: string): Promise<void> {
    try {
      await this.client.delete(`/${tableName}/${recordId}`);
    } catch (error) {
      console.error(`Error deleting record ${recordId} from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Fetch all records from a different Airtable base/table or base/view reference.
   * Supported references: "appXXXX/tblYYYY" or "appXXXX/viwYYYY".
   */
  async getRecordsFromReference(reference: string, fallbackTableName: string): Promise<AirtableRecord[]> {
    const candidates = parseAirtableReferenceCandidates(reference, fallbackTableName, this.baseId);

    let lastError: unknown;

    for (const parsed of candidates) {
      const client = this.createClient(parsed.baseId);

      try {
        const records: AirtableRecord[] = [];
        let offset: string | undefined = undefined;

        while (true) {
          const params: Record<string, string> = {};
          if (parsed.viewId) {
            params.view = parsed.viewId;
          }
          if (offset) {
            params.offset = offset;
          }

          const response = await client.get(`/${parsed.tableName}`, { params });
          records.push(...response.data.records);

          if (!response.data.offset) {
            break;
          }
          offset = response.data.offset;
        }

        return records;
      } catch (error) {
        lastError = error;

        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 401 || status === 403 || status === 404) {
          continue;
        }

        console.error(`Error fetching records from reference ${reference}:`, error);
        throw error;
      }
    }

    console.error(`Error fetching records from reference ${reference}:`, lastError);
    throw lastError;
  }

  /**
   * Update a record in a different Airtable base/table or base/view reference.
   */
  async updateRecordFromReference(
    reference: string,
    fallbackTableName: string,
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<AirtableRecord> {
    const candidates = parseAirtableReferenceCandidates(reference, fallbackTableName, this.baseId);

    let lastError: unknown;

    for (const parsed of candidates) {
      const client = this.createClient(parsed.baseId);

      try {
        const response = await client.patch(`/${parsed.tableName}/${recordId}`, {
          fields,
        });
        return response.data;
      } catch (error) {
        lastError = error;

        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 401 || status === 403 || status === 404) {
          continue;
        }

        console.error(`Error updating record ${recordId} for reference ${reference}:`, error);
        throw error;
      }
    }

    console.error(`Error updating record ${recordId} for reference ${reference}:`, lastError);
    throw lastError;
  }
}

export default new AirtableService();
