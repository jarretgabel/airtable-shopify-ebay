// Script: print_airtable_workflow_image_metadata.ts
// Prints the Workflow Image Metadata JSON for a given Airtable record ID

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const AIRTABLE_API_KEY = process.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
  console.error('Missing required env vars: VITE_AIRTABLE_API_KEY, VITE_AIRTABLE_BASE_ID, VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME');
  process.exit(1);
}

const recordId = process.argv[2];
if (!recordId) {
  console.error('Usage: tsx print_airtable_workflow_image_metadata.ts <recordId>');
  process.exit(1);
}

async function main() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${recordId}`;
  const resp = await axios.get(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const fields = resp.data.fields || {};
  const metadata = fields['Workflow Image Metadata JSON'];
  if (!metadata) {
    console.log('No Workflow Image Metadata JSON found for this record.');
    return;
  }
  try {
    const parsed = JSON.parse(metadata);
    console.dir(parsed, { depth: null });
  } catch (e) {
    console.log('Raw metadata:', metadata);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
