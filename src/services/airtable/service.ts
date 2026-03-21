import { AxiosInstance } from 'axios';
import { AirtableRecord, GetRecordsOptions } from '@/types/airtable';
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
    this.apiKey = import.meta.env.VITE_AIRTABLE_API_KEY;
    this.baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;

    if (!this.apiKey || !this.baseId) {
      throw new Error('Airtable API key and Base ID must be set in environment variables');
    }

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
        records: [{ fields }],
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
    fields: Record<string, unknown>,
  ): Promise<AirtableRecord> {
    try {
      const response = await this.client.patch(`/${tableName}/${recordId}`, { fields });
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
  async getRecordsFromReference(
    reference: string,
    fallbackTableName: string,
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
        const response = await client.patch(`/${parsed.tableName}/${recordId}`, { fields });
        return response.data;
      } catch (error) {
        lastError = error;
        const status = getAirtableErrorStatus(error);
        if (isRetryableReferenceStatus(status)) {
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
