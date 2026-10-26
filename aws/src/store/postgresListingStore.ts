import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { HttpError } from '../shared/errors.js';
import {
  resolveConfiguredSourceTable,
  resolveSubsetStatuses,
  getApprovedFieldCandidates,
} from '../providers/airtable/sources.js';
import { USED_GEAR_POST_PUBLISH_FIELDS } from '../shared/contracts/usedGearPostPublish.js';
import type {
  ListingFieldMetadata,
  ListingReadOptions,
  ListingRecordsPage,
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

export function newRecordId(): string {
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

  async function getRecordsPage(source: ListingSource, read: ListingReadOptions = {}): Promise<ListingRecordsPage> {
    const { rows, total } = await query(source, read, true);
    return { records: rows, total: total ?? rows.length };
  }

  async function getRecords(source: ListingSource, read: ListingReadOptions = {}): Promise<ListingRecord[]> {
    return (await query(source, read, false)).rows;
  }

  async function query(source: ListingSource, read: ListingReadOptions, withTotal: boolean): Promise<{ rows: ListingRecord[]; total?: number }> {
    const { baseId, tableId } = resolveTable(source);
    const params: unknown[] = [baseId, tableId];
    const where = ['base_id = $1', 'table_id = $2', 'deleted_at IS NULL'];

    const statuses = resolveSubsetStatuses(source, read.subset);
    if (statuses) {
      params.push(statuses);
      where.push(`workflow_status = ANY($${params.length}::text[])`);
    }

    if (read.filterByFormula?.trim()) {
      const { field, value, lower } = parseEqualityFormula(read.filterByFormula);
      params.push(field, value);
      const column = `(fields ->> $${params.length - 1})`;
      where.push(`${lower ? `lower(${column})` : column} = $${params.length}`);
    }

    for (const [field, expected] of Object.entries(read.filters ?? {})) {
      const values = Array.isArray(expected) ? expected : [expected];
      params.push(field, values);
      where.push(`(fields ->> $${params.length - 1}) = ANY($${params.length}::text[])`);
    }

    const searchText = read.searchQuery?.trim().toLowerCase() ?? '';
    const searchFields = (read.searchFields ?? []).map((name) => name.trim()).filter(Boolean);
    if (searchText && searchFields.length > 0) {
      // Every word must match at least one searched field, so "mcintosh mc275" finds a record that has them in different fields.
      const terms = searchText.split(/\s+/).filter(Boolean).slice(0, 8);
      const termClauses = terms.map((term) => {
        params.push(`%${escapeLike(term)}%`);
        const patternIndex = params.length;
        const clauses = searchFields.map((name) => {
          params.push(name);
          return `lower(coalesce(fields ->> $${params.length}, '')) LIKE $${patternIndex}`;
        });
        return `(${clauses.join(' OR ')})`;
      });
      where.push(`(${termClauses.join(' AND ')})`);
    }

    const whereParamCount = params.length;
    const limit = read.maxRecords ?? (read.subset === 'listings-page' ? LISTINGS_PAGE_MAX_RECORDS : undefined);
    // Projected in SQL so heavy fields (image metadata JSON) are never read or sent when a caller asks for specific fields.
    const projection = read.fields ?? (read.subset === 'post-publish' ? [...USED_GEAR_POST_PUBLISH_FIELDS] : undefined);
    let fieldsColumn = 'fields';
    if (projection && projection.length > 0) {
      params.push(projection);
      fieldsColumn = `(SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) FROM jsonb_each(fields) AS e WHERE e.key = ANY($${params.length}::text[])) AS fields`;
    }
    const whereSql = where.join(' AND ');
    let total: number | undefined;
    if (withTotal) {
      const counted = await pool.query<{ total: string }>(`SELECT count(*) AS total FROM records WHERE ${whereSql}`, params.slice(0, whereParamCount));
      total = Number(counted.rows[0]?.total ?? 0);
    }

    let orderBy = 'airtable_created_at NULLS LAST, record_id';
    if (read.sort?.field) {
      params.push(read.sort.field);
      orderBy = `fields -> $${params.length} ${read.sort.direction === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, airtable_created_at NULLS LAST, record_id`;
    }
    let sql = `SELECT record_id, ${fieldsColumn}, airtable_created_at, synced_at FROM records WHERE ${whereSql} ORDER BY ${orderBy}`;
    if (limit && Number.isFinite(limit) && limit > 0) {
      params.push(Math.trunc(limit));
      sql += ` LIMIT $${params.length}`;
    }
    if (read.offset && read.offset > 0) {
      params.push(Math.trunc(read.offset));
      sql += ` OFFSET $${params.length}`;
    }

    const result = await pool.query<RecordRow>(sql, params);
    return { rows: result.rows.map((row) => toListingRecord(row, projection)), total };
  }

  async function getRecord(source: ListingSource, recordId: string): Promise<ListingRecord> {
    const { baseId, tableId } = resolveTable(source);
    const result = await pool.query<RecordRow>(
      `SELECT record_id, fields, airtable_created_at, synced_at FROM records
       WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL`,
      [baseId, tableId, recordId],
    );
    if (result.rows[0]) return toListingRecord(result.rows[0]);
    // Archived (old Shipped) records stay readable by id, e.g. from a bookmarked link; they are not editable.
    const archived = await pool.query<RecordRow>(
      `SELECT record_id, fields, airtable_created_at, synced_at FROM records_archive
       WHERE base_id = $1 AND table_id = $2 AND record_id = $3`,
      [baseId, tableId, recordId],
    );
    if (!archived.rows[0]) throw notFound();
    return toListingRecord(archived.rows[0]);
  }

  return {
    getRecords,
    getRecordsPage,
    getRecord,

    async getRecordsSummary(source) {
      const { baseId, tableId } = resolveTable(source);
      // Same rule as isApprovedValue in sources.ts, evaluated in SQL so the table is never loaded.
      const candidates = getApprovedFieldCandidates(source);
      const keys = candidates.map((_, index) => `fields -> $${index + 3}`).join(', ');
      const result = await pool.query<{ total: string; approved: string }>(
        `WITH v AS (SELECT coalesce(${keys}) AS value FROM records WHERE base_id = $1 AND table_id = $2 AND deleted_at IS NULL)
         SELECT count(*) AS total,
           count(*) FILTER (WHERE value = 'true'::jsonb OR value = '1'::jsonb
             OR (jsonb_typeof(value) = 'string' AND lower(btrim(value #>> '{}')) IN ('true', '1', 'yes', 'approved'))) AS approved
         FROM v`,
        [baseId, tableId, ...candidates],
      );
      const total = Number(result.rows[0]?.total ?? 0);
      const approved = Number(result.rows[0]?.approved ?? 0);
      return { total, approved, pending: Math.max(0, total - approved) };
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
