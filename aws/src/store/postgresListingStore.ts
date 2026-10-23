import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { HttpError } from '../shared/errors.js';
import {
  resolveConfiguredSourceTable,
  resolveSubsetStatuses,
  summarizeConfiguredRecords,
} from '../providers/airtable/sources.js';
import { USED_GEAR_POST_PUBLISH_FIELDS } from '../shared/contracts/usedGearPostPublish.js';
import type {
  ListingFieldMetadata,
  ListingReadOptions,
  ListingRecord,
  ListingSource,
  ListingStore,
} from './listingStore.js';

const LISTINGS_PAGE_MAX_RECORDS = 200;

export interface PostgresTable {
  baseId: string;
  tableId: string;
}

export interface PostgresListingStoreOptions {
  pool: Pick<Pool, 'query'>;
  /** Maps a source to its physical table. Defaults to the Airtable source configuration. */
  resolveTable?: (source: ListingSource) => PostgresTable;
}

interface RecordRow {
  record_id: string;
  fields: Record<string, unknown>;
  airtable_created_at: Date | null;
  synced_at: Date;
}

function pgError(status: number, code: string, message: string): HttpError {
  return new HttpError(status, message, { service: 'postgres', code, retryable: false });
}

function notFound(): HttpError {
  return pgError(404, 'POSTGRES_RECORD_NOT_FOUND', 'Record not found');
}

function newRecordId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(14);
  return `rec${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`;
}

function toListingRecord(row: RecordRow, fields?: string[]): ListingRecord {
  const source = row.fields ?? {};
  const projected = fields && fields.length > 0
    ? Object.fromEntries(Object.entries(source).filter(([key]) => fields.includes(key)))
    : source;
  return {
    id: row.record_id,
    fields: projected,
    createdTime: (row.airtable_created_at ?? row.synced_at).toISOString(),
  };
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

// Only the equality shapes the app sends today (auth lookups); anything else must not silently match everything.
function parseEqualityFormula(formula: string): { field: string; value: string; lower: boolean } {
  const match = /^\s*(LOWER\(\s*)?\{([^}]+)\}\s*(?:\)\s*)?=\s*("(?:[^"\\]|\\.)*")\s*$/.exec(formula);
  if (!match) {
    throw pgError(400, 'POSTGRES_FORMULA_UNSUPPORTED', 'filterByFormula is not supported by the Postgres backend.');
  }
  return { field: match[2], value: JSON.parse(match[3]) as string, lower: Boolean(match[1]) };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function createPostgresListingStore(options: PostgresListingStoreOptions): ListingStore {
  const { pool } = options;
  const resolveTable = options.resolveTable ?? ((source: ListingSource) => resolveConfiguredSourceTable(source));

  async function getRecords(source: ListingSource, read: ListingReadOptions = {}): Promise<ListingRecord[]> {
    const { baseId, tableId } = resolveTable(source);
    const params: unknown[] = [baseId, tableId];
    const where = ['base_id = $1', 'table_id = $2', 'deleted_at IS NULL'];

    const statuses = resolveSubsetStatuses(source, read.subset);
    if (statuses) {
      params.push(statuses);
      where.push(`fields ->> 'Workflow Status' = ANY($${params.length}::text[])`);
    }

    if (read.filterByFormula?.trim()) {
      const { field, value, lower } = parseEqualityFormula(read.filterByFormula);
      params.push(field, value);
      const column = `(fields ->> $${params.length - 1})`;
      where.push(`${lower ? `lower(${column})` : column} = $${params.length}`);
    }

    const query = read.searchQuery?.trim().toLowerCase() ?? '';
    const searchFields = (read.searchFields ?? []).map((name) => name.trim()).filter(Boolean);
    if (query && searchFields.length > 0) {
      params.push(`%${escapeLike(query)}%`);
      const patternIndex = params.length;
      const clauses = searchFields.map((name) => {
        params.push(name);
        return `lower(coalesce(fields ->> $${params.length}, '')) LIKE $${patternIndex}`;
      });
      where.push(`(${clauses.join(' OR ')})`);
    }

    const limit = read.maxRecords ?? (read.subset === 'listings-page' ? LISTINGS_PAGE_MAX_RECORDS : undefined);
    let sql = `SELECT record_id, fields, airtable_created_at, synced_at FROM records WHERE ${where.join(' AND ')}
      ORDER BY airtable_created_at NULLS LAST, record_id`;
    if (limit && Number.isFinite(limit) && limit > 0) {
      params.push(Math.trunc(limit));
      sql += ` LIMIT $${params.length}`;
    }

    const projection = read.fields ?? (read.subset === 'post-publish' ? [...USED_GEAR_POST_PUBLISH_FIELDS] : undefined);
    const result = await pool.query<RecordRow>(sql, params);
    return result.rows.map((row) => toListingRecord(row, projection));
  }

  async function getRecord(source: ListingSource, recordId: string): Promise<ListingRecord> {
    const { baseId, tableId } = resolveTable(source);
    const result = await pool.query<RecordRow>(
      `SELECT record_id, fields, airtable_created_at, synced_at FROM records
       WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL`,
      [baseId, tableId, recordId],
    );
    if (!result.rows[0]) throw notFound();
    return toListingRecord(result.rows[0]);
  }

  return {
    getRecords,
    getRecord,

    async getRecordsSummary(source) {
      return summarizeConfiguredRecords(source, await getRecords(source));
    },

    async createRecord(source, fields) {
      const { baseId, tableId } = resolveTable(source);
      const stored = applyFieldPatch({}, fields);
      const result = await pool.query<RecordRow>(
        `INSERT INTO records (base_id, table_id, record_id, fields, airtable_created_at, synced_at)
         VALUES ($1, $2, $3, $4::jsonb, now(), now())
         RETURNING record_id, fields, airtable_created_at, synced_at`,
        [baseId, tableId, newRecordId(), JSON.stringify(stored)],
      );
      return toListingRecord(result.rows[0]);
    },

    async updateRecord(source, recordId, fields) {
      const { baseId, tableId } = resolveTable(source);
      const current = await getRecord(source, recordId);
      const merged = applyFieldPatch(current.fields, fields);
      const result = await pool.query<RecordRow>(
        `UPDATE records SET fields = $4::jsonb, synced_at = now()
         WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL
         RETURNING record_id, fields, airtable_created_at, synced_at`,
        [baseId, tableId, recordId, JSON.stringify(merged)],
      );
      if (!result.rows[0]) throw notFound();
      return toListingRecord(result.rows[0]);
    },

    async deleteRecord(source, recordId) {
      const { baseId, tableId } = resolveTable(source);
      const result = await pool.query(
        `UPDATE records SET deleted_at = now()
         WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL`,
        [baseId, tableId, recordId],
      );
      if (!result.rowCount) throw notFound();
    },

    async getFieldMetadata(source): Promise<ListingFieldMetadata[]> {
      const { baseId, tableId } = resolveTable(source);
      const result = await pool.query<{ field_id: string; name: string; type: string; options: Record<string, unknown> }>(
        'SELECT field_id, name, type, options FROM airtable_fields WHERE base_id = $1 AND table_id = $2 ORDER BY name',
        [baseId, tableId],
      );
      return result.rows.map((row) => ({
        id: row.field_id,
        name: row.name,
        type: row.type,
        options: row.options && Object.keys(row.options).length > 0 ? row.options : undefined,
      }));
    },

    async uploadAttachment() {
      throw pgError(501, 'POSTGRES_ATTACHMENTS_NOT_IMPLEMENTED', 'Attachment upload is not implemented for the Postgres backend.');
    },
  };
}
