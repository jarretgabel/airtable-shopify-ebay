import pg from 'pg';
import { restoreBackup } from './backup.js';
import { createS3BackupStore } from './backupS3.js';

// Usage: backup-restore-cli --bucket B --prefix postgres/2026-10-26/
// Restores into the database in DATABASE_URL, which must be freshly migrated and empty. Never point it at a live database.
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const bucket = arg('bucket');
const prefix = arg('prefix');
const url = process.env.DATABASE_URL;
if (!bucket || !prefix || !url) {
  console.error('--bucket, --prefix and DATABASE_URL are required.');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false }, max: 1 });
try {
  const manifest = await restoreBackup(pool, await createS3BackupStore(bucket), prefix);
  console.log(JSON.stringify({ restored: manifest.tables, createdAt: manifest.createdAt }, null, 2));
} finally {
  await pool.end();
}
