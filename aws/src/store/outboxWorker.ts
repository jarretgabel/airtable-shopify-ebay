import type { Pool, PoolClient } from 'pg';
import { HttpError } from '../shared/errors.js';
import { logError } from '../shared/logging.js';
import type { ListingRecord, ListingSource, ListingStore } from './listingStore.js';

export const MAX_OUTBOX_ATTEMPTS = 8;
const MAX_BACKOFF_SECONDS = 3600;
// Airtable allows 5 requests/s per base; stay under it.
const MIN_SEND_GAP_MS = 250;

export interface OutboxWorkerOptions {
  pool: Pick<Pool, 'connect' | 'query'>;
  /** Sends one write to Airtable (the plain Airtable store, never the Postgres-first one). */
  airtable: Pick<ListingStore, 'createRecord' | 'updateRecord' | 'deleteRecord'>;
  /** Stop starting new rows after this many ms. */
  budgetMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface OutboxRunResult {
  sent: number;
  retried: number;
  dead: number;
}

interface OutboxRow {
  id: string;
  source: string;
  base_id: string;
  table_id: string;
  record_id: string;
  fields: Record<string, unknown>;
  typecast: boolean;
  attempts: number;
  op: 'create' | 'update' | 'delete';
}

export function backoffSeconds(attempts: number): number {
  return Math.min(10 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_SECONDS);
}

const LOCAL_ID_PATTERN = /^rec[A-Za-z0-9]{14}$/;

/** A write that must wait for another record's create to reach Airtable; it does not use up an attempt. */
class DeferredError extends Error {}

function isPermanent(error: unknown): boolean {
  // 4xx other than rate limiting will never succeed on retry; a person has to look at it.
  return error instanceof HttpError && !error.retryable && error.statusCode >= 400 && error.statusCode < 500;
}

// An ambiguous create failure (timeout, 5xx, network) may already have made the record in Airtable, and retrying would
// duplicate it, so only a clear rate-limit answer is retried. Everything else goes dead for a person to check.
function isCreateRetryable(error: unknown): boolean {
  return error instanceof HttpError && error.statusCode === 429;
}

/** Local ids of records created in Postgres are swapped for the ids Airtable issued, so links resolve there. */
async function translateLinks(client: PoolClient, fields: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ids = new Set<string>();
  for (const value of Object.values(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && LOCAL_ID_PATTERN.test(item)) ids.add(item);
      }
    }
  }
  if (ids.size === 0) return fields;

  const found = await client.query<{ record_id: string; airtable_record_id: string | null; unsent: boolean }>(
    `SELECT r.record_id, r.airtable_record_id,
            EXISTS (SELECT 1 FROM write_outbox o WHERE o.base_id = r.base_id AND o.table_id = r.table_id
                    AND o.record_id = r.record_id AND o.op = 'create' AND o.status <> 'sent') AS unsent
     FROM records r WHERE r.record_id = ANY($1)`,
    [Array.from(ids)],
  );
  const mapped = new Map<string, string>();
  for (const link of found.rows) {
    if (link.unsent) throw new DeferredError(`Waiting for linked record ${link.record_id} to be created in Airtable.`);
    if (link.airtable_record_id) mapped.set(link.record_id, link.airtable_record_id);
  }
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [
    name,
    Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? mapped.get(item) ?? item : item)) : value,
  ]));
}

/** Files stored in S3 exist only in Postgres, so Airtable's copy of an attachment field must not replace them. */
function keepStoredAttachments(current: Record<string, unknown> | undefined, fromAirtable: Record<string, unknown>): Record<string, unknown> {
  if (!current) return fromAirtable;
  const merged = { ...fromAirtable };
  for (const [name, value] of Object.entries(current)) {
    if (Array.isArray(value) && value.some((item) => typeof item === 'object' && item !== null && 's3Key' in item)) {
      merged[name] = value;
    }
  }
  return merged;
}

