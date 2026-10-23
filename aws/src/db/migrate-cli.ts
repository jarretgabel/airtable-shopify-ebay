import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applyMigrations, loadMigrations } from './migrator.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');
const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });

try {
  await client.connect();
  const result = await applyMigrations(client, await loadMigrations(migrationsDir));
  console.log(`applied: ${result.applied.join(', ') || 'none'}; already applied: ${result.skipped.join(', ') || 'none'}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
