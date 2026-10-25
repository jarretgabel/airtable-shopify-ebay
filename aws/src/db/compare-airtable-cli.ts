import pg from 'pg';
import { compareWithAirtable, type AirtableRecord } from './compareAirtable.js';

// Usage: compare-airtable-cli --base appXXXX [--table tblXXXX]
// Read-only: pages through Airtable with GET requests and reads the Postgres mirror. Writes nothing anywhere.
// Needs DATABASE_URL and AIRTABLE_API_KEY.
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseId = arg('base');
const onlyTable = arg('table');
const connectionString = process.env.DATABASE_URL;
const apiKey = process.env.AIRTABLE_API_KEY;
if (!baseId || !connectionString || !apiKey) {
  console.error('--base, DATABASE_URL and AIRTABLE_API_KEY are required.');
  process.exit(1);
}

async function readAirtable(tableId: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset = '';
  do {
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?pageSize=100${offset ? `&offset=${encodeURIComponent(offset)}` : ''}`;
    let response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    for (let attempt = 0; response.status === 429 && attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    }
    if (!response.ok) throw new Error(`Airtable ${tableId} returned ${response.status}`);
    const page = (await response.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...page.records);
    offset = page.offset ?? '';
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (offset);
  return records;
}

const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });

try {
  await client.connect();
  const tables = onlyTable
    ? [onlyTable]
    : (await client.query('SELECT DISTINCT table_id FROM records WHERE base_id = $1 ORDER BY table_id', [baseId])).rows.map((row) => row.table_id as string);
  for (const tableId of tables) {
    const mirror = (await client.query(
      'SELECT coalesce(airtable_record_id, record_id) AS key, fields FROM records WHERE base_id = $1 AND table_id = $2 AND deleted_at IS NULL',
      [baseId, tableId],
    )).rows as Array<{ key: string; fields: Record<string, unknown> }>;
    const unsent = (await client.query(
      `SELECT DISTINCT record_id FROM write_outbox WHERE base_id = $1 AND table_id = $2 AND status <> 'sent'`,
      [baseId, tableId],
    )).rows.map((row) => row.record_id as string);
    const pendingKeys = new Set(unsent);
    const local = (await client.query(
      'SELECT record_id, airtable_record_id FROM records WHERE base_id = $1 AND table_id = $2 AND airtable_record_id IS NOT NULL',
      [baseId, tableId],
    )).rows as Array<{ record_id: string; airtable_record_id: string }>;
    for (const row of local) if (pendingKeys.has(row.record_id)) pendingKeys.add(row.airtable_record_id);
    const ignoreFields = new Set((await client.query(
      `SELECT name FROM airtable_fields WHERE base_id = $1 AND table_id = $2 AND type IN ('multipleAttachments', 'button')`,
      [baseId, tableId],
    )).rows.map((row) => row.name as string));

    const airtable = await readAirtable(tableId);
    const result = compareWithAirtable(mirror, airtable, { pendingKeys, ignoreFields });
    console.log(`\n${tableId}: postgres=${result.postgresRecords} airtable=${result.airtableRecords} identical=${result.identical} differing=${result.differing} pending-skipped=${result.skippedPending}`);
    if (result.onlyInPostgres.length) console.log(`  only in Postgres (${result.onlyInPostgres.length}):`, result.onlyInPostgres.slice(0, 5).join(', '));
    if (result.onlyInAirtable.length) console.log(`  only in Airtable (${result.onlyInAirtable.length}):`, result.onlyInAirtable.slice(0, 5).join(', '));
    for (const diff of result.differences.slice(0, 10)) {
      console.log(`  ${diff.count}x ${diff.field}  e.g. ${diff.example.record}: postgres=${JSON.stringify(diff.example.postgres)?.slice(0, 80)} airtable=${JSON.stringify(diff.example.airtable)?.slice(0, 80)}`);
    }
  }
} finally {
  await client.end();
}
