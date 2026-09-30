import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const BASE_ID = 'apprsAm2FOohEmL2u';
const TABLE_ID = 'tbl0K0nFQL64jQMx8';
const REQUIRED_FIELDS = new Map([
  ['Item Title', null],
  ['Description', null],
  ['Key Features (Key, Value)', null],
  ['SKU', null],
  ['Workflow Status', null],
  ['Ebay Approved', null],
  ['Ebay Categories', 'multipleSelects'],
  ['Ebay Domestic Shipping Fees', null],
  ['Ebay International Shipping Fees', null],
  ['Ebay Price', null],
  ['Vendor', 'singleLineText'],
]);

function readEnvFile(filePath) {
  return fs.existsSync(filePath) ? dotenv.parse(fs.readFileSync(filePath, 'utf8')) : {};
}

const env = {
  ...readEnvFile(path.join(process.cwd(), '.env')),
  ...readEnvFile(path.join(process.cwd(), '.env.local')),
  ...process.env,
};

async function main() {
  const apiKey = String(env.VITE_AIRTABLE_API_KEY || env.AIRTABLE_API_KEY || '').trim();
  if (!apiKey) throw new Error('Missing VITE_AIRTABLE_API_KEY or AIRTABLE_API_KEY.');

  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || `Airtable metadata request failed with ${response.status}.`);

  const table = (body.tables || []).find((candidate) => candidate.id === TABLE_ID);
  if (!table) throw new Error(`Required Airtable table ${TABLE_ID} was not found.`);

  const fields = new Map((table.fields || []).map((field) => [field.name, field]));
  const failures = [];
  for (const [fieldName, expectedType] of REQUIRED_FIELDS) {
    const field = fields.get(fieldName);
    if (!field) {
      failures.push(`${fieldName}: missing`);
    } else if (expectedType && field.type !== expectedType) {
      failures.push(`${fieldName}: expected ${expectedType}, received ${field.type}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Combined Listings schema validation failed:\n- ${failures.join('\n- ')}`);
  }

  console.log(`Validated ${REQUIRED_FIELDS.size} required Combined Listings fields in ${BASE_ID}/${TABLE_ID}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});