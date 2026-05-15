import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { enforceLocalOnlyIntegrationTargets } from './helpers/local-only-test-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Prefer local overrides, then fall back to .env.
dotenv.config({ path: `${__dirname}/.env.local` });
dotenv.config({ path: `${__dirname}/.env` });

async function testAirtable() {
  const apiKey = process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.VITE_AIRTABLE_BASE_ID;
  const tableName = process.env.VITE_AIRTABLE_TABLE_NAME || 'Table 1';
  const airtableBaseUrl = `https://api.airtable.com/v0/${baseId}`;

  console.log('Testing Airtable connection...\n');
  console.log('API Key:', apiKey ? `✓ Set (${apiKey.substring(0, 10)}...)` : '✗ Not set');
  console.log('Base ID:', baseId ? `✓ Set (${baseId.substring(0, 10)}...)` : '✗ Not set');

  if (!apiKey || !baseId) {
    console.error('\n✗ Missing credentials. Please set VITE_AIRTABLE_API_KEY and VITE_AIRTABLE_BASE_ID in .env');
    process.exit(1);
  }

  enforceLocalOnlyIntegrationTargets('test-airtable-connection', [
    { label: 'Airtable API', url: airtableBaseUrl },
  ]);

  try {
    const client = axios.create({
      baseURL: airtableBaseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`\nAttempting to fetch "${tableName}" table...`);
    const response = await client.get(`/${encodeURIComponent(tableName)}`);
    
    console.log('\n✓ Connected to Airtable successfully!');
    console.log(`✓ Found ${response.data.records.length} records\n`);

    if (response.data.records.length > 0) {
      const record = response.data.records[0];
      console.log('First record:');
      console.log('  ID:', record.id);
      console.log('  Fields:', JSON.stringify(record.fields, null, 2));
    }

  } catch (error) {
    console.error('\n✗ Error connecting to Airtable:');
    if (error.response?.status === 401) {
      console.error('  - Invalid API key');
    } else if (error.response?.status === 404) {
      console.error(`  - Table "${tableName}" not found`);
      console.error('  - Please update VITE_AIRTABLE_TABLE_NAME in your env file');
    } else if (error.response?.data) {
      console.error('  -', error.response.data.error?.message || error.message);
    } else {
      console.error('  -', error.message);
    }
    process.exit(1);
  }
}

testAirtable();
