import axios, { AxiosInstance } from 'axios';
import { AirtableRecord, GetRecordsOptions } from '@/types/airtable';

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

    this.client = axios.create({
      baseURL: `https://api.airtable.com/v0/${this.baseId}`,
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
}

export default new AirtableService();
