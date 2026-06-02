#!/usr/bin/env node

import axios from 'axios';

// Load Airtable API key from environment
const API_KEY = process.env.VITE_AIRTABLE_API_KEY;

if (!API_KEY) {
  console.error(
    'Error: VITE_AIRTABLE_API_KEY environment variable is not set.\n' +
    'Please add it to .env.local or set it in your shell environment.\n' +
    'Example: export VITE_AIRTABLE_API_KEY="patXXXXXXX.xxxxxxxxxxxxx"'
  );
  process.exit(1);
}

const BASE_ID = 'apprsAm2FOohEmL2u';
const TABLE_ID = 'tbl0K0nFQL64jQMx8';

const api = axios.create({
  baseURL: 'https://api.airtable.com/v0',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
});

const fields = [
  {
    name: 'Shopify Order ID',
    type: 'singleLineText',
    description: 'Persist from orders/paid webhooks; used for fallback matching',
  },
  {
    name: 'Shopify Order Name',
    type: 'singleLineText',
    description: 'Human-readable reference (e.g., #1001); system-owned audit',
  },
  {
    name: 'Shopify Last Webhook Event ID',
    type: 'singleLineText',
    description: 'x-shopify-event-id header value for idempotency; prevents duplicate writes',
  },
  {
    name: 'Shopify Last Webhook At',
    type: 'date',
    description: 'Audit timestamp for most recent Shopify webhook write',
    options: {
      dateFormat: {
        name: 'iso',
      },
    },
  },
  {
    name: 'Shopify Last Webhook Event',
    type: 'singleLineText',
    description: 'Webhook topic audit trail (orders/paid, refunds/create, orders/cancelled)',
  },
  {
    name: 'Shopify Sync Locked',
    type: 'checkbox',
    description: 'Manual override to prevent webhook writeback; mirrors eBay Sync Locked',
    options: {
      icon: 'check',
      color: 'greenBright',
    },
  },
];

async function createFields() {
  console.log(`Creating ${fields.length} fields in table ${TABLE_ID}...\n`);

  let created = 0;
  let failed = 0;

  for (const field of fields) {
    try {
      console.log(`Creating field: ${field.name}...`);

      const response = await api.post(`/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`, {
        name: field.name,
        type: field.type,
        description: field.description,
        ...(field.options && { options: field.options }),
      });

      console.log(`✅ Created: ${field.name} (ID: ${response.data.id})\n`);
      created++;
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      if (status === 422) {
        console.log(`⚠️  Skipped: ${field.name} (field already exists or invalid options)\n`);
        created++;
      } else {
        console.error(`❌ Failed to create ${field.name}: ${message}\n`);
        failed++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary: ${created} created/skipped, ${failed} failed`);
  console.log(`${'='.repeat(60)}`);

  if (failed > 0) {
    process.exit(1);
  }
}

createFields().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
