import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const DEFAULT_BASE_ID = 'apprsAm2FOohEmL2u';
const DEFAULT_LISTING_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const DEFAULT_VENDOR_TABLE_ID = 'tblF0B5TUhy20hJCv';

const LISTING_BRAND_FIELD_CANDIDATES = ['Make', 'Brand', 'brand', 'Manufacturer', 'Vendor'];
const VENDOR_NAME_FIELD_CANDIDATES = ['Vendor', 'Name', 'Brand', 'Vendor Name'];

function loadEnv() {
  let merged = { ...process.env };
  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      merged = { ...dotenv.parse(fs.readFileSync(filePath, 'utf8')), ...merged };
    }
  }
  return merged;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = nextValue;
    index += 1;
  }
  return options;
}

function getApiKey(env) {
  const apiKey = env.VITE_AIRTABLE_API_KEY ?? env.AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing VITE_AIRTABLE_API_KEY (or AIRTABLE_API_KEY) in .env/.env.local.');
  }
  return apiKey;
}

function normalizeBrand(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function extractStringValues(rawValue) {
  if (typeof rawValue === 'string') {
    const value = rawValue.trim();
    return value ? [value] : [];
  }

  if (Array.isArray(rawValue)) {
    return rawValue
      .flatMap((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }
        if (entry && typeof entry === 'object' && typeof entry.name === 'string') {
          return entry.name.trim();
        }
        return '';
      })
      .filter(Boolean);
  }

  if (rawValue && typeof rawValue === 'object' && typeof rawValue.name === 'string') {
    const value = rawValue.name.trim();
    return value ? [value] : [];
  }

  return [];
}

async function fetchJson(url, apiKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message ?? JSON.stringify(payload);
    throw new Error(`Airtable request failed (${response.status}): ${message}`);
  }
  return payload;
}

async function fetchTableMetadata(baseId, apiKey) {
  const payload = await fetchJson(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, apiKey);
  return payload.tables ?? [];
}

async function fetchAllRecords(baseId, tableId, apiKey, fieldNames = []) {
  const records = [];
  let offset = '';

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    if (offset) {
      url.searchParams.set('offset', offset);
    }
    for (const fieldName of fieldNames) {
      url.searchParams.append('fields[]', fieldName);
    }

    const payload = await fetchJson(url.toString(), apiKey);
    records.push(...(payload.records ?? []));
    offset = payload.offset ?? '';
  } while (offset);

  return records;
}

async function createRecords(baseId, tableId, apiKey, recordFields) {
  for (let index = 0; index < recordFields.length; index += 10) {
    const batch = recordFields.slice(index, index + 10).map((fields) => ({ fields }));
    await fetchJson(`https://api.airtable.com/v0/${baseId}/${tableId}`, apiKey, {
      method: 'POST',
      body: JSON.stringify({ records: batch, typecast: true }),
    });
  }
}

