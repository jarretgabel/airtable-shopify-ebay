import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const FIELD_NAME = 'Shopify Taxonomy Attributes JSON';
const baseId = process.env.VITE_AIRTABLE_BASE_ID?.trim();
const tableId = process.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME?.trim();
const apiKey = process.env.VITE_AIRTABLE_API_KEY?.trim();
const apply = process.argv.includes('--apply');

if (!baseId || !tableId || !apiKey) {
  throw new Error('VITE_AIRTABLE_BASE_ID, VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME, and VITE_AIRTABLE_API_KEY are required.');
}

async function airtable(path, options = {}) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Airtable metadata request failed (${response.status}): ${body.error?.message ?? 'Unknown error'}`);
  return body;
}

const metadata = await airtable('/tables');
const table = metadata.tables?.find((candidate) => candidate.id === tableId);
if (!table) throw new Error(`Airtable table ${tableId} was not found in base ${baseId}.`);

const existing = table.fields?.find((field) => field.name === FIELD_NAME);
if (existing) {
  console.log(`Field already exists: ${FIELD_NAME} (${existing.type})`);
  if (existing.type !== 'multilineText') process.exitCode = 1;
} else if (!apply) {
  console.log(`Field missing: ${FIELD_NAME} (would create multilineText). Re-run with --apply to create it.`);
} else {
  const created = await airtable(`/tables/${tableId}/fields`, {
    method: 'POST',
    body: JSON.stringify({ name: FIELD_NAME, type: 'multilineText' }),
  });
  console.log(`Created field: ${created.name} (${created.type})`);
}