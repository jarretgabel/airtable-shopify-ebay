import type { Pool } from 'pg';

export interface AuditEntry {
  id: string;
  at: string;
  op: 'create' | 'update' | 'delete';
  fields: Record<string, unknown>;
}

/** Newest first. */
export async function readAuditLog(
  pool: Pick<Pool, 'query'>,
  baseId: string,
  tableId: string,
  recordId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const capped = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
  const result = await pool.query<{ id: string; at: Date; op: AuditEntry['op']; fields: Record<string, unknown> }>(
    `SELECT id, at, op, fields FROM audit_log WHERE base_id = $1 AND table_id = $2 AND record_id = $3 ORDER BY at DESC, id DESC LIMIT $4`,
    [baseId, tableId, recordId, capped],
  );
  return result.rows.map((row) => ({ id: String(row.id), at: row.at.toISOString(), op: row.op, fields: row.fields }));
}
