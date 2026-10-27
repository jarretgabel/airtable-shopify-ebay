import pg from 'pg';
import { getRecords } from '../providers/airtable/client.js';
import { backfillTable, type BackfillField } from './backfill.js';

const PRODUCTION_BASE_ID = 'apprsAm2FOohEmL2u';
const DEFAULT_TABLES = [
  'tbl0K0nFQL64jQMx8', // Listings
  'tblF0B5TUhy20hJCv', // Vendors
  'tblquB9pdwSRXsI7c', // User Guide
  'tblkoqoSKypAaZRZe', // Image Roles
  'tblj2Gt9USORo6Vi5', // Users
  'tblqh6yC0p74UrHZo', // Shopify Listing
  'tbl3yTb0JkzUMFNnS', // Ebay Listing
];

// Usage: backfill-cli --base appXXXX [--tables tblA,tblB] [--apply] [--allow-production-read] [--skip-records recA,recB]
// Default is a dry run: reads Airtable (GET only) and reports counts, writes nothing to Postgres.
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const baseId = arg('base');
if (!baseId) {
  console.error('--base is required.');
  process.exit(1);
}
if (baseId === PRODUCTION_BASE_ID && !flag('allow-production-read')) {
  console.error('Refusing to read the production base without --allow-production-read.');
  process.exit(1);
}
const apiKey = process.env.AIRTABLE_API_KEY?.trim();
if (!apiKey) {
  console.error('AIRTABLE_API_KEY is required.');
  process.exit(1);
}
const apply = flag('apply');
const skipRecords = new Set(arg('skip-records')?.split(',').map((r) => r.trim()).filter(Boolean) ?? []);
const tables = arg('tables')?.split(',').map((t) => t.trim()).filter(Boolean) ?? DEFAULT_TABLES;

async function fetchSchema(): Promise<Map<string, BackfillField[]>> {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Airtable metadata error: HTTP ${response.status}`);
  const body = await response.json() as { tables?: Array<{ id: string; fields?: BackfillField[] }> };
  return new Map((body.tables ?? []).map((t) => [t.id, t.fields ?? []]));
}

const schema = await fetchSchema();
let client: pg.Client | undefined;
if (apply) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required with --apply.');
    process.exit(1);
  }
  const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
  client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });
  await client.connect();
}

console.log(`${apply ? 'APPLY' : 'DRY RUN'} base=${baseId}`);
let failed = false;
try {
  for (const tableId of tables) {
    const fields = schema.get(tableId);
    if (!fields) {
      console.log(`${tableId}: not found in base schema, skipped`);
      failed = true;
      continue;
    }
    const allRecords = await getRecords(baseId, tableId);
    const records = allRecords.filter((r) => !skipRecords.has(r.id));
    if (records.length !== allRecords.length) console.log(`${tableId}: skipped ${allRecords.length - records.length} record(s) by --skip-records`);
    if (!client) {
      console.log(`${tableId}: ${records.length} records, ${fields.length} fields`);
      continue;
    }
    const report = await backfillTable(client, baseId, tableId, records, fields);
    const match = report.postgresActive === report.airtableRecords ? 'OK' : 'MISMATCH';
    if (match === 'MISMATCH') failed = true;
    console.log(
      `${tableId}: airtable=${report.airtableRecords} postgres=${report.postgresActive} inserted=${report.inserted} updated=${report.updated} deleted=${report.markedDeleted} fields=${report.airtableFields} ${match}`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  failed = true;
} finally {
  await client?.end();
}
process.exitCode = failed ? 1 : 0;
