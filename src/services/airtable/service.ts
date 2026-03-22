import { AxiosInstance } from 'axios';
import { AirtableRecord, GetRecordsOptions } from '@/types/airtable';
import { requireEnv } from '@/config/runtimeEnv';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createAirtableClient } from './client';
import {
  fetchAllRecords,
  getAirtableErrorStatus,
  isRetryableReferenceStatus,
} from './records';
import { parseAirtableReferenceCandidates } from './reference';

class AirtableService {
  private apiKey: string;
  private baseId: string;
  private client: AxiosInstance;

  constructor() {
    this.apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
    this.baseId = requireEnv('VITE_AIRTABLE_BASE_ID');

    this.client = this.createClient(this.baseId);
  }

  private createClient(baseId: string): AxiosInstance {
    return createAirtableClient(this.apiKey, baseId);
  }

  /**
   * Fetch all records from a specified table
   */
  async getRecords(tableName: string, options: GetRecordsOptions = {}): Promise<AirtableRecord[]> {
    try {
      return await fetchAllRecords(this.client, tableName, options.view);
    } catch (error) {
      logServiceError('airtable', `Error fetching records from ${tableName}`, error);
      const serviceError = createServiceError({
        service: 'airtable',
        code: 'AIRTABLE_GET_RECORDS_FAILED',
        userMessage: `Failed to load Airtable records from ${tableName}.`,
        retryable: true,
        cause: error,
      });
      const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
      typedError.serviceError = serviceError;
      throw typedError;
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
      logServiceError('airtable', `Error fetching record ${recordId} from ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async createRecord(
    tableName: string,
    fields: Record<string, unknown>,
    options: { typecast?: boolean } = {},
  ): Promise<AirtableRecord> {
    try {
      const response = await this.client.post(`/${tableName}`, {
        records: [{ fields }],
        ...(options.typecast ? { typecast: true } : {}),
      });
      return response.data.records[0];
    } catch (error) {
      logServiceError('airtable', `Error creating record in ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Update a record
   */
  async updateRecord(
    tableName: string,
    recordId: string,
    fields: Record<string, unknown>,
    options: { typecast?: boolean } = {},
  ): Promise<AirtableRecord> {
    try {
      const response = await this.client.patch(`/${tableName}/${recordId}`, {
        fields,
        ...(options.typecast ? { typecast: true } : {}),
      });
      return response.data;
    } catch (error) {
      logServiceError('airtable', `Error updating record ${recordId} in ${tableName}`, error);
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
      logServiceError('airtable', `Error deleting record ${recordId} from ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Fetch all records from a different Airtable base/table or base/view reference.
   * Supported references: "appXXXX/tblYYYY" or "appXXXX/viwYYYY".
   */
  async getRecordsFromReference(
    reference: string,
    fallbackTableName?: string,
  ): Promise<AirtableRecord[]> {
    const candidates = parseAirtableReferenceCandidates(reference, fallbackTableName, this.baseId);
    let lastError: unknown;

    for (const parsed of candidates) {
      const client = this.createClient(parsed.baseId);

      try {
        return await fetchAllRecords(client, parsed.tableName, parsed.viewId);
      } catch (error) {
        lastError = error;
        const status = getAirtableErrorStatus(error);
        if (isRetryableReferenceStatus(status)) {
          continue;
        }
        logServiceError('airtable', `Error fetching records from reference ${reference}`, error);
        throw error;
      }
    }

    logServiceError('airtable', `Error fetching records from reference ${reference}`, lastError);
    throw lastError;
  }

  /**
   * Update a record in a different Airtable base/table or base/view reference.
   */
  async createRecordFromReference(
    reference: string,
    fallbackTableName: string | undefined,
    fields: Record<string, unknown>,
    options: { typecast?: boolean } = {},
  ): Promise<AirtableRecord> {
    const candidates = parseAirtableReferenceCandidates(reference, fallbackTableName, this.baseId);
    let lastError: unknown;

    for (const parsed of candidates) {
      const client = this.createClient(parsed.baseId);

      try {
        const response = await client.post(`/${parsed.tableName}`, {
          records: [{ fields }],
          ...(options.typecast ? { typecast: true } : {}),
        });
        return response.data.records[0];
      } catch (error) {
        lastError = error;
        const status = getAirtableErrorStatus(error);
        if (isRetryableReferenceStatus(status)) {
          continue;
        }
        logServiceError('airtable', `Error creating record for reference ${reference}`, error);
        throw error;
      }
    }

    logServiceError('airtable', `Error creating record for reference ${reference}`, lastError);
    throw lastError;
  }

  /**
   * Update a record in a different Airtable base/table or base/view reference.
   */
  async updateRecordFromReference(
    reference: string,
    fallbackTableName: string | undefined,
    recordId: string,
    fields: Record<string, unknown>,
    options: { typecast?: boolean } = {},
  ): Promise<AirtableRecord> {
    const candidates = parseAirtableReferenceCandidates(reference, fallbackTableName, this.baseId);
    let lastError: unknown;

    for (const parsed of candidates) {
      const client = this.createClient(parsed.baseId);

      try {
        const response = await client.patch(`/${parsed.tableName}/${recordId}`, {
          fields,
          ...(options.typecast ? { typecast: true } : {}),
        });
        return response.data;
      } catch (error) {
        lastError = error;
        const status = getAirtableErrorStatus(error);
        if (isRetryableReferenceStatus(status)) {
          continue;
        }
        logServiceError('airtable', `Error updating record ${recordId} for reference ${reference}`, error);
        throw error;
      }
    }

    logServiceError('airtable', `Error updating record ${recordId} for reference ${reference}`, lastError);
    throw lastError;
  }

  /**
   * Delete a record in a different Airtable base/table or base/view reference.
   */
  async deleteRecordFromReference(
    reference: string,
    fallbackTableName: string | undefined,
    recordId: string,
  ): Promise<void> {
    const candidates = parseAirtableReferenceCandidates(reference, fallbackTableName, this.baseId);
    let lastError: unknown;

    for (const parsed of candidates) {
      const client = this.createClient(parsed.baseId);

      try {
        await client.delete(`/${parsed.tableName}/${recordId}`);
        return;
      } catch (error) {
        lastError = error;
        const status = getAirtableErrorStatus(error);
        if (isRetryableReferenceStatus(status)) {
          continue;
        }
        logServiceError('airtable', `Error deleting record ${recordId} for reference ${reference}`, error);
        throw error;
      }
    }

    logServiceError('airtable', `Error deleting record ${recordId} for reference ${reference}`, lastError);
    throw lastError;
  }
}

export default new AirtableService();