function pickFieldName(tableMetadata, explicitFieldName, candidates, roleLabel) {
  if (explicitFieldName) {
    const hasField = tableMetadata.fields.some((field) => field.name === explicitFieldName);
    if (!hasField) {
      throw new Error(`${roleLabel} field \"${explicitFieldName}\" was not found in table \"${tableMetadata.name}\".`);
    }
    return explicitFieldName;
  }

  for (const candidate of candidates) {
    const match = tableMetadata.fields.find((field) => field.name === candidate);
    if (match) {
      return match.name;
    }
  }

  if (tableMetadata.primaryFieldId) {
    const primaryField = tableMetadata.fields.find((field) => field.id === tableMetadata.primaryFieldId);
    if (primaryField?.name) {
      return primaryField.name;
    }
  }

  throw new Error(
    `Unable to resolve ${roleLabel} field for table \"${tableMetadata.name}\". Pass it explicitly with --${roleLabel === 'listing brand' ? 'listing-brand-field' : 'vendor-name-field'}.`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const apiKey = getApiKey(env);

  const baseId = options['base-id'] ?? env.VITE_AIRTABLE_BASE_ID ?? DEFAULT_BASE_ID;
  const listingTableId = options['listing-table-id'] ?? DEFAULT_LISTING_TABLE_ID;
  const vendorTableId = options['vendor-table-id'] ?? DEFAULT_VENDOR_TABLE_ID;
  const listingBrandFieldFromCli = options['listing-brand-field'];
  const vendorNameFieldFromCli = options['vendor-name-field'];
  const apply = options.apply === 'true';

  const tables = await fetchTableMetadata(baseId, apiKey);
  const listingTable = tables.find((table) => table.id === listingTableId);
  const vendorTable = tables.find((table) => table.id === vendorTableId);

  if (!listingTable) {
    throw new Error(`Listing table not found: ${listingTableId}`);
  }
  if (!vendorTable) {
    throw new Error(`Vendor table not found: ${vendorTableId}`);
  }

  const listingBrandField = pickFieldName(
    listingTable,
    listingBrandFieldFromCli,
    LISTING_BRAND_FIELD_CANDIDATES,
    'listing brand',
  );
  const vendorNameField = pickFieldName(
    vendorTable,
    vendorNameFieldFromCli,
    VENDOR_NAME_FIELD_CANDIDATES,
    'vendor name',
  );

  const listingRecords = await fetchAllRecords(baseId, listingTableId, apiKey, [listingBrandField]);
  const vendorRecords = await fetchAllRecords(baseId, vendorTableId, apiKey, [vendorNameField]);

  const allListingBrands = new Map();
  for (const record of listingRecords) {
    const rawValue = record.fields?.[listingBrandField];
    const brandValues = extractStringValues(rawValue);
    for (const brandValue of brandValues) {
      const normalized = normalizeBrand(brandValue);
      if (!normalized) {
        continue;
      }
      if (!allListingBrands.has(normalized)) {
        allListingBrands.set(normalized, brandValue);
      }
    }
  }

  const existingVendors = new Set();
  for (const record of vendorRecords) {
    const rawValue = record.fields?.[vendorNameField];
    const vendorNames = extractStringValues(rawValue);
    for (const vendorName of vendorNames) {
      const normalized = normalizeBrand(vendorName);
      if (normalized) {
        existingVendors.add(normalized);
      }
    }
  }

  const missingBrands = [];
  for (const [normalized, canonicalBrand] of allListingBrands.entries()) {
    if (!existingVendors.has(normalized)) {
      missingBrands.push(canonicalBrand);
    }
  }

  console.log(`Base: ${baseId}`);
  console.log(`Listing table: ${listingTable.name} (${listingTableId})`);
  console.log(`Vendor table: ${vendorTable.name} (${vendorTableId})`);
  console.log(`Listing brand field: ${listingBrandField}`);
  console.log(`Vendor name field: ${vendorNameField}`);
  console.log(`Listing records scanned: ${listingRecords.length}`);
  console.log(`Unique brands found in listing table: ${allListingBrands.size}`);
  console.log(`Existing vendor rows scanned: ${vendorRecords.length}`);
  console.log(`Missing vendors to create: ${missingBrands.length}`);

  if (missingBrands.length > 0) {
    console.log('Preview of vendors to create:');
    for (const brand of missingBrands.slice(0, 30)) {
      console.log(`- ${brand}`);
    }
    if (missingBrands.length > 30) {
      console.log(`...and ${missingBrands.length - 30} more`);
    }
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to insert missing vendors.');
    return;
  }

  if (missingBrands.length === 0) {
    console.log('\nNo changes needed. Vendor table already includes all listing brands.');
    return;
  }

  const newRows = missingBrands.map((brand) => ({ [vendorNameField]: brand }));
  await createRecords(baseId, vendorTableId, apiKey, newRows);
  console.log(`\nCreated ${missingBrands.length} vendor record(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
