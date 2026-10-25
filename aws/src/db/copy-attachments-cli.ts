import pg from 'pg';
import { getRecords } from '../providers/airtable/client.js';
import { createS3MediaStore } from '../providers/media/mediaStore.js';
import { copyAttachmentsForField } from './copyAttachments.js';

// Usage: copy-attachments-cli --base appXXXX --table tblXXXX --field Images [--apply] [--allow-production-read]
// Default is a dry run: reads Airtable (GET only), counts files and bytes, writes nothing.
// With --apply: needs DATABASE_URL, MEDIA_BUCKET and (optionally) MEDIA_PUBLIC_BASE_URL.
const PRODUCTION_BASE_ID = 'apprsAm2FOohEmL2u';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const baseId = arg('base');
const tableId = arg('table');
const fieldName = arg('field');
if (!baseId || !tableId || !fieldName) {
  console.error('--base, --table and --field are required.');
  process.exit(1);
}
if (baseId === PRODUCTION_BASE_ID && !flag('allow-production-read')) {
  console.error('Refusing to read the production base without --allow-production-read.');
  process.exit(1);
}
const apply = flag('apply');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
const bucket = process.env.MEDIA_BUCKET?.trim();
if (apply && !bucket) {
  console.error('MEDIA_BUCKET is required with --apply.');
  process.exit(1);
}

const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });
await client.connect();
try {
  const records = await getRecords(baseId, tableId, undefined, { fields: [fieldName] });
  const media = createS3MediaStore({ bucket: bucket ?? 'dry-run', publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL?.trim() ?? '' });
  const report = await copyAttachmentsForField({
    client, baseId, tableId, fieldName, records, media, apply,
    download: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    },
  });
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} ${tableId}.${fieldName}`, JSON.stringify({ ...report, megabytes: Math.round(report.bytes / 1048576) }));
} finally {
  await client.end();
}
