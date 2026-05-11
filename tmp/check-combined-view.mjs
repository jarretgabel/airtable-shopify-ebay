import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const root = process.cwd();
let env = { ...process.env };

for (const file of ['.env', '.env.local']) {
  const filePath = path.join(root, file);
  if (fs.existsSync(filePath)) {
    env = { ...dotenv.parse(fs.readFileSync(filePath, 'utf8')), ...env };
  }
}

const apiKey = env.VITE_AIRTABLE_API_KEY;
const base = 'apprsAm2FOohEmL2u';
const table = 'tbl0K0nFQL64jQMx8';
const view = 'viwZdrQSBohX1m35D';
const targetId = process.argv[2]?.trim() || '';

if (!apiKey) {
  throw new Error('Missing VITE_AIRTABLE_API_KEY');
}

async function fetchAllRows() {
  let offset = '';
  const rows = [];

  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${table}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('view', view);
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(json));
    }

    rows.push(...(json.records || []));
    offset = json.offset || '';
  } while (offset);

  return rows;
}

const rows = await fetchAllRows();

console.log(JSON.stringify({
  count: rows.length,
  containsTargetId: Boolean(targetId) ? rows.some((row) => row.id === targetId) : undefined,
  titles: rows.map((row) => ({
    id: row.id,
    title: row.fields['Item Title'] || row.fields['Template Name'] || '',
    workflowStatus: row.fields['Workflow Status'] || '',
    shopifyApproved: row.fields['Shopify Approved'] || '',
    ebayApproved: row.fields['Ebay Approved'] || '',
  })),
}, null, 2));