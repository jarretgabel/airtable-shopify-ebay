export interface MirrorRecord {
  key: string;
  fields: Record<string, unknown>;
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

export interface FieldDifference {
  field: string;
  count: number;
  example: { record: string; postgres: unknown; airtable: unknown };
}

export interface CompareResult {
  postgresRecords: number;
  airtableRecords: number;
  onlyInPostgres: string[];
  onlyInAirtable: string[];
  skippedPending: number;
  identical: number;
  differing: number;
  differences: FieldDifference[];
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/**
 * Compares the Postgres mirror with Airtable, record by record. Records with an unsent outbox write are skipped
 * (they are expected to differ), and fields in `ignoreFields` (attachments, whose URLs differ by design) are not compared.
 */
export function compareWithAirtable(
  postgres: MirrorRecord[],
  airtable: AirtableRecord[],
  options: { pendingKeys?: Set<string>; ignoreFields?: Set<string> } = {},
): CompareResult {
  const pending = options.pendingKeys ?? new Set<string>();
  const ignore = options.ignoreFields ?? new Set<string>();
  const airtableById = new Map(airtable.map((record) => [record.id, record]));
  const postgresKeys = new Set(postgres.map((record) => record.key));
  const result: CompareResult = {
    postgresRecords: postgres.length,
    airtableRecords: airtable.length,
    onlyInPostgres: [],
    onlyInAirtable: airtable.filter((record) => !postgresKeys.has(record.id) && !pending.has(record.id)).map((record) => record.id),
    skippedPending: 0,
    identical: 0,
    differing: 0,
    differences: [],
  };
  const byField = new Map<string, FieldDifference>();

  for (const record of postgres) {
    if (pending.has(record.key)) {
      result.skippedPending += 1;
      continue;
    }
    const other = airtableById.get(record.key);
    if (!other) {
      result.onlyInPostgres.push(record.key);
      continue;
    }
    const names = new Set([...Object.keys(record.fields), ...Object.keys(other.fields)]);
    let differs = false;
    for (const name of names) {
      if (ignore.has(name)) continue;
      if (stable(record.fields[name]) === stable(other.fields[name])) continue;
      differs = true;
      const existing = byField.get(name);
      if (existing) existing.count += 1;
      else byField.set(name, { field: name, count: 1, example: { record: record.key, postgres: record.fields[name], airtable: other.fields[name] } });
    }
    if (differs) result.differing += 1;
    else result.identical += 1;
  }
  result.differences = [...byField.values()].sort((a, b) => b.count - a.count);
  return result;
}
