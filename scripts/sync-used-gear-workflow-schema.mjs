import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const BASE_ID = 'apprsAm2FOohEmL2u';
const TABLE_ID = 'tbl0K0nFQL64jQMx8';
const OUT_DIR = path.join(process.cwd(), 'tmp', 'used-gear-workflow-schema');

function loadEnv() {
  let merged = { ...process.env };
  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      merged = { ...dotenv.parse(fs.readFileSync(filePath, 'utf8')), ...merged };
    }
  }
  return merged;
}

function requireApiKey() {
  const apiKey = loadEnv().VITE_AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing VITE_AIRTABLE_API_KEY');
  }
  return apiKey;
}

function writeJson(fileName, value) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const ISO_DATE_TIME_OPTIONS = {
  dateFormat: { name: 'iso', format: 'YYYY-MM-DD' },
  timeFormat: { name: '24hour', format: 'HH:mm' },
  timeZone: 'utc',
};

const APPROVED_FIELD_DEFINITIONS = [
  { name: 'Workflow Source', type: 'singleSelect', options: { choices: [{ name: 'JotForm', color: 'blueLight2' }, { name: 'Manual Entry', color: 'cyanLight2' }] } },
  { name: 'Submission Group ID', type: 'singleLineText' },
  { name: 'Pick Up ID', type: 'singleLineText' },
  { name: 'Workflow Owner', type: 'singleLineText' },
  { name: 'Workflow Owner Assigned At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Trash Status', type: 'singleSelect', options: { choices: [{ name: 'Active Trash', color: 'redLight1' }, { name: 'Restored', color: 'greenLight2' }, { name: 'Ready for Deletion', color: 'grayDark1' }] } },
  { name: 'Accepted By', type: 'singleLineText' },
  { name: 'Accepted At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Processing Signed By', type: 'singleLineText' },
  { name: 'Processing Signed At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Testing Signed By', type: 'singleLineText' },
  { name: 'Testing Signed At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Photography Signed By', type: 'singleLineText' },
  { name: 'Photography Signed At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Pre-Listing Reviewed By', type: 'singleLineText' },
  { name: 'Pre-Listing Reviewed At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Qualification Notes', type: 'multilineText' },
  { name: 'Qualification Complete', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
  { name: 'Unqualified Reason', type: 'multilineText' },
  { name: 'Customer Cosmetic Notes', type: 'multilineText' },
  { name: 'Customer Functional Notes', type: 'multilineText' },
  { name: 'Customer Inclusion Notes', type: 'multilineText' },
  { name: 'Customer Submitted Photos Notes', type: 'multilineText' },
  { name: 'Testing Cosmetic Notes', type: 'multilineText' },
  { name: 'Photography Cosmetic Notes', type: 'multilineText' },
  { name: 'Workflow Image Metadata JSON', type: 'multilineText' },
  { name: 'Internal Cosmetic Notes', type: 'multilineText' },
  { name: 'Internal Functional Notes', type: 'multilineText' },
  { name: 'Internal Inclusion Notes', type: 'multilineText' },
  { name: 'Offer Amount', type: 'currency', options: { precision: 2, symbol: '$' } },
  { name: 'Paid Amount', type: 'currency', options: { precision: 2, symbol: '$' } },
  { name: 'Confirmed Grand Total', type: 'currency', options: { precision: 2, symbol: '$' } },
  { name: 'Allocation Mode', type: 'singleSelect', options: { choices: [{ name: 'Equal Split', color: 'blueLight2' }, { name: 'Manual Override', color: 'orangeLight1' }] } },
  { name: 'Allocation Notes', type: 'multilineText' },
  {
    name: 'Workflow Status',
    type: 'singleSelect',
    options: {
      choices: [
        { name: 'Pending Review', color: 'blueLight2' },
        { name: 'Unqualified', color: 'redLight1' },
        { name: 'Accepted - Awaiting Arrival', color: 'cyanLight2' },
        { name: 'Accepted - Arrived, Awaiting SKU', color: 'tealLight2' },
        { name: 'Accepted - Arrived, Awaiting Missing Item', color: 'yellowLight2' },
        { name: 'Testing In Progress', color: 'orangeLight1' },
        { name: 'Photography In Progress', color: 'orangeLight2' },
        { name: 'Awaiting Pre-Listing Review', color: 'pinkLight2' },
        { name: 'Approved for Publish', color: 'greenLight1' },
        { name: 'Listed, Shopify', color: 'greenLight2' },
        { name: 'Listed, eBay', color: 'blueLight1' },
        { name: 'Stale Listing, Shopify', color: 'yellowLight2' },
        { name: 'Stale Listing, eBay', color: 'orangeLight2' },
        { name: 'Sold - Ready to Ship', color: 'cyanLight1' },
        { name: 'Shipped', color: 'grayLight2' },
      ],
    },
  },
  { name: 'Awaiting Pre-Listing Review At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Approved For Publish At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Listed At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'eBay Published At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'eBay Offer ID', type: 'singleLineText' },
  { name: 'eBay Listing ID', type: 'singleLineText' },
  { name: 'Stale Listing At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Sold Ready To Ship At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
  { name: 'Shipped At', type: 'dateTime', options: ISO_DATE_TIME_OPTIONS },
];

const APPROVED_FIELD_NAMES = APPROVED_FIELD_DEFINITIONS.map((field) => field.name).concat([
  'Stale Recovery Status',
  'Stale Recovery Notes',
  'Stale Recovery Updated At',
  'Relisted At',
]);

async function fetchJson(url, apiKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const json = await response.json();
  if (response.ok === false) {
    throw new Error(JSON.stringify(json, null, 2));
  }

  return json;
}

async function fetchTable(apiKey) {
  const payload = await fetchJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, apiKey);
  const table = payload.tables.find((entry) => entry.id === TABLE_ID);
  if (!table) {
    throw new Error('Airtable metadata table not found.');
  }
  return table;
}

async function createField(apiKey, definition) {
  return fetchJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`, apiKey, {
    method: 'POST',
    body: JSON.stringify(definition),
  });
}

async function renameField(apiKey, fieldId, name) {
  return fetchJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields/${fieldId}`, apiKey, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

async function main() {
  const apiKey = requireApiKey();
  const before = await fetchTable(apiKey);
  writeJson('prechange-table-metadata.json', before);

  const renamedFields = [];
  const legacyTestingCosmeticField = before.fields.find((field) => field.name === 'Cosmetic Condition Notes');
  const testingCosmeticField = before.fields.find((field) => field.name === 'Testing Cosmetic Notes');

  if (legacyTestingCosmeticField && !testingCosmeticField) {
    const renamed = await renameField(apiKey, legacyTestingCosmeticField.id, 'Testing Cosmetic Notes');
    renamedFields.push({ id: renamed.id, from: 'Cosmetic Condition Notes', to: renamed.name, type: renamed.type });
    console.log(`RENAMED Cosmetic Condition Notes -> ${renamed.name} (${renamed.id})`);
  }

  const current = renamedFields.length > 0 ? await fetchTable(apiKey) : before;
  const liveFieldNames = new Set(current.fields.map((field) => field.name));
  const missingDefinitions = APPROVED_FIELD_DEFINITIONS.filter((field) => !liveFieldNames.has(field.name));
  const createdFields = [];

  for (const definition of missingDefinitions) {
    const created = await createField(apiKey, definition);
    createdFields.push({ id: created.id, name: created.name, type: created.type });
    console.log(`CREATED ${created.name} (${created.id})`);
  }

  const after = await fetchTable(apiKey);
  const approvedWorkflowFields = after.fields
    .filter((field) => APPROVED_FIELD_NAMES.includes(field.name))
    .map((field) => ({ id: field.id, name: field.name, type: field.type }));

  writeJson('postchange-table-metadata.json', after);
  writeJson('created-fields.json', createdFields);
  writeJson('renamed-fields.json', renamedFields);
  writeJson('rollback-delete-created-fields.json', {
    baseId: BASE_ID,
    tableId: TABLE_ID,
    created: createdFields,
    rollbackOrder: [...createdFields].reverse(),
  });
  writeJson('approved-workflow-field-ids.json', approvedWorkflowFields);
  writeJson('rollback-delete-approved-workflow-fields.json', {
    baseId: BASE_ID,
    tableId: TABLE_ID,
    fields: approvedWorkflowFields,
    rollbackOrder: [...approvedWorkflowFields].reverse(),
  });
  writeJson('summary.json', {
    renamedCount: renamedFields.length,
    renamedFields,
    createdCount: createdFields.length,
    createdFieldNames: createdFields.map((field) => field.name),
    approvedWorkflowFieldCount: approvedWorkflowFields.length,
  });

  console.log(`RENAMED_COUNT ${renamedFields.length}`);
  console.log(`CREATED_COUNT ${createdFields.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});