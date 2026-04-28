import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import net from 'node:net';
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

function setAwsEnv() {
  process.env.EBAY_ENV = getOptionalEnv('VITE_EBAY_ENV');
  process.env.EBAY_CLIENT_ID = getOptionalEnv('VITE_EBAY_CLIENT_ID');
  process.env.EBAY_CLIENT_SECRET = getOptionalEnv('VITE_EBAY_CLIENT_SECRET');
  process.env.EBAY_REFRESH_TOKEN = getOptionalEnv('VITE_EBAY_REFRESH_TOKEN');
  process.env.EBAY_AUTH_HOST = getOptionalEnv('VITE_EBAY_AUTH_HOST');
  process.env.EBAY_APP_SCOPE = getOptionalEnv('VITE_EBAY_APP_SCOPE');
}

function hasEbayRuntimeConfig() {
  return Boolean(getOptionalEnv('VITE_EBAY_CLIENT_ID') && getOptionalEnv('VITE_EBAY_CLIENT_SECRET') && getOptionalEnv('VITE_EBAY_REFRESH_TOKEN'));
}

function normalizeLambdaOrigin(value) {
  return value.replace(/\/$/, '');
}

function isTcpPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(250);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
    socket.connect(port, host);
  });
}

async function resolveLambdaOrigin() {
  const explicitOrigin = getOptionalEnv('LAMBDA_API_ORIGIN') || getOptionalEnv('VITE_APP_API_PROXY_TARGET') || getOptionalEnv('VITE_APP_API_BASE_URL');
  if (explicitOrigin) {
    return normalizeLambdaOrigin(explicitOrigin);
  }

  const candidatePorts = [
    Number(getOptionalEnv('LOCAL_API_PORT') || '0'),
    3001,
    3002,
  ].filter((port, index, ports) => Number.isInteger(port) && port > 0 && ports.indexOf(port) === index);

  for (const port of candidatePorts) {
    if (await isTcpPortOpen(port)) {
      return `http://127.0.0.1:${port}`;
    }
  }

  return 'http://127.0.0.1:3001';
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
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const baseId = requireEnv('VITE_AIRTABLE_BASE_ID');
  const tableName = requireEnv('VITE_AIRTABLE_TABLE_NAME');
  const viewId = getOptionalEnv('VITE_AIRTABLE_VIEW_ID');

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

function buildAwsDist() {
  execFileSync('npm', ['run', 'typecheck'], { cwd: awsDir, stdio: 'inherit' });
  execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd: awsDir, stdio: 'inherit' });
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

async function fetchDirectConfiguredUsersRecords() {
  const usersRef = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF');
  const usersName = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME') || 'j2Gt9USORo6Vi5';

  if (usersRef && !usersRef.includes('/')) {
    return fetchAllAirtableRecords(requireEnv('VITE_AIRTABLE_BASE_ID'), usersRef);
  }

  if (usersRef && usersRef.includes('/')) {
    return fetchDirectConfiguredRecordsFromReference(usersRef, usersName);
  }

  return fetchAllAirtableRecords(requireEnv('VITE_AIRTABLE_BASE_ID'), usersName);
}

async function fetchDirectInventoryDirectoryRecords() {
  return fetchAllAirtableRecords('appjQj8FQfFZ2ogMz', 'tblirsoRIFPDMHxb0');
}

async function fetchLambdaJotFormForms(lambdaOrigin) {
  return fetchJson(`${lambdaOrigin}/api/jotform/forms?limit=100&orderby=created_at&direction=DESC`);
}

async function fetchLambdaJotFormSubmissions(lambdaOrigin, formId) {
  return fetchJson(
    `${lambdaOrigin}/api/jotform/forms/${encodeURIComponent(formId)}/submissions?limit=100&offset=0&orderby=created_at&direction=DESC`,
  );
}

async function fetchLambdaAirtableListings(lambdaOrigin, tableName, viewId) {
  const url = new URL(`${lambdaOrigin}/api/airtable/listings`);
  url.searchParams.set('tableName', tableName);
  if (viewId) url.searchParams.set('view', viewId);
  return fetchJson(url);
}

async function fetchLambdaConfiguredRecords(lambdaOrigin, source) {
  const url = new URL(`${lambdaOrigin}/api/airtable/configured-records`);
  url.searchParams.set('source', source);
  return fetchJson(url);
}

async function fetchLambdaEbayInventoryItems(lambdaOrigin) {
  return fetchJson(`${lambdaOrigin}/api/ebay/inventory-items?limit=20`);
}

async function fetchLambdaEbayRootCategories(lambdaOrigin) {
  return fetchJson(`${lambdaOrigin}/api/ebay/taxonomy/root-categories?marketplaceId=EBAY_US`);
}

async function fetchLambdaEbayPackageTypes(lambdaOrigin) {
  return fetchJson(`${lambdaOrigin}/api/ebay/package-types?marketplaceId=EBAY_US`);
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
    if (direct[0] && !(key in direct[0])) {
      failures.push(`direct ${label} missing required key ${key}`);
    }
    if (lambda[0] && !(key in lambda[0])) {
      failures.push(`lambda ${label} missing required key ${key}`);
    }
  }

  const directSample = sampleIds(direct);
  const lambdaSample = sampleIds(lambda);
  if (JSON.stringify(directSample) !== JSON.stringify(lambdaSample)) {
    failures.push(`sample id mismatch: direct=${JSON.stringify(directSample)} lambda=${JSON.stringify(lambdaSample)}`);
  }

  return failures;
}

