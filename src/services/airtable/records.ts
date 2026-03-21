import { AxiosInstance } from 'axios';
import { AirtableRecord } from '@/types/airtable';

export async function fetchAllRecords(
  client: AxiosInstance,
  tableName: string,
  view?: string,
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined = undefined;

  while (true) {
    const params: Record<string, string> = {};
    if (view) {
      params.view = view;
    }
    if (offset) {
      params.offset = offset;
    }

    const response = await client.get(`/${tableName}`, { params });
    records.push(...response.data.records);

    if (!response.data.offset) {
      break;
    }
    offset = response.data.offset;
  }

  return records;
}

export function getAirtableErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

export function isRetryableReferenceStatus(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 404;
}