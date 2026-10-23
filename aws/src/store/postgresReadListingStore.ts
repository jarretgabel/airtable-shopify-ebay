import { logError } from '../shared/logging.js';
import type { ListingSource, ListingStore } from './listingStore.js';

export interface PostgresReadStoreOptions {
  /** Serves reads. */
  reader: ListingStore;
  /** Serves reads when the reader fails (unsupported formula, record missing, database down) and anything the reader doesn't own. */
  fallback: ListingStore;
  /** Serves every write; keeps Airtable as the source of truth and mirrors to Postgres. */
  writer: ListingStore;
  onFallback?: (operation: string, source: ListingSource, error: unknown) => void;
}

function defaultOnFallback(operation: string, source: ListingSource, error: unknown): void {
  logError('postgres_read_fallback', error, { operation, source });
  console.info(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: 'AirtableShopifyEbay/DataBackend',
        Dimensions: [['Source', 'Operation']],
        Metrics: [{ Name: 'PostgresReadFallback', Unit: 'Count' }],
      }],
    },
    Source: source,
    Operation: operation,
    PostgresReadFallback: 1,
  }));
}

/** Phase 7: reads come from Postgres, writes still go to Airtable first. A failed Postgres read falls back to Airtable, so users never see a Postgres-only failure. */
export function createPostgresReadListingStore(options: PostgresReadStoreOptions): ListingStore {
  const { reader, fallback, writer } = options;
  const onFallback = options.onFallback ?? defaultOnFallback;

  async function read<T>(operation: string, source: ListingSource, fromPostgres: () => Promise<T>, fromAirtable: () => Promise<T>): Promise<T> {
    try {
      return await fromPostgres();
    } catch (error) {
      try {
        onFallback(operation, source, error);
      } catch {
        // Reporting must never fail the request.
      }
      return fromAirtable();
    }
  }

  return {
    getRecords: (source, opts) => read('getRecords', source, () => reader.getRecords(source, opts), () => fallback.getRecords(source, opts)),
    getRecord: (source, id) => read('getRecord', source, () => reader.getRecord(source, id), () => fallback.getRecord(source, id)),
    getRecordsSummary: (source) => read('getRecordsSummary', source, () => reader.getRecordsSummary(source), () => fallback.getRecordsSummary(source)),
    getFieldMetadata: (source) => fallback.getFieldMetadata(source),
    createRecord: (source, fields, opts) => writer.createRecord(source, fields, opts),
    updateRecord: (source, id, fields, opts) => writer.updateRecord(source, id, fields, opts),
    deleteRecord: (source, id) => writer.deleteRecord(source, id),
    uploadAttachment: (source, id, fieldId, payload) => writer.uploadAttachment(source, id, fieldId, payload),
  };
}
