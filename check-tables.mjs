import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: `${__dirname}/.env` });

async function testTableNames() {
  const apiKey = process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.VITE_AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error('Missing credentials in .env');
    process.exit(1);
  }

  const commonTableNames = [
    'Listings',
    'Products',
    'Inventory',
    'Items',
    'Catalog',
    'Shopify',
    'eBay',
    'Grid view',
  ];

  const client = axios.create({
    baseURL: `https://api.airtable.com/v0/${baseId}`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  console.log('Testing common table names...\n');

  for (const tableName of commonTableNames) {
    try {
      const response = await client.get(`/${tableName}?maxRecords=1`);
      console.log(`✓ Found table: "${tableName}"`);
      console.log(`  Records: ${response.data.records.length}`);
      if (response.data.records.length > 0) {
        console.log(`  Fields: ${Object.keys(response.data.records[0].fields).join(', ')}`);
      }
      console.log();
    } catch (error) {
      if (error.response?.status !== 404) {
        console.log(`? Error checking "${tableName}":`, error.response?.data?.error?.message);
      }
    }
  }
}

testTableNames();
