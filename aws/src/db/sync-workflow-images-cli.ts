import pg from 'pg';
import { findWorkflowImageMetadataPatch, parseWorkflowImageRows, syncWorkflowImages } from './workflowImages.js';

const LISTINGS_TABLE = 'tbl0K0nFQL64jQMx8';

// Usage: sync-workflow-images-cli --base appXXXX [--table tblXXXX] [--apply]
// Reads only the records mirror. The default dry run writes nothing; --apply fills workflow_images (idempotent).
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseId = arg('base');
const tableId = arg('table') ?? LISTINGS_TABLE;
const apply = process.argv.includes('--apply');
const connectionString = process.env.DATABASE_URL;
if (!baseId || !connectionString) {
  console.error('--base and DATABASE_URL are required.');
  process.exit(1);
}

const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });

try {
  await client.connect();
  const result = await client.query(
    'SELECT record_id, fields FROM records WHERE base_id = $1 AND table_id = $2 AND deleted_at IS NULL',
    [baseId, tableId],
  );
  let records = 0;
  let images = 0;
  const startedAt = Date.now();
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} base=${baseId}: scanning ${result.rows.length} mirror records`);
  for (const row of result.rows as Array<{ record_id: string; fields: Record<string, unknown> }>) {
    const metadata = findWorkflowImageMetadataPatch(row.fields);
    if (!metadata) continue;
    const count = parseWorkflowImageRows(metadata.value).length;
    if (count === 0) continue;
    records += 1;
    images += count;
    if (apply) {
      await client.query('BEGIN');
      await syncWorkflowImages(client, baseId, row.record_id, metadata.value);
      await client.query('COMMIT');
    }
    if (records % 50 === 0) {
      console.log(`  ${records} records, ${images} images (${Math.round((Date.now() - startedAt) / 1000)}s)`);
    }
  }
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} base=${baseId} records with images=${records} images=${images}`);
  if (apply) {
    console.log('workflow_images rows:', (await client.query('SELECT count(*)::int AS n FROM workflow_images WHERE base_id = $1', [baseId])).rows[0].n);
  }
} finally {
  await client.end();
}
