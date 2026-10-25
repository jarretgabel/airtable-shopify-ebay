import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { planHtmlAttachmentRemoval, toAirtableImages } from './cleanHtmlAttachments.js';

const LISTINGS_TABLE = 'tbl0K0nFQL64jQMx8';

// Usage: clean-html-attachments-cli --base appXXXX [--table tblXXXX] [--apply --backup file.json]
// Removes `Images` attachments whose content type is text/html. The default dry run writes nothing.
// --apply saves a backup of every affected Images value first, then updates the mirror and queues an Airtable update
// (existing attachments are sent by id only). It does not touch S3; delete the objects after the outbox has drained.
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseId = arg('base');
const tableId = arg('table') ?? LISTINGS_TABLE;
const apply = process.argv.includes('--apply');
const backupPath = arg('backup');
const connectionString = process.env.DATABASE_URL;
if (!baseId || !connectionString || (apply && !backupPath)) {
  console.error('--base and DATABASE_URL are required, and --apply needs --backup <file>.');
  process.exit(1);
}

const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });

try {
  await client.connect();
  const result = await client.query(
    `SELECT record_id, fields -> 'Images' AS images FROM records
     WHERE base_id = $1 AND table_id = $2 AND deleted_at IS NULL AND fields ? 'Images'`,
    [baseId, tableId],
  );
  const affected: Array<{ recordId: string; images: unknown; keepCount: number; removeCount: number; s3Keys: string[] }> = [];
  let skipped = 0;
  for (const row of result.rows as Array<{ record_id: string; images: unknown }>) {
    const plan = planHtmlAttachmentRemoval(row.images);
    if (!plan) continue;
    if (!toAirtableImages(plan.keep)) {
      skipped += 1;
      continue;
    }
    affected.push({
      recordId: row.record_id,
      images: row.images,
      keepCount: plan.keep.length,
      removeCount: plan.remove.length,
      s3Keys: plan.remove.map((item) => item.s3Key).filter((key): key is string => typeof key === 'string'),
    });
  }
  const removeTotal = affected.reduce((sum, item) => sum + item.removeCount, 0);
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} base=${baseId}: ${affected.length} records, ${removeTotal} attachments to remove, ${affected.filter((a) => a.keepCount === 0).length} records left with no images, ${skipped} skipped (kept attachment without an id)`);

  if (apply) {
    writeFileSync(backupPath!, JSON.stringify(affected, null, 1), { flag: 'wx' });
    console.log(`backup written: ${backupPath}`);
    let done = 0;
    for (const item of affected) {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT fields -> 'Images' AS images FROM records WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL FOR UPDATE`,
        [baseId, tableId, item.recordId],
      );
      const plan = planHtmlAttachmentRemoval(locked.rows[0]?.images);
      const airtableImages = plan ? toAirtableImages(plan.keep) : null;
      if (!plan || !airtableImages) {
        await client.query('ROLLBACK');
        continue;
      }
      await client.query(
        `UPDATE records SET fields = jsonb_set(fields, '{Images}', $4::jsonb), synced_at = now()
         WHERE base_id = $1 AND table_id = $2 AND record_id = $3`,
        [baseId, tableId, item.recordId, JSON.stringify(plan.keep)],
      );
      await client.query(
        `INSERT INTO write_outbox (source, base_id, table_id, record_id, fields, typecast)
         VALUES ('used-gear-workflow', $1, $2, $3, $4::jsonb, false)`,
        [baseId, tableId, item.recordId, JSON.stringify({ Images: airtableImages })],
      );
      await client.query('COMMIT');
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${affected.length}`);
    }
    console.log(`updated ${done} records; outbox rows queued`);
  }
} finally {
  await client.end();
}
