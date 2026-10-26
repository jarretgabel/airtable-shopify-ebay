import type { Queryable } from './sellersSummary.js';

export interface ArchiveOptions {
  baseId: string;
  tableId: string;
  /** Only records untouched (no edit, no audit entry) for this many days. */
  days: number;
  status?: string;
  apply: boolean;
  limit?: number;
}

export interface ArchiveReport {
  eligible: number;
  moved: number;
}

type Tx = Queryable;

/**
 * Moves old Shipped records to records_archive in one transaction per record. Records with unsent outbox rows are
 * skipped. The record's workflow_images rows are dropped (they are derived from the metadata JSON, which moves with it).
 * `db` must be a single client, because each move is a transaction.
 */
export async function archiveRecords(db: Tx, options: ArchiveOptions): Promise<ArchiveReport> {
  const { baseId, tableId, days, apply } = options;
  const status = options.status ?? 'Shipped';
  const eligible = await db.query(
    `SELECT r.record_id FROM records r
     WHERE r.base_id = $1 AND r.table_id = $2 AND r.deleted_at IS NULL AND r.workflow_status = $3
       AND r.synced_at < now() - make_interval(days => $4)
       AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.base_id = $1 AND a.table_id = $2 AND a.record_id = r.record_id
                       AND a.at >= now() - make_interval(days => $4))
       AND NOT EXISTS (SELECT 1 FROM write_outbox o WHERE o.base_id = $1 AND o.table_id = $2 AND o.record_id = r.record_id AND o.status <> 'sent')
     ORDER BY r.record_id LIMIT $5`,
    [baseId, tableId, status, days, options.limit ?? 100000],
  );
  const report: ArchiveReport = { eligible: eligible.rows.length, moved: 0 };
  if (!apply) return report;

  for (const row of eligible.rows) {
    const recordId = String(row.record_id);
    await db.query('BEGIN');
    try {
      await db.query('DELETE FROM workflow_images WHERE base_id = $1 AND record_id = $2', [baseId, recordId]);
      const moved = await db.query(
        `WITH gone AS (DELETE FROM records WHERE base_id = $1 AND table_id = $2 AND record_id = $3 RETURNING *)
         INSERT INTO records_archive (base_id, table_id, record_id, fields, airtable_created_at, synced_at, airtable_record_id, sku)
         SELECT base_id, table_id, record_id, fields, airtable_created_at, synced_at, airtable_record_id, sku FROM gone
         RETURNING record_id`,
        [baseId, tableId, recordId],
      );
      await db.query('COMMIT');
      report.moved += moved.rows.length;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
  return report;
}

/** Puts archived records back (all of them, or the given ids) and rebuilds their workflow_images rows. */
export async function restoreArchivedRecords(
  db: Tx,
  options: { baseId: string; tableId: string; recordIds?: string[] },
  syncImages: (db: Tx, baseId: string, recordId: string, metadata: unknown) => Promise<unknown>,
): Promise<number> {
  const { baseId, tableId } = options;
  const ids = await db.query(
    `SELECT record_id FROM records_archive WHERE base_id = $1 AND table_id = $2 AND ($3::text[] IS NULL OR record_id = ANY($3)) ORDER BY record_id`,
    [baseId, tableId, options.recordIds ?? null],
  );
  let restored = 0;
  for (const row of ids.rows) {
    const recordId = String(row.record_id);
    await db.query('BEGIN');
    try {
      const back = await db.query(
        `WITH gone AS (DELETE FROM records_archive WHERE base_id = $1 AND table_id = $2 AND record_id = $3 RETURNING *)
         INSERT INTO records (base_id, table_id, record_id, fields, airtable_created_at, synced_at, airtable_record_id)
         SELECT base_id, table_id, record_id, fields, airtable_created_at, now(), airtable_record_id FROM gone
         RETURNING fields`,
        [baseId, tableId, recordId],
      );
      const metadata = (back.rows[0]?.fields as Record<string, unknown> | undefined)?.['Workflow Image Metadata JSON'];
      if (metadata) await syncImages(db, baseId, recordId, metadata);
      await db.query('COMMIT');
      restored += back.rows.length;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
  return restored;
}
