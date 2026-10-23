import { logError } from '../shared/logging.js';
import type { ListingRecord, ListingSource, ListingStore } from './listingStore.js';
import type { PostgresMirror } from './postgresMirror.js';
import { compareRecordSets, defaultReportShadowRead } from './shadowRead.js';
import type { ShadowReport } from './shadowRead.js';

const DEFAULT_SHADOW_READ_TIMEOUT_MS = 3000;

export interface DualListingStoreOptions {
  primary: ListingStore;
  mirror: PostgresMirror;
  /** Defaults to a structured error log plus a CloudWatch EMF metric (PostgresMirrorFailure). */
  /** When set, reads are also run against this store after Airtable answers, and differences are reported. Airtable's answer is always the one returned. */
  shadowReader?: ListingStore;
  shadowReadTimeoutMs?: number;
  onShadowRead?: (report: ShadowReport) => void;
  onMirrorError?: (operation: string, source: ListingSource, recordId: string | undefined, error: unknown) => void;
}

function defaultOnMirrorError(operation: string, source: ListingSource, recordId: string | undefined, error: unknown): void {
  logError('postgres_mirror_failed', error, { operation, source, recordId: recordId ?? null });
  // CloudWatch Embedded Metric Format: Lambda turns this log line into a metric with no extra IAM or infrastructure.
  console.info(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: 'AirtableShopifyEbay/DataBackend',
        Dimensions: [['Source', 'Operation']],
        Metrics: [{ Name: 'PostgresMirrorFailure', Unit: 'Count' }],
      }],
    },
    Source: source,
    Operation: operation,
    PostgresMirrorFailure: 1,
  }));
}

/** Airtable stays the source of truth. Every write is mirrored to Postgres only after Airtable succeeds, and mirror failures never fail the request. */
export function createDualListingStore(options: DualListingStoreOptions): ListingStore {
  const { primary, mirror } = options;
  const onMirrorError = options.onMirrorError ?? defaultOnMirrorError;

  async function shadow(operation: string, source: ListingSource, recordId: string | undefined, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      try {
        onMirrorError(operation, source, recordId, error);
      } catch {
        // Reporting must never fail the request either.
      }
    }
  }

  const { shadowReader } = options;
  const reportShadowRead = options.onShadowRead ?? defaultReportShadowRead;
  const timeoutMs = options.shadowReadTimeoutMs ?? DEFAULT_SHADOW_READ_TIMEOUT_MS;

  // Awaited (not fire-and-forget) because Lambda freezes unfinished work after the response; the timeout bounds the added latency.
  async function shadowRead(
    operation: ShadowReport['operation'],
    source: ListingSource,
    airtableMs: number,
    airtable: ListingRecord[],
    capped: boolean,
    read: (store: ListingStore) => Promise<ListingRecord[]>,
  ): Promise<void> {
    if (!shadowReader) return;
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const base = { operation, source, airtableMs };
    let report: ShadowReport;
    try {
      const timedOut = Symbol('timeout');
      const result = await Promise.race([
        read(shadowReader),
        new Promise<typeof timedOut>((resolve) => { timer = setTimeout(() => resolve(timedOut), timeoutMs); }),
      ]);
      const postgresMs = Date.now() - started;
      if (result === timedOut) {
        report = { ...base, postgresMs, outcome: 'timeout' };
      } else {
        const comparison = compareRecordSets(airtable, result, capped);
        report = { ...base, postgresMs, outcome: comparison.match ? 'match' : 'mismatch', comparison };
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      const postgresMs = Date.now() - started;
      if (code === 'POSTGRES_FORMULA_UNSUPPORTED') {
        report = { ...base, postgresMs, outcome: 'unsupported', errorCode: code };
      } else if (code === 'POSTGRES_RECORD_NOT_FOUND') {
        report = { ...base, postgresMs, outcome: 'mismatch', comparison: compareRecordSets(airtable, [], capped) };
      } else {
        report = { ...base, postgresMs, outcome: 'error', errorCode: code ?? (error instanceof Error ? error.name : 'unknown') };
      }
    } finally {
      clearTimeout(timer);
    }
    try {
      reportShadowRead(report);
    } catch {
      // Reporting must never fail the request.
    }
  }

  return {
    async getRecords(source, read) {
      const started = Date.now();
      const records = await primary.getRecords(source, read);
      await shadowRead('getRecords', source, Date.now() - started, records, read?.maxRecords !== undefined, (store) => store.getRecords(source, read));
      return records;
    },
    getRecordsSummary: (source) => primary.getRecordsSummary(source),
    async getRecord(source, recordId) {
      const started = Date.now();
      const record = await primary.getRecord(source, recordId);
      await shadowRead('getRecord', source, Date.now() - started, [record], false, async (store) => [await store.getRecord(source, recordId)]);
      return record;
    },
    getFieldMetadata: (source) => primary.getFieldMetadata(source),

    async createRecord(source, fields, writeOptions) {
      const record = await primary.createRecord(source, fields, writeOptions);
      await shadow('create', source, record.id, () => mirror.upsertRecord(source, record));
      return record;
    },

    async updateRecord(source, recordId, fields, writeOptions) {
      const record = await primary.updateRecord(source, recordId, fields, writeOptions);
      await shadow('update', source, recordId, () => mirror.upsertRecord(source, record));
      return record;
    },

    async deleteRecord(source, recordId) {
      await primary.deleteRecord(source, recordId);
      await shadow('delete', source, recordId, () => mirror.markDeleted(source, recordId));
    },

    async uploadAttachment(source, recordId, fieldId, payload) {
      await primary.uploadAttachment(source, recordId, fieldId, payload);
      await shadow('attachment', source, recordId, async () => mirror.upsertRecord(source, await primary.getRecord(source, recordId)));
    },
  };
}
