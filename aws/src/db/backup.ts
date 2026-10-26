import { gunzipSync, gzipSync } from 'node:zlib';
import type { Pool } from 'pg';

export interface BackupStore {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}

export interface BackupManifest {
  createdAt: string;
  tables: Record<string, number>;
}

type Queryable = Pick<Pool, 'query'>;

const SAFE_NAME = /^[a-z_][a-z0-9_]*$/;

function assertSafe(name: string): string {
  if (!SAFE_NAME.test(name)) throw new Error(`Refusing to back up table with unexpected name: ${name}`);
  return `"${name}"`;
}

async function listTables(pool: Queryable): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

/** One gzipped JSON-lines file per table plus manifest.json, written last so an incomplete backup has no manifest. */
export async function exportBackup(pool: Queryable, store: BackupStore, prefix: string, now = new Date()): Promise<BackupManifest> {
  const manifest: BackupManifest = { createdAt: now.toISOString(), tables: {} };
  for (const table of await listTables(pool)) {
    const result = await pool.query<{ row: unknown }>(`SELECT to_jsonb(t) AS row FROM ${assertSafe(table)} t`);
    const lines = result.rows.map((r) => JSON.stringify(r.row));
    await store.put(`${prefix}${table}.ndjson.gz`, gzipSync(Buffer.from(lines.join('\n'))));
    manifest.tables[table] = lines.length;
  }
  await store.put(`${prefix}manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)));
  return manifest;
}

const BATCH = 500;

/** Loads a backup into an already-migrated, empty database and checks the row counts against the manifest. */
export async function restoreBackup(pool: Queryable, store: BackupStore, prefix: string): Promise<BackupManifest> {
  const manifest = JSON.parse((await store.get(`${prefix}manifest.json`)).toString('utf8')) as BackupManifest;
  const present = new Set(await listTables(pool));

  for (const table of Object.keys(manifest.tables)) {
    if (!present.has(table)) throw new Error(`Target database has no table ${table}; run migrations first.`);
    const existing = await pool.query(`SELECT 1 FROM ${assertSafe(table)} LIMIT 1`);
    // schema_migrations is filled by the migrator itself, so it is the one table allowed to have rows.
    if (existing.rowCount && table !== 'schema_migrations') throw new Error(`Target table ${table} is not empty; restore into a fresh database.`);
  }

  for (const [table, expected] of Object.entries(manifest.tables)) {
    const quoted = assertSafe(table);
    const cols = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND is_generated = 'NEVER' ORDER BY ordinal_position`,
      [table],
    );
    const columns = cols.rows.map((c) => assertSafe(c.column_name)).join(', ');
    if (table === 'schema_migrations') await pool.query(`DELETE FROM ${quoted}`);
    const text = gunzipSync(await store.get(`${prefix}${table}.ndjson.gz`)).toString('utf8');
    const rows = text ? text.split('\n').map((line) => JSON.parse(line) as unknown) : [];
    for (let i = 0; i < rows.length; i += BATCH) {
      await pool.query(
        `INSERT INTO ${quoted} (${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::${quoted}, $1::jsonb)`,
        [JSON.stringify(rows.slice(i, i + BATCH))],
      );
    }
    const sequences = await pool.query<{ column_name: string; seq: string | null }>(
      `SELECT column_name, pg_get_serial_sequence($1, column_name) AS seq FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $2`,
      [quoted, table],
    );
    for (const s of sequences.rows) {
      if (s.seq) await pool.query(`SELECT setval($1, COALESCE((SELECT MAX(${assertSafe(s.column_name)}) FROM ${quoted}), 1))`, [s.seq]);
    }
    const counted = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM ${quoted}`);
    if (Number(counted.rows[0].n) !== expected) {
      throw new Error(`Restore check failed for ${table}: expected ${expected} rows, found ${counted.rows[0].n}.`);
    }
  }
  return manifest;
}
