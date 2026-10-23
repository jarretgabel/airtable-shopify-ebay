import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface Migration {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const ADVISORY_LOCK_KEY = 7_340_001;

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

export async function loadMigrations(dir: string): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const migrations: Migration[] = [];

  for (const file of files) {
    const match = FILE_PATTERN.exec(file);
    if (!match) {
      throw new Error(`Invalid migration file name: ${file} (expected 0001_name.sql)`);
    }
    if (migrations.some((entry) => entry.version === match[1])) {
      throw new Error(`Duplicate migration version: ${match[1]}`);
    }
    const sql = await readFile(path.join(dir, file), 'utf8');
    migrations.push({ version: match[1], name: match[2], sql, checksum: checksumOf(sql) });
  }

  return migrations;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function applyMigrations(client: MigrationClient, migrations: Migration[]): Promise<MigrationResult> {
  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      name       text NOT NULL,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const existing = await client.query('SELECT version, checksum FROM schema_migrations');
    const recorded = new Map(existing.rows.map((row) => [String(row.version), String(row.checksum)]));
    const result: MigrationResult = { applied: [], skipped: [] };

    for (const migration of migrations) {
      const recordedChecksum = recorded.get(migration.version);
      if (recordedChecksum !== undefined) {
        if (recordedChecksum !== migration.checksum) {
          throw new Error(`Migration ${migration.version}_${migration.name} was changed after it was applied.`);
        }
        result.skipped.push(migration.version);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, migration.checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      result.applied.push(migration.version);
    }

    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  }
}
