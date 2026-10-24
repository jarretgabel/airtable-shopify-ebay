import type { Pool } from 'pg';
import { HttpError } from '../shared/errors.js';
import { logError } from '../shared/logging.js';
import type { PostgresTable } from './postgresListingStore.js';
import type { ListingRecord, ListingSource, ListingStore } from './listingStore.js';

export interface PostgresFirstStoreOptions {
  pool: Pick<Pool, 'connect' | 'query'>;
  resolveTable: (source: ListingSource) => PostgresTable;
  /** Creates, deletes and attachments keep the Airtable-first path (Airtable issues the record id). */
  airtableWriter: ListingStore;
  /** Reads, field metadata and anything not handled here. */
  reader: ListingStore;
}

interface RecordRow {
  fields: Record<string, unknown>;
  airtable_created_at: Date | null;
  synced_at: Date;
}

function httpError(status: number, code: string, message: string): HttpError {
  return new HttpError(status, message, { service: 'postgres', code, retryable: false });
}

// Airtable clears a field when it is written as null; the mirror drops the key to match.
function applyFieldPatch(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}

/** Updates commit to Postgres and the outbox together and return at once; the outbox worker sends them to Airtable. */
export function createPostgresFirstListingStore(options: PostgresFirstStoreOptions): ListingStore {
  const { pool, resolveTable, airtableWriter, reader } = options;

  return {
    getRecords: (source, opts) => reader.getRecords(source, opts),
    getRecordsSummary: (source) => reader.getRecordsSummary(source),
    getRecord: (source, id) => reader.getRecord(source, id),
    getFieldMetadata: (source) => reader.getFieldMetadata(source),
    createRecord: (source, fields, opts) => airtableWriter.createRecord(source, fields, opts),
    deleteRecord: (source, id) => airtableWriter.deleteRecord(source, id),
    uploadAttachment: (source, id, fieldId, payload) => airtableWriter.uploadAttachment(source, id, fieldId, payload),

    async updateRecord(source, recordId, fields, writeOptions): Promise<ListingRecord> {
      const { baseId, tableId } = resolveTable(source);

      // Airtable silently drops unknown fields in this app (see the unknown-field fallback), so do the same,
      // but fail closed when there is no field metadata to check against.
      const known = await pool.query<{ name: string }>(
        'SELECT name FROM airtable_fields WHERE base_id = $1 AND table_id = $2',
        [baseId, tableId],
      );
      if (known.rows.length === 0) {
        throw new HttpError(503, 'Field metadata for this table is not loaded in Postgres.', {
          service: 'postgres', code: 'POSTGRES_FIELD_METADATA_MISSING', retryable: true,
        });
      }
      const names = new Set(known.rows.map((row) => row.name));
      const writable = Object.fromEntries(Object.entries(fields).filter(([name]) => names.has(name)));
      const dropped = Object.keys(fields).filter((name) => !names.has(name));
      if (dropped.length > 0) {
        console.warn(JSON.stringify({ event: 'postgres_first_unknown_fields', source, recordId, dropped }));
      }
      if (Object.keys(writable).length === 0) {
        throw httpError(422, 'POSTGRES_NO_KNOWN_FIELDS', 'None of the submitted fields exist on this table.');
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await client.query<RecordRow>(
          `SELECT fields, airtable_created_at, synced_at FROM records
           WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL FOR UPDATE`,
          [baseId, tableId, recordId],
        );
        if (!current.rows[0]) {
          throw httpError(404, 'POSTGRES_RECORD_NOT_FOUND', 'Record not found.');
        }
        const merged = applyFieldPatch(current.rows[0].fields, writable);
        const updated = await client.query<RecordRow>(
          `UPDATE records SET fields = $4::jsonb, synced_at = now()
           WHERE base_id = $1 AND table_id = $2 AND record_id = $3
           RETURNING fields, airtable_created_at, synced_at`,
          [baseId, tableId, recordId, JSON.stringify(merged)],
        );
        await client.query(
          `INSERT INTO write_outbox (source, base_id, table_id, record_id, fields, typecast)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
          [source, baseId, tableId, recordId, JSON.stringify(writable), Boolean(writeOptions?.typecast)],
        );
        await client.query('COMMIT');
        const row = updated.rows[0];
        return { id: recordId, fields: row.fields, createdTime: (row.airtable_created_at ?? row.synced_at).toISOString() };
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logError('postgres_first_rollback_failed', rollbackError, { source, recordId });
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
