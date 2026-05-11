import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const BASE_ID = 'appjQj8FQfFZ2ogMz';
const TABLE_ID = 'tblirsoRIFPDMHxb0';
const DEFAULT_OLD_NAME = 'Images (Eduardo)';
const DEFAULT_NEW_NAME = 'Images';
const OUT_DIR = path.join(process.cwd(), 'tmp', 'inventory-schema');

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

function requireApiKey() {
  const apiKey = loadEnv().VITE_AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing VITE_AIRTABLE_API_KEY');
  }
  return apiKey;
}

function writeJson(fileName, value) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

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

async function fetchJson(url, apiKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(json, null, 2));
  }

  return json;
}

async function fetchTable(apiKey) {
  const payload = await fetchJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, apiKey);
  const table = payload.tables.find((entry) => entry.id === TABLE_ID);
  if (!table) {
    throw new Error('Airtable metadata table not found.');
  }
  return table;
}

async function updateFieldName(apiKey, fieldId, newName) {
  return fetchJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields/${fieldId}`, apiKey, {
    method: 'PATCH',
    body: JSON.stringify({ name: newName }),
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const oldName = (options.from ?? DEFAULT_OLD_NAME).trim();
  const newName = (options.to ?? DEFAULT_NEW_NAME).trim();
  const apply = options.apply === 'true';
  const apiKey = requireApiKey();

  if (!oldName || !newName) {
    throw new Error('Both the old and new field names are required.');
  }

  const before = await fetchTable(apiKey);
  writeJson('rename-images-field-before.json', before);

  const currentField = before.fields.find((field) => field.name === oldName);
  const existingTarget = before.fields.find((field) => field.name === newName);

  if (!currentField && existingTarget) {
    console.log(`NOOP field already named ${newName}`);
    return;
  }

  if (!currentField) {
    throw new Error(`Could not find source field ${oldName}.`);
  }

  if (existingTarget && existingTarget.id !== currentField.id) {
    throw new Error(`Target field ${newName} already exists with a different id (${existingTarget.id}).`);
  }

  console.log(`FIELD ${currentField.id} ${currentField.name} -> ${newName}`);

  if (!apply) {
    console.log('Dry-run complete. Re-run with --apply to rename the field.');
    return;
  }

  const updatedField = await updateFieldName(apiKey, currentField.id, newName);
  const after = await fetchTable(apiKey);
  writeJson('rename-images-field-after.json', after);
  writeJson('rename-images-field-result.json', {
    fieldId: updatedField.id,
    previousName: oldName,
    currentName: updatedField.name,
  });

  console.log(`RENAMED ${oldName} -> ${updatedField.name} (${updatedField.id})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});