async function processNext(client: PoolClient, airtable: OutboxWorkerOptions['airtable']): Promise<'empty' | 'sent' | 'retried' | 'dead'> {
  await client.query('BEGIN');
  try {
    // Oldest due row per record: nothing earlier for the same record may still be pending (backing off) or dead.
    const next = await client.query<OutboxRow>(
      `SELECT o.id, o.source, o.base_id, o.table_id, o.record_id, o.fields, o.typecast, o.attempts, o.op
       FROM write_outbox o
       WHERE o.status = 'pending' AND o.next_attempt_at <= now()
         AND NOT EXISTS (
           SELECT 1 FROM write_outbox p
           WHERE p.base_id = o.base_id AND p.table_id = o.table_id AND p.record_id = o.record_id
             AND p.id < o.id AND p.status <> 'sent')
       ORDER BY o.id LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    const row = next.rows[0];
    if (!row) {
      await client.query('COMMIT');
      return 'empty';
    }

    const mapping = await client.query<{ airtable_record_id: string | null }>(
      'SELECT airtable_record_id FROM records WHERE base_id = $1 AND table_id = $2 AND record_id = $3',
      [row.base_id, row.table_id, row.record_id],
    );
    const airtableId = mapping.rows[0]?.airtable_record_id ?? row.record_id;

    let record: ListingRecord | null = null;
    try {
      if (row.op === 'delete') {
        try {
          await airtable.deleteRecord(row.source as never, airtableId);
        } catch (error) {
          // Already gone in Airtable is the outcome we wanted.
          if (!(error instanceof HttpError && error.statusCode === 404)) throw error;
        }
      } else {
        const fields = await translateLinks(client, row.fields);
        record = row.op === 'create'
          ? await airtable.createRecord(row.source as never, fields, { typecast: row.typecast })
          : await airtable.updateRecord(row.source as never, airtableId, fields, { typecast: row.typecast });
      }
    } catch (error) {
      if (error instanceof DeferredError) {
        await client.query(
          `UPDATE write_outbox SET last_error = $2, next_attempt_at = now() + interval '30 seconds' WHERE id = $1`,
          [row.id, error.message],
        );
        await client.query('COMMIT');
        return 'retried';
      }
      const attempts = row.attempts + 1;
      const retryable = row.op === 'create' ? isCreateRetryable(error) : !isPermanent(error);
      const dead = !retryable || attempts >= MAX_OUTBOX_ATTEMPTS;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await client.query(
        `UPDATE write_outbox SET attempts = $2, last_error = $3, status = $4,
           next_attempt_at = now() + ($5 || ' seconds')::interval WHERE id = $1`,
        [row.id, attempts, message, dead ? 'dead' : 'pending', String(backoffSeconds(attempts))],
      );
      await client.query('COMMIT');
      if (dead) logError('outbox_dead', error, { source: row.source, recordId: row.record_id, outboxId: row.id, op: row.op });
      return dead ? 'dead' : 'retried';
    }

    await client.query(`UPDATE write_outbox SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1`, [row.id]);
    // Take the record lock first: an in-flight user write holds it, so once we have it we can see that write's outbox row.
    const locked = await client.query<{ fields: Record<string, unknown> }>(
      'SELECT fields FROM records WHERE base_id = $1 AND table_id = $2 AND record_id = $3 FOR UPDATE',
      [row.base_id, row.table_id, row.record_id],
    );
    const newer = await client.query(
      `SELECT 1 FROM write_outbox WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND id > $4 AND status <> 'sent' LIMIT 1`,
      [row.base_id, row.table_id, row.record_id, row.id],
    );
    if (record && row.op === 'create') {
      await client.query(
        'UPDATE records SET airtable_record_id = $4 WHERE base_id = $1 AND table_id = $2 AND record_id = $3',
        [row.base_id, row.table_id, row.record_id, record.id],
      );
    }
    if (record && newer.rows.length === 0) {
      // Airtable's answer carries computed fields (formulas, rollups) the app never wrote.
      await client.query(
        `UPDATE records SET fields = $4::jsonb, synced_at = now()
         WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL`,
        [row.base_id, row.table_id, row.record_id, JSON.stringify(keepStoredAttachments(locked.rows[0]?.fields, record.fields))],
      );
    }
    await client.query('COMMIT');
    return 'sent';
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original error is the one that matters.
    }
    throw error;
  }
}

export async function runOutbox(options: OutboxWorkerOptions): Promise<OutboxRunResult> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + (options.budgetMs ?? 45_000);
  const result: OutboxRunResult = { sent: 0, retried: 0, dead: 0 };

  while (now() < deadline) {
    const client = await options.pool.connect();
    let outcome: Awaited<ReturnType<typeof processNext>>;
    try {
      outcome = await processNext(client, options.airtable);
    } finally {
      client.release();
    }
    if (outcome === 'empty') break;
    result[outcome] += 1;
    await sleep(MIN_SEND_GAP_MS);
  }
  return result;
}

export interface OutboxDepth {
  pending: number;
  dead: number;
  oldestPendingSeconds: number;
}

export async function getOutboxDepth(pool: Pick<Pool, 'query'>): Promise<OutboxDepth> {
  const result = await pool.query<{ pending: string; dead: string; oldest: string | null }>(
    `SELECT count(*) FILTER (WHERE status = 'pending') AS pending,
            count(*) FILTER (WHERE status = 'dead') AS dead,
            extract(epoch FROM now() - min(created_at) FILTER (WHERE status = 'pending')) AS oldest
     FROM write_outbox WHERE status <> 'sent'`,
  );
  const row = result.rows[0];
  return { pending: Number(row.pending), dead: Number(row.dead), oldestPendingSeconds: Math.round(Number(row.oldest ?? 0)) };
}

export type { ListingSource };
