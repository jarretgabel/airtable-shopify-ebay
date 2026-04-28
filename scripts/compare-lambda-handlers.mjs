import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const cwd = process.cwd();
const awsDir = path.join(cwd, 'aws');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
  ...process.env,
};

function requireEnv(name) {
  const value = mergedEnv[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name) {
  const value = mergedEnv[name]?.trim();
  return value || '';
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

async function fetchDirectJotFormForms() {
  const apiKey = requireEnv('VITE_JOTFORM_API_KEY');
  const url = new URL('https://api.jotform.com/user/forms');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('limit', '100');
  url.searchParams.set('orderby', 'created_at');
  url.searchParams.set('direction', 'DESC');
  const body = await fetchJson(url);
  return body.content;
}

async function fetchDirectJotFormSubmissions() {
  const apiKey = requireEnv('VITE_JOTFORM_API_KEY');
  const formId = requireEnv('VITE_JOTFORM_FORM_ID');
  const url = new URL(`https://api.jotform.com/form/${encodeURIComponent(formId)}/submissions`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('limit', '100');
  url.searchParams.set('offset', '0');
  url.searchParams.set('orderby', 'created_at');
  url.searchParams.set('direction', 'DESC');
  const body = await fetchJson(url);
  return { formId, submissions: body.content };
}

async function fetchDirectAirtableListings() {
  const baseId = requireEnv('VITE_AIRTABLE_BASE_ID');
  const tableName = requireEnv('VITE_AIRTABLE_TABLE_NAME');
  const viewId = getOptionalEnv('VITE_AIRTABLE_VIEW_ID');

  const records = await fetchAllAirtableRecords(baseId, tableName, viewId);

  return { tableName, viewId, records };
}

async function fetchAllAirtableRecords(baseId, tableName, viewId = '') {
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');

  const records = [];
  let offset = '';

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
    if (viewId) url.searchParams.set('view', viewId);
    if (offset) url.searchParams.set('offset', offset);
    const body = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    records.push(...(body.records || []));
    offset = body.offset || '';
  } while (offset);

  return records;
}

async function fetchDirectConfiguredUsersRecords() {
  const usersRef = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF');
  const usersName = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME') || 'j2Gt9USORo6Vi5';

  if (usersRef && !usersRef.includes('/')) {
    return fetchAllAirtableRecords(requireEnv('VITE_AIRTABLE_BASE_ID'), usersRef);
  }

  if (usersRef && usersRef.includes('/')) {
    const { parseAirtableReferenceCandidates } = await import(pathToFileURL(path.join(cwd, 'aws', 'dist', 'providers', 'airtable', 'reference.js')).href);
    const candidates = parseAirtableReferenceCandidates(usersRef, usersName, requireEnv('VITE_AIRTABLE_BASE_ID'));
    let lastError;

    for (const candidate of candidates) {
      try {
        return await fetchAllAirtableRecords(candidate.baseId, candidate.tableName, candidate.viewId || '');
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('Unable to load direct Airtable users records.');
  }

  return fetchAllAirtableRecords(requireEnv('VITE_AIRTABLE_BASE_ID'), usersName);
}

async function fetchDirectConfiguredRecordsFromReference(reference, tableName) {
  const { parseAirtableReferenceCandidates } = await import(pathToFileURL(path.join(cwd, 'aws', 'dist', 'providers', 'airtable', 'reference.js')).href);
  const candidates = parseAirtableReferenceCandidates(reference, tableName, requireEnv('VITE_AIRTABLE_BASE_ID'));
  let lastError;

  for (const candidate of candidates) {
    try {
      return await fetchAllAirtableRecords(candidate.baseId, candidate.tableName, candidate.viewId || '');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to load direct Airtable records for ${reference}.`);
}

async function fetchDirectConfiguredApprovalRecords(source) {
  if (source === 'approval-ebay') {
    const tableReference = getOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_REF');
    const tableName = getOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_NAME') || getOptionalEnv('VITE_AIRTABLE_TABLE_NAME');
    if (!tableReference) return null;
    return fetchDirectConfiguredRecordsFromReference(tableReference, tableName);
  }

  if (source === 'approval-shopify') {
    const tableReference = getOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF');
    const tableName = getOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME');
    if (!tableReference) return null;
    return fetchDirectConfiguredRecordsFromReference(tableReference, tableName);
  }

  if (source === 'approval-combined') {
    const tableReference = getOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF');
    const tableName = getOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME') || 'tbl0K0nFQL64jQMx8';
    if (!tableReference) return null;
    return fetchDirectConfiguredRecordsFromReference(tableReference, tableName);
  }

  return null;
}

async function fetchDirectInventoryDirectoryRecords() {
  return fetchAllAirtableRecords('appjQj8FQfFZ2ogMz', 'tblirsoRIFPDMHxb0');
}

function setAwsEnv() {
  process.env.JOTFORM_API_KEY = requireEnv('VITE_JOTFORM_API_KEY');
  process.env.AIRTABLE_API_KEY = requireEnv('VITE_AIRTABLE_API_KEY');
  process.env.AIRTABLE_BASE_ID = requireEnv('VITE_AIRTABLE_BASE_ID');
  process.env.ALLOWED_AIRTABLE_TABLE_NAME = requireEnv('VITE_AIRTABLE_TABLE_NAME');
  process.env.AIRTABLE_USERS_TABLE_REF = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF');
  process.env.AIRTABLE_USERS_TABLE_NAME = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME');
  process.env.AIRTABLE_APPROVAL_TABLE_REF = getOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_REF');
  process.env.AIRTABLE_APPROVAL_TABLE_NAME = getOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_NAME');
  process.env.AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF = getOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF');
  process.env.AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME = getOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME');
  process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF = getOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF');
  process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = getOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME');

  const viewId = getOptionalEnv('VITE_AIRTABLE_VIEW_ID');
  if (viewId) {
    process.env.ALLOWED_AIRTABLE_VIEW_ID = viewId;
  } else {
    delete process.env.ALLOWED_AIRTABLE_VIEW_ID;
  }
}

function buildAwsDist() {
  execFileSync('npm', ['run', 'typecheck'], { cwd: awsDir, stdio: 'inherit' });
  execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd: awsDir, stdio: 'inherit' });
}

async function importHandler(relativePath) {
  const moduleUrl = pathToFileURL(path.join(awsDir, 'dist', relativePath)).href;
  return import(moduleUrl);
}

async function invokeHandler(handler, event) {
  const response = await handler(event);
  const body = response.body ? JSON.parse(response.body) : null;

  if ((response.statusCode || 500) >= 400) {
    throw new Error(body?.message || `Handler failed with ${response.statusCode}`);
  }

  return body;
}

function sampleIds(items, count = 5) {
  return items.slice(0, count).map((item) => item?.id ?? '');
}

function compareArrays(label, direct, lambda, requiredKeys) {
  const failures = [];

  if (!Array.isArray(direct) || !Array.isArray(lambda)) {
    failures.push('one side did not return an array');
    return failures;
  }

  if (direct.length !== lambda.length) {
    failures.push(`length mismatch: direct=${direct.length}, lambda=${lambda.length}`);
  }

  const directKeys = direct[0] ? Object.keys(direct[0]).sort().join(',') : '';
  const lambdaKeys = lambda[0] ? Object.keys(lambda[0]).sort().join(',') : '';
  if (directKeys !== lambdaKeys) {
    failures.push(`top-level key mismatch: direct=[${directKeys}] lambda=[${lambdaKeys}]`);
  }

  for (const key of requiredKeys) {
    if (direct[0] && !(key in direct[0])) failures.push(`direct ${label} missing required key ${key}`);
    if (lambda[0] && !(key in lambda[0])) failures.push(`lambda ${label} missing required key ${key}`);
  }

  const directSample = sampleIds(direct);
  const lambdaSample = sampleIds(lambda);
  if (JSON.stringify(directSample) !== JSON.stringify(lambdaSample)) {
    failures.push(`sample id mismatch: direct=${JSON.stringify(directSample)} lambda=${JSON.stringify(lambdaSample)}`);
  }

  return failures;
}

function printResult(label, failures) {
  if (failures.length === 0) {
    console.log(`OK  ${label}`);
    return;
  }

  console.log(`FAIL  ${label}`);
  failures.forEach((failure) => console.log(`  - ${failure}`));
}

async function main() {
  console.log('Comparing direct provider responses to in-process Lambda handlers');
  console.log('');

  setAwsEnv();
  buildAwsDist();

  const jotformFormsHandler = (await importHandler(path.join('handlers', 'jotform', 'getForms.js'))).handler;
  const jotformSubmissionsHandler = (await importHandler(path.join('handlers', 'jotform', 'getFormSubmissions.js'))).handler;
  const airtableListingsHandler = (await importHandler(path.join('handlers', 'airtable', 'getListings.js'))).handler;
  const airtableConfiguredRecordsHandler = (await importHandler(path.join('handlers', 'airtable', 'getConfiguredRecords.js'))).handler;

  const directForms = await fetchDirectJotFormForms();
  const lambdaForms = await invokeHandler(jotformFormsHandler, {
    queryStringParameters: { limit: '100', orderby: 'created_at', direction: 'DESC' },
  });
  const formFailures = compareArrays('JotForm forms', directForms, lambdaForms, ['id', 'title', 'created_at']);
  printResult('JotForm forms', formFailures);

  const { formId, submissions: directSubmissions } = await fetchDirectJotFormSubmissions();
  const lambdaSubmissions = await invokeHandler(jotformSubmissionsHandler, {
    pathParameters: { formId },
    queryStringParameters: { limit: '100', offset: '0', orderby: 'created_at', direction: 'DESC' },
  });
  const submissionFailures = compareArrays('JotForm submissions', directSubmissions, lambdaSubmissions, ['id', 'form_id', 'created_at', 'answers']);
  printResult('JotForm submissions', submissionFailures);

  const { tableName, viewId, records: directRecords } = await fetchDirectAirtableListings();
  const lambdaRecords = await invokeHandler(airtableListingsHandler, {
    queryStringParameters: {
      tableName,
      ...(viewId ? { view: viewId } : {}),
    },
  });
  const airtableFailures = compareArrays('Airtable listings', directRecords, lambdaRecords, ['id', 'fields', 'createdTime']);
  printResult('Airtable listings', airtableFailures);

  let usersFailures = [];
  if (getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF') || getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME')) {
    const directUsers = await fetchDirectConfiguredUsersRecords();
    const lambdaUsers = await invokeHandler(airtableConfiguredRecordsHandler, {
      queryStringParameters: { source: 'users' },
    });
    usersFailures = compareArrays('Airtable users', directUsers, lambdaUsers, ['id', 'fields', 'createdTime']);
    printResult('Airtable users', usersFailures);
  }

  const directInventoryRecords = await fetchDirectInventoryDirectoryRecords();
  const inventoryLambdaRecords = await invokeHandler(airtableConfiguredRecordsHandler, {
    queryStringParameters: { source: 'inventory-directory' },
  });
  const inventoryFailures = compareArrays('Inventory directory', directInventoryRecords, inventoryLambdaRecords, ['id', 'fields', 'createdTime']);
  printResult('Inventory directory', inventoryFailures);

  const approvalReadFailures = [];
  for (const source of ['approval-ebay', 'approval-shopify', 'approval-combined']) {
    const directApprovalRecords = await fetchDirectConfiguredApprovalRecords(source);
    if (!directApprovalRecords) continue;

    const lambdaApprovalRecords = await invokeHandler(airtableConfiguredRecordsHandler, {
      queryStringParameters: { source },
    });
    const failures = compareArrays(`Airtable ${source}`, directApprovalRecords, lambdaApprovalRecords, ['id', 'fields', 'createdTime']);
    approvalReadFailures.push(...failures);
    printResult(`Airtable ${source}`, failures);
  }

  const allFailures = [...formFailures, ...submissionFailures, ...airtableFailures, ...usersFailures, ...inventoryFailures, ...approvalReadFailures];
  console.log('');
  if (allFailures.length > 0) {
    process.exitCode = 1;
    console.log('Comparison finished with mismatches.');
    return;
  }

  console.log('Comparison finished without mismatches.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});