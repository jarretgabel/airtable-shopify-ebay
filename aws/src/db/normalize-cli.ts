import pg from 'pg';
import { normalizeListing } from './normalize.js';
import { mergeContacts, normalizeListings, readMirrorListings } from './normalizeApply.js';

const LISTINGS_TABLE = 'tbl0K0nFQL64jQMx8';

// Usage: normalize-cli --base appXXXX [--table tblXXXX] [--apply]
// Reads only the records mirror. The default dry run writes nothing; --apply fills the normalized tables.
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
  const records = await readMirrorListings(client, baseId, tableId);
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} base=${baseId} table=${tableId} mirror records=${records.length}`);
  if (apply) {
    console.log(await normalizeListings(client, records));
    const check = await client.query('SELECT count(*)::int AS n FROM items');
    console.log(`items in Postgres: ${check.rows[0].n}`);
  } else {
    const mapped = records.map((record) => normalizeListing(record.fields));
    const { contacts } = mergeContacts(mapped.flatMap((entry) => (entry.contact ? [entry.contact] : [])));
    console.log({
      items: mapped.length,
      contacts: contacts.length,
      listings: mapped.reduce((sum, entry) => sum + entry.listings.length, 0),
      statusHistory: mapped.reduce((sum, entry) => sum + entry.statusHistory.length, 0),
      images: mapped.reduce((sum, entry) => sum + entry.images.length, 0),
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
