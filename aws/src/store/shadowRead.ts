import { logInfo } from '../shared/logging.js';
import type { ListingRecord, ListingSource } from './listingStore.js';

export type ShadowOutcome = 'match' | 'mismatch' | 'unsupported' | 'timeout' | 'error';

export interface ShadowComparison {
  match: boolean;
  airtableCount: number;
  postgresCount: number;
  missingInPostgres: string[];
  extraInPostgres: string[];
  fieldMismatches: Array<{ id: string; fields: string[] }>;
}

export interface ShadowReport {
  operation: 'getRecords' | 'getRecord';
  source: ListingSource;
  outcome: ShadowOutcome;
  airtableMs: number;
  postgresMs: number;
  comparison?: ShadowComparison;
  errorCode?: string;
}

const SAMPLE_LIMIT = 5;

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function differingFields(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...names].filter((name) => canonical(a[name] ?? null) !== canonical(b[name] ?? null)).sort();
}

/**
 * Compares by record id, ignoring order. When the read was capped (maxRecords), the two backends may legitimately
 * pick different rows, so only the count and the fields of shared rows are checked. Field values are never reported, only names.
 */
export function compareRecordSets(airtable: ListingRecord[], postgres: ListingRecord[], capped: boolean): ShadowComparison {
  const pgById = new Map(postgres.map((record) => [record.id, record]));
  const airtableIds = new Set(airtable.map((record) => record.id));
  const missingInPostgres: string[] = [];
  const fieldMismatches: ShadowComparison['fieldMismatches'] = [];
  let missingTotal = 0;
  let mismatchTotal = 0;

  for (const record of airtable) {
    const other = pgById.get(record.id);
    if (!other) {
      if (!capped) {
        missingTotal += 1;
        if (missingInPostgres.length < SAMPLE_LIMIT) missingInPostgres.push(record.id);
      }
      continue;
    }
    const fields = differingFields(record.fields, other.fields);
    if (fields.length > 0) {
      mismatchTotal += 1;
      if (fieldMismatches.length < SAMPLE_LIMIT) fieldMismatches.push({ id: record.id, fields });
    }
  }

  const extraAll = capped ? [] : postgres.filter((record) => !airtableIds.has(record.id)).map((record) => record.id);
  return {
    match: missingTotal === 0 && mismatchTotal === 0 && extraAll.length === 0 && airtable.length === postgres.length,
    airtableCount: airtable.length,
    postgresCount: postgres.length,
    missingInPostgres,
    extraInPostgres: extraAll.slice(0, SAMPLE_LIMIT),
    fieldMismatches,
  };
}

export function defaultReportShadowRead(report: ShadowReport): void {
  logInfo('postgres_shadow_read', { ...report });
  // CloudWatch Embedded Metric Format: one line yields mismatch counts and both latencies per source and operation.
  console.info(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: 'AirtableShopifyEbay/DataBackend',
        Dimensions: [['Source', 'Operation']],
        Metrics: [
          { Name: 'ShadowReadMismatch', Unit: 'Count' },
          { Name: 'ShadowReadError', Unit: 'Count' },
          { Name: 'AirtableReadMs', Unit: 'Milliseconds' },
          { Name: 'PostgresReadMs', Unit: 'Milliseconds' },
        ],
      }],
    },
    Source: report.source,
    Operation: report.operation,
    ShadowReadMismatch: report.outcome === 'mismatch' ? 1 : 0,
    ShadowReadError: report.outcome === 'error' || report.outcome === 'timeout' ? 1 : 0,
    AirtableReadMs: report.airtableMs,
    PostgresReadMs: report.postgresMs,
  }));
}
