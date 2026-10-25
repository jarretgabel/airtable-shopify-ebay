import { HttpError } from '../shared/errors.js';
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
  /** Per-source TTL (ms) for caching successful Postgres reads in this Lambda instance. Any write through this store clears that source. */
  cacheTtlMs?: Partial<Record<ListingSource, number>>;
  now?: () => number;
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
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expires: number; value: unknown }>();

  function ttlFor(source: ListingSource): number {
    return options.cacheTtlMs?.[source] ?? 0;
  }

  function invalidate(source: ListingSource): void {
    for (const key of cache.keys()) {
      if (key.startsWith(`${source}|`)) cache.delete(key);
    }
  }

  async function cached<T>(operation: string, source: ListingSource, args: unknown, load: () => Promise<{ value: T; fromPostgres: boolean }>): Promise<T> {
    const ttl = ttlFor(source);
    if (ttl <= 0) return (await load()).value;
    const key = `${source}|${operation}|${JSON.stringify(args ?? null)}`;
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return structuredClone(hit.value) as T;
    const { value, fromPostgres } = await load();
    // Fallback results are never cached, so a recovered database is used immediately.
    if (fromPostgres) cache.set(key, { expires: now() + ttl, value: structuredClone(value) });
    return value;
  }

  async function writeThrough<T>(source: ListingSource, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } finally {
      invalidate(source);
    }
  }

  async function read<T>(operation: string, source: ListingSource, fromPostgres: () => Promise<T>, fromAirtable: () => Promise<T>, args?: unknown): Promise<T> {
    return cached(operation, source, args, async () => {
      try {
        return { value: await fromPostgres(), fromPostgres: true };
      } catch (error) {
        return { value: await fallbackRead(operation, source, error, fromAirtable), fromPostgres: false };
      }
    });
  }

  async function fallbackRead<T>(operation: string, source: ListingSource, error: unknown, fromAirtable: () => Promise<T>): Promise<T> {
    try {
      onFallback(operation, source, error);
    } catch {
      // Reporting must never fail the request.
    }
    return fromAirtable();
  }

  return {
    getRecords: (source, opts) => read('getRecords', source, () => reader.getRecords(source, opts), () => fallback.getRecords(source, opts), opts),
    getRecordsPage: reader.getRecordsPage
      ? (source, opts) => read('getRecordsPage', source, () => reader.getRecordsPage!(source, opts), async () => {
        throw new HttpError(503, 'Paged reads need the Postgres backend.', { service: 'postgres', code: 'POSTGRES_PAGE_UNAVAILABLE', retryable: true });
      }, opts)
      : undefined,
    getRecord: (source, id) => read('getRecord', source, () => reader.getRecord(source, id), () => fallback.getRecord(source, id), id),
    getRecordsSummary: (source) => read('getRecordsSummary', source, () => reader.getRecordsSummary(source), () => fallback.getRecordsSummary(source)),
    getFieldMetadata: (source) => fallback.getFieldMetadata(source),
    createRecord: (source, fields, opts) => writeThrough(source, () => writer.createRecord(source, fields, opts)),
    updateRecord: (source, id, fields, opts) => writeThrough(source, () => writer.updateRecord(source, id, fields, opts)),
    deleteRecord: (source, id) => writeThrough(source, () => writer.deleteRecord(source, id)),
    uploadAttachment: (source, id, fieldId, payload) => writeThrough(source, () => writer.uploadAttachment(source, id, fieldId, payload)),
  };
}
