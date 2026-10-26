import pg from 'pg';
import { exportBackup } from '../../db/backup.js';
import { createS3BackupStore } from '../../db/backupS3.js';

/** Scheduled daily: full logical export of every public table to the private backup bucket. */
export async function handler(): Promise<{ prefix: string; tables: Record<string, number> }> {
  const connectionString = process.env.DATABASE_URL?.trim();
  const bucket = process.env.BACKUP_BUCKET?.trim();
  if (!connectionString || !bucket) throw new Error('DATABASE_URL and BACKUP_BUCKET are required.');

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1, query_timeout: 120_000 });
  try {
    const now = new Date();
    const prefix = `postgres/${now.toISOString().slice(0, 10)}/`;
    const manifest = await exportBackup(pool, await createS3BackupStore(bucket), prefix, now);
    console.info(JSON.stringify({
      _aws: { Timestamp: Date.now(), CloudWatchMetrics: [{ Namespace: 'AirtableShopifyEbay/Backup', Dimensions: [[]], Metrics: [{ Name: 'BackupRows', Unit: 'Count' }] }] },
      BackupRows: Object.values(manifest.tables).reduce((a, b) => a + b, 0),
      prefix,
    }));
    return { prefix, tables: manifest.tables };
  } finally {
    await pool.end();
  }
}