function comparePrimitiveArrays(label, direct, lambda) {
  const failures = [];

  if (!Array.isArray(direct) || !Array.isArray(lambda)) {
    failures.push('one side did not return an array');
    return failures;
  }

  if (direct.length !== lambda.length) {
    failures.push(`length mismatch: direct=${direct.length}, lambda=${lambda.length}`);
  }

  const directSample = direct.slice(0, 10);
  const lambdaSample = lambda.slice(0, 10);
  if (JSON.stringify(directSample) !== JSON.stringify(lambdaSample)) {
    failures.push(`sample mismatch: direct=${JSON.stringify(directSample)} lambda=${JSON.stringify(lambdaSample)}`);
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
  const lambdaOrigin = await resolveLambdaOrigin();

  setAwsEnv();
  buildAwsDist();

  console.log('Comparing direct provider responses to Lambda responses');
  console.log(`Lambda origin: ${lambdaOrigin}`);
  console.log('');

  const jotformDirectForms = await fetchDirectJotFormForms();
  const jotformLambdaForms = await fetchLambdaJotFormForms(lambdaOrigin);
  const jotformFormsFailures = compareArrays('JotForm forms', jotformDirectForms, jotformLambdaForms, ['id', 'title', 'created_at']);
  printResult('JotForm forms', jotformFormsFailures);

  const { formId, submissions: jotformDirectSubmissions } = await fetchDirectJotFormSubmissions();
  const jotformLambdaSubmissions = await fetchLambdaJotFormSubmissions(lambdaOrigin, formId);
  const jotformSubmissionsFailures = compareArrays(
    'JotForm submissions',
    jotformDirectSubmissions,
    jotformLambdaSubmissions,
    ['id', 'form_id', 'created_at', 'answers'],
  );
  printResult('JotForm submissions', jotformSubmissionsFailures);

  const { tableName, viewId, records: directAirtableRecords } = await fetchDirectAirtableListings();
  const lambdaAirtableRecords = await fetchLambdaAirtableListings(lambdaOrigin, tableName, viewId);
  const airtableFailures = compareArrays(
    'Airtable listings',
    directAirtableRecords,
    lambdaAirtableRecords,
    ['id', 'fields', 'createdTime'],
  );
  printResult('Airtable listings', airtableFailures);

  let usersFailures = [];
  if (getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF') || getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME')) {
    const directUsers = await fetchDirectConfiguredUsersRecords();
    const lambdaUsers = await fetchLambdaConfiguredRecords(lambdaOrigin, 'users');
    usersFailures = compareArrays('Airtable users', directUsers, lambdaUsers, ['id', 'fields', 'createdTime']);
    printResult('Airtable users', usersFailures);
  }

  const directInventoryRecords = await fetchDirectInventoryDirectoryRecords();
  const lambdaInventoryRecords = await fetchLambdaConfiguredRecords(lambdaOrigin, 'inventory-directory');
  const inventoryFailures = compareArrays('Inventory directory', directInventoryRecords, lambdaInventoryRecords, ['id', 'fields', 'createdTime']);
  printResult('Inventory directory', inventoryFailures);

  const approvalFailures = [];
  for (const source of ['approval-ebay', 'approval-shopify', 'approval-combined']) {
    const directApprovalRecords = await fetchDirectConfiguredApprovalRecords(source);
    if (!directApprovalRecords) continue;

    const lambdaApprovalRecords = await fetchLambdaConfiguredRecords(lambdaOrigin, source);
    const failures = compareArrays(`Airtable ${source}`, directApprovalRecords, lambdaApprovalRecords, ['id', 'fields', 'createdTime']);
    approvalFailures.push(...failures);
    printResult(`Airtable ${source}`, failures);
  }

  let ebayFailures = [];
  if (hasEbayRuntimeConfig()) {
    const ebayProvider = await import(pathToFileURL(path.join(cwd, 'aws', 'dist', 'providers', 'ebay', 'client.js')).href);

    const directInventoryPage = await ebayProvider.getInventoryItems(20);
    const lambdaInventoryPage = await fetchLambdaEbayInventoryItems(lambdaOrigin);
    const inventoryReadFailures = compareArrays(
      'eBay inventory items',
      directInventoryPage.inventoryItems,
      lambdaInventoryPage.inventoryItems,
      ['sku'],
    );
    ebayFailures.push(...inventoryReadFailures);
    printResult('eBay inventory items', inventoryReadFailures);

    const directRootCategories = await ebayProvider.getEbayRootCategories('EBAY_US');
    const lambdaRootCategories = await fetchLambdaEbayRootCategories(lambdaOrigin);
    const rootCategoryFailures = compareArrays(
      'eBay root categories',
      directRootCategories,
      lambdaRootCategories,
      ['id', 'name', 'path', 'level', 'hasChildren'],
    );
    ebayFailures.push(...rootCategoryFailures);
    printResult('eBay root categories', rootCategoryFailures);

    const directPackageTypes = await ebayProvider.getEbayPackageTypes('EBAY_US');
    const lambdaPackageTypes = await fetchLambdaEbayPackageTypes(lambdaOrigin);
    const packageTypeFailures = comparePrimitiveArrays('eBay package types', directPackageTypes, lambdaPackageTypes);
    ebayFailures.push(...packageTypeFailures);
    printResult('eBay package types', packageTypeFailures);
  } else {
    console.log('SKIP  eBay parity checks (missing VITE_EBAY_CLIENT_ID / VITE_EBAY_CLIENT_SECRET / VITE_EBAY_REFRESH_TOKEN)');
  }

  const allFailures = [
    ...jotformFormsFailures,
    ...jotformSubmissionsFailures,
    ...airtableFailures,
    ...usersFailures,
    ...inventoryFailures,
    ...approvalFailures,
    ...ebayFailures,
  ];

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