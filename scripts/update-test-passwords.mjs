#!/usr/bin/env node
/**
 * Update test user passwords in Airtable via API.
 * Usage: AIRTABLE_API_KEY=your_key node scripts/update-test-passwords.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import path from 'node:path';

const AIRTABLE_BASE_ID = 'apprsAm2FOohEmL2u';
const AIRTABLE_USERS_TABLE_ID = 'tblj2Gt9USORo6Vi5';
const PASSWORD_FIELD_PAYLOAD_PREFIX = '__LCC_PASSWORD__:';
const PASSWORD_HASH_SCHEME = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_HASH_KEY_LENGTH = 32;

function readLocalEnvValue(name) {
  const envPath = path.resolve('.env.local');
  if (!existsSync(envPath)) {
    return '';
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== name) {
      continue;
    }

    return trimmed.slice(separatorIndex + 1).trim().replace(/^"|"$/g, '');
  }

  return '';
}

function encodeBase64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function buildPasswordHash(password, salt, iterations) {
  return pbkdf2Sync(password, salt, iterations, PASSWORD_HASH_KEY_LENGTH, 'sha256').toString('base64');
}

function serializePasswordField(password, mustChangePassword = false) {
  const salt = randomBytes(16).toString('base64');
  const hash = buildPasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);

  return encodeBase64(`${PASSWORD_FIELD_PAYLOAD_PREFIX}${JSON.stringify({
    scheme: PASSWORD_HASH_SCHEME,
    iterations: PASSWORD_HASH_ITERATIONS,
    salt,
    hash,
    mustChangePassword,
  })}`);
}

const apiKey = process.env.AIRTABLE_API_KEY || readLocalEnvValue('VITE_AIRTABLE_API_KEY');
if (!apiKey) {
  console.error('Error: AIRTABLE_API_KEY or VITE_AIRTABLE_API_KEY is required');
  process.exit(1);
}

const testAccounts = [
  { email: 'admin@example.com', password: 'Admin123!' },
  { email: 'owner@example.com', password: 'Owner123!' },
  { email: 'developer@example.com', password: 'Developer123!' },
  { email: 'processor@example.com', password: 'Processor123!' },
  { email: 'tester@example.com', password: 'Tester123!' },
  { email: 'photographer@example.com', password: 'Photographer123!' },
];

async function updatePassword(email, password) {
  try {
    // First, find the record by email
    const searchUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USERS_TABLE_ID}`);
    searchUrl.searchParams.set('filterByFormula', `{Email} = '${email}'`);
    searchUrl.searchParams.set('maxRecords', '1');

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status} ${await searchResponse.text()}`);
    }

    const searchData = await searchResponse.json();
    if (!searchData.records || searchData.records.length === 0) {
      console.error(`❌ Record not found: ${email}`);
      return false;
    }

    const recordId = searchData.records[0].id;

    // Now update the record
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USERS_TABLE_ID}/${recordId}`;
    const hashedPassword = serializePasswordField(password);
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Password': hashedPassword,
        },
      }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Update failed: ${updateResponse.status} ${await updateResponse.text()}`);
    }

    console.log(`✅ Updated: ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating ${email}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Updating test account passwords in Airtable...\n');

  let successCount = 0;
  for (const { email, password } of testAccounts) {
    const success = await updatePassword(email, password);
    if (success) successCount++;
    // Add delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n${successCount}/${testAccounts.length} records updated successfully`);
  process.exit(successCount === testAccounts.length ? 0 : 1);
}

main();
