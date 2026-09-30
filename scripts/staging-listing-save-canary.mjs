import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const CONFIRM_TOKEN = 'RUN_STAGING_LISTING_SAVE_CANARY';
const MARKER = '[COMBINED_LISTINGS_SAMPLE_DATA]';

function readEnvFile(filePath) {
  return fs.existsSync(filePath) ? dotenv.parse(fs.readFileSync(filePath, 'utf8')) : {};
}

const env = {
  ...readEnvFile(path.join(process.cwd(), '.env')),
  ...readEnvFile(path.join(process.cwd(), '.env.local')),
  ...process.env,
};

function requireEnv(name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function requestJson(origin, routePath, options = {}) {
  const response = await fetch(`${origin}${routePath}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || `${options.method || 'GET'} ${routePath} failed with ${response.status}.`);
  return body;
}

function comparableValue(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.text === 'string') {
    return value.text.trim();
  }
  return value;
}

async function main() {
  const confirm = process.argv.includes('--confirm')
    ? process.argv[process.argv.indexOf('--confirm') + 1]
    : '';
  if (confirm !== CONFIRM_TOKEN) throw new Error(`Run with --confirm ${CONFIRM_TOKEN}.`);

  const origin = requireEnv('STAGING_CANARY_ORIGIN').replace(/\/$/, '');
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== 'https:' || !parsedOrigin.hostname.endsWith('.cloudfront.net')) {
    throw new Error('STAGING_CANARY_ORIGIN must be an explicit HTTPS CloudFront staging origin.');
  }

  const email = requireEnv('STAGING_CANARY_EMAIL');
  const password = requireEnv('STAGING_CANARY_PASSWORD');
  const loginResponse = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginText = await loginResponse.text();
  const loginBody = loginText ? JSON.parse(loginText) : null;
  if (!loginResponse.ok) throw new Error(loginBody?.message || `Staging login failed with ${loginResponse.status}.`);

  const cookie = (loginResponse.headers.get('set-cookie') || '').split(';')[0]?.trim();
  const csrfToken = String(loginBody?.csrfToken || '');
  if (!cookie || !csrfToken) throw new Error('Staging login did not return the required session and CSRF values.');

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Cookie: cookie,
    'x-csrf-token': csrfToken,
  };
  const stamp = Date.now();
  let recordId = '';

  try {
    const created = await requestJson(origin, '/api/airtable/configured-records/approval-combined', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        typecast: true,
        fields: {
          'Template Name': `${MARKER} Staging Canary`,
          'Item Title': `${MARKER} Staging Canary ${stamp}`,
          Description: 'Disposable automated staging save canary.',
          SKU: `SAMPLE-LISTING-CANARY-${stamp}`,
          'Ebay Approved': 'FALSE',
          'Workflow Status': 'Awaiting Pre-Listing Review',
        },
      }),
    });
    recordId = String(created?.id || '');
    if (!recordId) throw new Error('Canary create response did not include a record ID.');

    const expected = {
      'Item Title': `${MARKER} Staging Canary Saved ${stamp}`,
      Description: 'Canary multi-field update persisted.',
      'Ebay Domestic Shipping Fees': 'Flat',
      'Ebay International Shipping Fees': 'Calculated',
      'Ebay Price': 1424.24,
    };
    await requestJson(origin, `/api/airtable/configured-records/approval-combined/${recordId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ typecast: true, fields: expected }),
    });

    const verified = await requestJson(origin, `/api/airtable/configured-records/approval-combined/${recordId}`, {
      headers: { Accept: 'application/json', Cookie: cookie },
    });
    for (const [fieldName, expectedValue] of Object.entries(expected)) {
      const actualValue = comparableValue(verified?.fields?.[fieldName]);
      if (actualValue !== expectedValue) {
        throw new Error(`${fieldName} mismatch: expected ${JSON.stringify(expectedValue)}, received ${JSON.stringify(verified?.fields?.[fieldName])}.`);
      }
    }
    if (verified?.fields?.['Ebay Approved'] !== 'FALSE') throw new Error('Canary record approval state changed unexpectedly.');

    const normalized = await requestJson(origin, '/api/approval/normalize', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        target: 'both',
        fields: verified.fields,
      }),
    });
    if (!normalized?.shopify?.productSetRequest) {
      throw new Error('Canary normalization did not produce a Shopify productSet request.');
    }
    if (!normalized?.ebay?.draftPayloadBundle) {
      throw new Error('Canary normalization did not produce an eBay draft payload bundle.');
    }

    console.log(`Staging save and processing canary passed for ${recordId}.`);
  } finally {
    if (recordId) {
      await requestJson(origin, `/api/airtable/configured-records/approval-combined/${recordId}`, {
        method: 'DELETE',
        headers,
      });
      console.log(`Deleted canary record ${recordId}.`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});