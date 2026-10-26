import pg from 'pg';
import { archiveRecords, restoreArchivedRecords } from './recordArchive.js';
import { syncWorkflowImages } from './workflowImages.js';

// Usage: archive-records-cli --base appX --table tblX [--days 365] [--status Shipped] [--limit n] [--apply]
//        archive-records-cli --base appX --table tblX --restore [--record recA,recB] [--apply]
// Dry run unless --apply. Archiving moves rows to records_archive; --restore moves them back.
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const baseId = arg('base');
const tableId = arg('table');
const connectionString = process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
if (!baseId || !tableId || !connectionString) {
  console.error('--base, --table and DATABASE_URL are required.');
  process.exit(1);
}
const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });
await client.connect();
try {
  if (process.argv.includes('--restore')) {
    const recordIds = arg('record')?.split(',').map((id) => id.trim()).filter(Boolean);
    if (!apply) {
      const count = await client.query('SELECT count(*) FROM records_archive WHERE base_id = $1 AND table_id = $2 AND ($3::text[] IS NULL OR record_id = ANY($3))', [baseId, tableId, recordIds ?? null]);
      console.log('DRY RUN restore', JSON.stringify({ archived: Number(count.rows[0].count) }));
    } else {
      console.log('APPLY restore', JSON.stringify({ restored: await restoreArchivedRecords(client, { baseId, tableId, recordIds }, syncWorkflowImages as never) }));
    }
  } else {
    const report = await archiveRecords(client, {
      baseId, tableId, apply,
      days: Number(arg('days') ?? 365),
      status: arg('status'),
      limit: arg('limit') ? Number(arg('limit')) : undefined,
    });
    console.log(apply ? 'APPLY' : 'DRY RUN', JSON.stringify(report));
  }
} finally {
  await client.end();
}
