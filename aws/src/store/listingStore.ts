import type {
  AirtableConfiguredAttachmentSource,
  AirtableConfiguredMetadataSource,
  AirtableConfiguredRecordsSource,
  AirtableConfiguredRecordsSubset,
  AirtableConfiguredRecordsSummary,
  AirtableConfiguredWriteSource,
} from '../providers/airtable/sources.js';
import type { AirtableMetadataField, AirtableRecord } from '../providers/airtable/client.js';

export type ListingSource = AirtableConfiguredRecordsSource;
export type ListingWriteSource = AirtableConfiguredWriteSource;
export type ListingMetadataSource = AirtableConfiguredMetadataSource;
export type ListingAttachmentSource = AirtableConfiguredAttachmentSource;
export type ListingSubset = AirtableConfiguredRecordsSubset;
export type ListingRecord = AirtableRecord;
export type ListingFieldMetadata = AirtableMetadataField;
export type ListingRecordsSummary = AirtableConfiguredRecordsSummary;

export interface ListingReadOptions {
  fields?: string[];
  filterByFormula?: string;
  subset?: ListingSubset;
  maxRecords?: number;
  searchQuery?: string;
  searchFields?: string[];
}

export interface ListingWriteOptions {
  typecast?: boolean;
}

export interface ListingAttachmentPayload {
  filename: string;
  contentType: string;
  file: string;
}

/** Every storage backend (Airtable, Postgres, dual-write) implements this. Source-level policy stays in the handlers. */
export interface ListingStore {
  getRecords(source: ListingSource, options?: ListingReadOptions): Promise<ListingRecord[]>;
  getRecordsSummary(source: ListingSource): Promise<ListingRecordsSummary>;
  getRecord(source: ListingSource, recordId: string): Promise<ListingRecord>;
  createRecord(source: ListingWriteSource, fields: Record<string, unknown>, options?: ListingWriteOptions): Promise<ListingRecord>;
  updateRecord(source: ListingWriteSource, recordId: string, fields: Record<string, unknown>, options?: ListingWriteOptions): Promise<ListingRecord>;
  deleteRecord(source: ListingWriteSource, recordId: string): Promise<void>;
  getFieldMetadata(source: ListingMetadataSource): Promise<ListingFieldMetadata[]>;
  uploadAttachment(source: ListingAttachmentSource, recordId: string, fieldId: string, payload: ListingAttachmentPayload): Promise<void>;
}
