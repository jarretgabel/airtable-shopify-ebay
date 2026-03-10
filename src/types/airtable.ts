export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

export interface GetRecordsOptions {
  view?: string;
}
