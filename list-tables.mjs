import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: `${__dirname}/.env` });

async function listTables() {
  const apiKey = process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.VITE_AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error('Missing credentials in .env');
    process.exit(1);
  }

  try {
    console.log('Fetching available tables in your Airtable base...\n');
    
    const response = await axios.get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const tables = response.data.tables;
    console.log(`Found ${tables.length} table(s):\n`);

    tables.forEach((table, index) => {
      console.log(`${index + 1}. Table Name: "${table.name}"`);
      console.log(`   ID: ${table.id}`);
      console.log(`   Fields: ${table.fields.map(f => f.name).join(', ')}\n`);
    });

  } catch (error) {
    console.error('Error fetching tables:', error.response?.data?.error?.message || error.message);
    process.exit(1);
  }
}

listTables();
