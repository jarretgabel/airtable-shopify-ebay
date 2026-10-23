import type { Client } from 'pg';

export interface BackfillRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

export interface BackfillField {
  id: string;
  name: string;
  type: string;
  options?: unknown;
}

export interface BackfillTableReport {
  tableId: string;
  airtableRecords: number;
  airtableFields: number;
  inserted: number;
  updated: number;
  markedDeleted: number;
  postgresActive: number | null;
}

const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Idempotent: upserts by (base, table, record), clears deleted_at for records that reappear,
// and soft-deletes only rows this full read did not see. Never touches Airtable.
export async function backfillTable(
  client: Client,
  baseId: string,
  tableId: string,
  records: BackfillRecord[],
  fields: BackfillField[],
): Promise<BackfillTableReport> {
  const runStartedAt = (await client.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0].now;
  let inserted = 0;
  let updated = 0;

  await client.query('BEGIN');
  try {
    for (const batch of chunk(records, CHUNK_SIZE)) {
      const payload = JSON.stringify(batch.map((r) => ({ record_id: r.id, fields: r.fields, created: r.createdTime ?? null })));
      const result = await client.query<{ inserted: boolean }>(
        `INSERT INTO records (base_id, table_id, record_id, fields, airtable_created_at, synced_at, deleted_at)
         SELECT $1, $2, x.record_id, x.fields, x.created::timestamptz, now(), NULL
         FROM jsonb_to_recordset($3::jsonb) AS x(record_id text, fields jsonb, created text)
         ON CONFLICT (base_id, table_id, record_id) DO UPDATE
           SET fields = EXCLUDED.fields,
               airtable_created_at = EXCLUDED.airtable_created_at,
               synced_at = EXCLUDED.synced_at,
               deleted_at = NULL
         RETURNING (xmax = 0) AS inserted`,
        [baseId, tableId, payload],
      );
      for (const row of result.rows) {
        if (row.inserted) inserted += 1;
        else updated += 1;
      }
    }

    for (const batch of chunk(fields, CHUNK_SIZE)) {
      const payload = JSON.stringify(batch.map((f) => ({ field_id: f.id, name: f.name, type: f.type, options: f.options ?? {} })));
      await client.query(
        `INSERT INTO airtable_fields (base_id, table_id, field_id, name, type, options, synced_at)
         SELECT $1, $2, x.field_id, x.name, x.type, x.options, now()
         FROM jsonb_to_recordset($3::jsonb) AS x(field_id text, name text, type text, options jsonb)
         ON CONFLICT (base_id, table_id, field_id) DO UPDATE
           SET name = EXCLUDED.name, type = EXCLUDED.type, options = EXCLUDED.options, synced_at = EXCLUDED.synced_at`,
        [baseId, tableId, payload],
      );
    }

    const deleted = await client.query(
      `UPDATE records SET deleted_at = now()
       WHERE base_id = $1 AND table_id = $2 AND deleted_at IS NULL AND synced_at < $3`,
      [baseId, tableId, runStartedAt],
    );

    const active = await client.query<{ count: string }>(
      'SELECT count(*) FROM records WHERE base_id = $1 AND table_id = $2 AND deleted_at IS NULL',
      [baseId, tableId],
    );
    await client.query('COMMIT');

    return {
      tableId,
      airtableRecords: records.length,
      airtableFields: fields.length,
      inserted,
      updated,
      markedDeleted: deleted.rowCount ?? 0,
      postgresActive: Number(active.rows[0].count),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
