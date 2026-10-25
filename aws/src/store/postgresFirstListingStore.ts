import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { HttpError } from '../shared/errors.js';
import { logError } from '../shared/logging.js';
import { newRecordId, type PostgresTable } from './postgresListingStore.js';
import type { MediaStore } from '../providers/media/mediaStore.js';
import type { ListingRecord, ListingSource, ListingStore } from './listingStore.js';

export interface PostgresFirstStoreOptions {
  pool: Pick<Pool, 'connect' | 'query'>;
  resolveTable: (source: ListingSource) => PostgresTable;
  /** Attachments use this path when no media store is configured. */
  airtableWriter: ListingStore;
  /** When set, uploaded files go to S3 and the attachment is recorded in Postgres only. */
  media?: MediaStore | null;
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

/** Creates, updates and deletes commit to Postgres and the outbox together and return at once; the outbox worker sends them to Airtable. */
export function createPostgresFirstListingStore(options: PostgresFirstStoreOptions): ListingStore {
  const { pool, resolveTable, airtableWriter, reader, media } = options;

  async function writableFields(
    source: ListingSource,
    recordId: string,
    baseId: string,
    tableId: string,
    fields: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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
    return writable;
  }

  async function inTransaction<T>(source: ListingSource, recordId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
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
  }

  return {
    getRecords: (source, opts) => reader.getRecords(source, opts),
    getRecordsSummary: (source) => reader.getRecordsSummary(source),
    getRecord: (source, id) => reader.getRecord(source, id),
    getFieldMetadata: (source) => reader.getFieldMetadata(source),

    async uploadAttachment(source, recordId, fieldId, payload): Promise<void> {
      if (!media) {
        await airtableWriter.uploadAttachment(source, recordId, fieldId, payload);
        return;
      }
      const { baseId, tableId } = resolveTable(source);
      const meta = await pool.query<{ name: string; type: string }>(
        'SELECT name, type FROM airtable_fields WHERE base_id = $1 AND table_id = $2 AND field_id = $3',
        [baseId, tableId, fieldId],
      );
      if (meta.rows[0]?.type !== 'multipleAttachments') {
        throw httpError(400, 'POSTGRES_ATTACHMENT_FIELD_NOT_ALLOWED', 'Unsupported attachment field.');
      }
      const fieldName = meta.rows[0].name;
      const body = Buffer.from(payload.file, 'base64');
      const attachmentId = `att${randomBytes(8).toString('hex')}`;
      const safeName = payload.filename.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').slice(0, 120) || 'file';
      const key = `${tableId}/${recordId}/${fieldId}/${attachmentId}-${safeName}`;

      // Store the file before touching the record, so a failed write leaves only an unreferenced object.
      await media.put(key, body, payload.contentType);
      await inTransaction(source, recordId, async (client) => {
        const current = await client.query<RecordRow>(
          `SELECT fields, airtable_created_at, synced_at FROM records
           WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL FOR UPDATE`,
          [baseId, tableId, recordId],
        );
        if (!current.rows[0]) throw httpError(404, 'POSTGRES_RECORD_NOT_FOUND', 'Record not found.');
        const existing = current.rows[0].fields[fieldName];
        const attachment = {
          id: attachmentId,
          url: media.publicUrl(key),
          filename: payload.filename,
          type: payload.contentType,
          size: body.length,
          s3Key: key,
        };
        const next = { ...current.rows[0].fields, [fieldName]: [...(Array.isArray(existing) ? existing : []), attachment] };
        await client.query(
          `UPDATE records SET fields = $4::jsonb, synced_at = now()
           WHERE base_id = $1 AND table_id = $2 AND record_id = $3`,
          [baseId, tableId, recordId, JSON.stringify(next)],
        );
      });
    },

    async createRecord(source, fields, writeOptions): Promise<ListingRecord> {
      const { baseId, tableId } = resolveTable(source);
      const recordId = newRecordId();
      const writable = await writableFields(source, recordId, baseId, tableId, fields);

      return inTransaction(source, recordId, async (client) => {
        const created = await client.query<RecordRow>(
          `INSERT INTO records (base_id, table_id, record_id, fields, airtable_created_at, synced_at)
           VALUES ($1, $2, $3, $4::jsonb, now(), now())
           RETURNING fields, airtable_created_at, synced_at`,
          [baseId, tableId, recordId, JSON.stringify(applyFieldPatch({}, writable))],
        );
        await client.query(
          `INSERT INTO write_outbox (source, base_id, table_id, record_id, fields, typecast, op)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'create')`,
          [source, baseId, tableId, recordId, JSON.stringify(writable), Boolean(writeOptions?.typecast)],
        );
        const row = created.rows[0];
        return { id: recordId, fields: row.fields, createdTime: (row.airtable_created_at ?? row.synced_at).toISOString() };
      });
    },

    async deleteRecord(source, recordId): Promise<void> {
      const { baseId, tableId } = resolveTable(source);
      await inTransaction(source, recordId, async (client) => {
        const deleted = await client.query(
          `UPDATE records SET deleted_at = now()
           WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL`,
          [baseId, tableId, recordId],
        );
        if (!deleted.rowCount) throw httpError(404, 'POSTGRES_RECORD_NOT_FOUND', 'Record not found.');
        await client.query(
          `INSERT INTO write_outbox (source, base_id, table_id, record_id, fields, typecast, op)
           VALUES ($1, $2, $3, $4, '{}'::jsonb, false, 'delete')`,
          [source, baseId, tableId, recordId],
        );
      });
    },

    async updateRecord(source, recordId, fields, writeOptions): Promise<ListingRecord> {
      const { baseId, tableId } = resolveTable(source);

      const writable = await writableFields(source, recordId, baseId, tableId, fields);

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
