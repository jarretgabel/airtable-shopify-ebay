import type { AirtableRecord } from '@/types/airtable';

export type InventoryFieldType = string;

export type InventoryDraftValue = boolean | string | string[];

export interface InventoryFieldMetadata {
  id: string;
  name: string;
  type: InventoryFieldType;
  editable: boolean;
  choices: string[];
}

export interface InventoryDirectoryData {
  records: AirtableRecord[];
  fields: InventoryFieldMetadata[];
}