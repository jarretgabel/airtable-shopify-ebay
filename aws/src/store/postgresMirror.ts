import type { Pool } from 'pg';
import type { ListingRecord, ListingSource } from './listingStore.js';
import type { PostgresTable } from './postgresListingStore.js';

export interface PostgresMirror {
  upsertRecord(source: ListingSource, record: ListingRecord): Promise<void>;
  markDeleted(source: ListingSource, recordId: string): Promise<void>;
}

/** Writes the exact record Airtable returned, so the mirror keeps Airtable's ids and field values. */
export function createPostgresMirror(
  getPool: () => Pick<Pool, 'query'>,
  resolveTable: (source: ListingSource) => PostgresTable,
): PostgresMirror {
  return {
    async upsertRecord(source, record) {
      const { baseId, tableId } = resolveTable(source);
      await getPool().query(
        `INSERT INTO records (base_id, table_id, record_id, fields, airtable_created_at, synced_at, deleted_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, now(), NULL)
         ON CONFLICT (base_id, table_id, record_id) DO UPDATE
           SET fields = EXCLUDED.fields,
               airtable_created_at = COALESCE(EXCLUDED.airtable_created_at, records.airtable_created_at),
               synced_at = EXCLUDED.synced_at,
               deleted_at = NULL`,
        [baseId, tableId, record.id, JSON.stringify(record.fields), record.createdTime ?? null],
      );
    },

    async markDeleted(source, recordId) {
      const { baseId, tableId } = resolveTable(source);
      await getPool().query(
        `UPDATE records SET deleted_at = now()
         WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL`,
        [baseId, tableId, recordId],
      );
    },
  };
}
