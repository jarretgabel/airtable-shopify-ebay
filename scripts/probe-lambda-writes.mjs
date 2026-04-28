import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { requireReadyLocalApiOrigin } from './local-api-origin.mjs';

const cwd = process.cwd();

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
  ...process.env,
};

function getOptionalEnv(name) {
  const value = mergedEnv[name]?.trim();
  return value || '';
}

function requireEnv(name) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseJsonEnv(name) {
  const raw = requireEnv(name);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${name} must contain a JSON object.`);
    }
    return parsed;
  } catch (error) {
    throw new Error(error instanceof Error ? `${name}: ${error.message}` : `${name} must contain valid JSON.`);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Request failed for ${url}: ${message}`);
  }

  return body;
}

function validateSource(source) {
  if (
    source === 'users'
    || source === 'inventory-directory'
    || source === 'approval-ebay'
    || source === 'approval-shopify'
    || source === 'approval-combined'
  ) {
    return source;
  }

  throw new Error(`Unsupported LAMBDA_WRITE_PROBE_SOURCE: ${source}`);
}

function printHelp() {
  console.log('Skipping write probe. Set LAMBDA_WRITE_PROBE_ENABLED=true and provide:');
  console.log('  LAMBDA_WRITE_PROBE_SOURCE=inventory-directory|approval-ebay|approval-shopify|approval-combined|users');
  console.log('  LAMBDA_WRITE_PROBE_CREATE_FIELDS_JSON={...}');
  console.log('  LAMBDA_WRITE_PROBE_UPDATE_FIELDS_JSON={...}');
  console.log('Optional attachment probe vars (inventory-directory only):');
  console.log('  LAMBDA_WRITE_PROBE_ATTACHMENT_FIELD_ID=fld...');
  console.log('  LAMBDA_WRITE_PROBE_ATTACHMENT_NAME=example.txt');
  console.log('  LAMBDA_WRITE_PROBE_ATTACHMENT_CONTENT_TYPE=text/plain');
  console.log('  LAMBDA_WRITE_PROBE_ATTACHMENT_BASE64=SGVsbG8=');
}

async function main() {
  if (getOptionalEnv('LAMBDA_WRITE_PROBE_ENABLED').toLowerCase() !== 'true') {
    printHelp();
    return;
  }

  const lambdaOrigin = await requireReadyLocalApiOrigin(getOptionalEnv, { purpose: 'Lambda write probe' });
  const source = validateSource(requireEnv('LAMBDA_WRITE_PROBE_SOURCE'));
  const createFields = parseJsonEnv('LAMBDA_WRITE_PROBE_CREATE_FIELDS_JSON');
  const updateFields = parseJsonEnv('LAMBDA_WRITE_PROBE_UPDATE_FIELDS_JSON');

  let createdRecordId = '';

  try {
    console.log(`Running Lambda write probe against ${lambdaOrigin} for source ${source}`);

    const createdRecord = await fetchJson(`${lambdaOrigin}/api/airtable/configured-records/${encodeURIComponent(source)}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: createFields, typecast: true }),
    });

    if (!createdRecord?.id) {
      throw new Error('Create response did not include a record id.');
    }

    createdRecordId = createdRecord.id;
    console.log(`OK  create -> ${createdRecordId}`);

    const updatedRecord = await fetchJson(`${lambdaOrigin}/api/airtable/configured-records/${encodeURIComponent(source)}/${encodeURIComponent(createdRecordId)}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: updateFields, typecast: true }),
    });

    if (updatedRecord?.id !== createdRecordId) {
      throw new Error(`Update response id mismatch: expected ${createdRecordId}, received ${updatedRecord?.id || '<missing>'}`);
    }

    console.log(`OK  update -> ${createdRecordId}`);

    const attachmentFieldId = getOptionalEnv('LAMBDA_WRITE_PROBE_ATTACHMENT_FIELD_ID');
    const attachmentBase64 = getOptionalEnv('LAMBDA_WRITE_PROBE_ATTACHMENT_BASE64');

    if (source === 'inventory-directory' && attachmentFieldId && attachmentBase64) {
      const attachmentName = getOptionalEnv('LAMBDA_WRITE_PROBE_ATTACHMENT_NAME') || 'lambda-write-probe.txt';
      const attachmentContentType = getOptionalEnv('LAMBDA_WRITE_PROBE_ATTACHMENT_CONTENT_TYPE') || 'text/plain';
      const attachmentResult = await fetchJson(
        `${lambdaOrigin}/api/airtable/configured-attachments/${encodeURIComponent(source)}/${encodeURIComponent(createdRecordId)}/${encodeURIComponent(attachmentFieldId)}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: attachmentName,
            contentType: attachmentContentType,
            file: attachmentBase64,
          }),
        },
      );

      if (!attachmentResult?.uploaded) {
        throw new Error('Attachment upload response did not confirm uploaded=true.');
      }

      console.log(`OK  attachment upload -> ${createdRecordId}`);
    }

    const deleteResult = await fetchJson(`${lambdaOrigin}/api/airtable/configured-records/${encodeURIComponent(source)}/${encodeURIComponent(createdRecordId)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!deleteResult?.deleted) {
      throw new Error('Delete response did not confirm deleted=true.');
    }

    console.log(`OK  delete -> ${createdRecordId}`);
    createdRecordId = '';
    console.log('Write probe finished without mismatches.');
  } finally {
    if (createdRecordId) {
      try {
        await fetchJson(`${lambdaOrigin}/api/airtable/configured-records/${encodeURIComponent(source)}/${encodeURIComponent(createdRecordId)}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
          },
        });
        console.log(`Cleanup delete succeeded for ${createdRecordId}`);
      } catch (cleanupError) {
        console.error(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});