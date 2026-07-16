import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

// Load local env first, then fallback to .env.
dotenv.config({ path: '.env.local' });
dotenv.config();

const AIRTABLE_API_KEY =
  process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;

function printUsageAndExit(message) {
  if (message) {
    console.error(`\nError: ${message}\n`);
  }

  console.log(`Usage:
  node scripts/download-airtable-images.mjs --url <airtableUrl> [--field images] [--out downloads/airtable-images]

Options:
  --url     Airtable table/view URL (required), for example:
            https://airtable.com/appXXXXXXXXXXXXXX/tblXXXXXXXXXXXXXX/viwXXXXXXXXXXXXXX
  --field   Attachment field/column name to read. Default: images
  --folder-field  Field/column name for folder naming when --per-record-folders is used. Default: sku
  --out     Output directory. Default: downloads/airtable-images
  --limit   Optional max number of records to scan (for testing)
  --per-record-folders  Save images into per-record subfolders

Environment:
  AIRTABLE_API_KEY or VITE_AIRTABLE_API_KEY must be set in .env.local or shell.
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const args = {
    field: 'images',
    folderField: 'sku',
    out: 'downloads/airtable-images',
    limit: null,
    perRecordFolders: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--url') {
      args.url = next;
      i += 1;
      continue;
    }

    if (token === '--field') {
      args.field = next;
      i += 1;
      continue;
    }

    if (token === '--folder-field') {
      args.folderField = next;
      i += 1;
      continue;
    }

    if (token === '--out') {
      args.out = next;
      i += 1;
      continue;
    }

    if (token === '--limit') {
      const parsed = Number.parseInt(next ?? '', 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        printUsageAndExit('--limit must be a positive integer');
      }
      args.limit = parsed;
      i += 1;
      continue;
    }

    if (token === '--per-record-folders') {
      args.perRecordFolders = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      printUsageAndExit();
    }
  }

  if (!args.url) {
    printUsageAndExit('--url is required');
  }

  return args;
}

function parseAirtableUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid Airtable URL');
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const baseId = segments.find((part) => part.startsWith('app'));
  const tableId = segments.find((part) => part.startsWith('tbl'));
  const viewId = segments.find((part) => part.startsWith('viw'));

  if (!baseId || !tableId) {
    throw new Error('Airtable URL must include both base (app...) and table (tbl...) IDs');
  }

  return { baseId, tableId, viewId };
}

function sanitizeFileName(name) {
  const safe = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return safe || 'image';
}

function fileNameFromAttachment(attachment, fallbackBaseName) {
  const candidate = attachment.filename || path.basename(new URL(attachment.url).pathname);
  const base = sanitizeFileName(candidate || fallbackBaseName);

  if (base.includes('.')) {
    return base;
  }

  const contentType = attachment.type || '';
  const extFromType = contentType.startsWith('image/')
    ? `.${contentType.split('/')[1].replace(/[^a-zA-Z0-9]/g, '')}`
    : '';

  return `${base}${extFromType || '.jpg'}`;
}

async function downloadFile(url, destinationPath) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 5,
  });

  await fs.writeFile(destinationPath, response.data);
}

function isAirtable422(error) {
  return error?.response?.status === 422;
}

function getErrorDetails(error) {
  const apiError = error?.response?.data?.error;
  if (apiError?.type || apiError?.message) {
    return `${apiError.type || 'UNKNOWN'}: ${apiError.message || 'No message'}`;
  }
  return error.message;
}

function resolveAttachmentFieldName(records, requestedField) {
  if (!records.length) {
    return requestedField;
  }

  const available = new Set();
  for (const record of records) {
    const fields = Object.keys(record.fields || {});
    for (const name of fields) {
      available.add(name);
    }
  }

  const names = Array.from(available);
  const exact = names.find((name) => name === requestedField);
  if (exact) {
    return exact;
  }

  const lower = requestedField.toLowerCase();
  const caseInsensitive = names.find((name) => name.toLowerCase() === lower);
  if (caseInsensitive) {
    return caseInsensitive;
  }

  const attachmentLike = names.find((name) => {
    return records.some((record) => {
      const value = record.fields?.[name];
      return (
        Array.isArray(value) &&
        value.some((item) => item && typeof item === 'object' && typeof item.url === 'string')
      );
    });
  });

  return attachmentLike || requestedField;
}

function resolveFieldKeyInRecord(recordFields, requestedField) {
  if (!recordFields || typeof recordFields !== 'object') {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(recordFields, requestedField)) {
    return requestedField;
  }

  const lower = requestedField.toLowerCase();
  const key = Object.keys(recordFields).find((name) => name.toLowerCase() === lower);
  return key || null;
}

function cellValueToFolderText(value) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(cellValueToFolderText).filter(Boolean).join('-');
  }

  if (typeof value === 'object') {
    if (typeof value.name === 'string' && value.name.trim()) {
      return value.name;
    }

    if (typeof value.text === 'string' && value.text.trim()) {
      return value.text;
    }

    if (typeof value.value === 'string' && value.value.trim()) {
      return value.value;
    }

    if (typeof value.id === 'string' && value.id.trim()) {
      return value.id;
    }
  }

  return '';
}

function folderNameFromRecord(record, folderField) {
  const key = resolveFieldKeyInRecord(record.fields, folderField);
  const raw = key ? record.fields?.[key] : undefined;

  const value = cellValueToFolderText(raw);

  const safe = sanitizeFileName(value);
  if (safe && safe !== 'image') {
    return safe;
  }

  return sanitizeFileName(record.id);
}

async function fetchAllRecords({ baseId, tableId, viewId, field, limit, useFieldFilter }) {
  const client = axios.create({
    baseURL: `https://api.airtable.com/v0/${baseId}`,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    },
    timeout: 60000,
  });

  const records = [];
  let offset;

  while (true) {
    const params = {
      pageSize: 100,
    };

    if (useFieldFilter) {
      params.fields = [field];
    }

    if (viewId) {
      params.view = viewId;
    }

    if (offset) {
      params.offset = offset;
    }

    const { data } = await client.get(`/${tableId}`, { params });
    records.push(...(data.records || []));

    if (limit && records.length >= limit) {
      return records.slice(0, limit);
    }

    if (!data.offset) {
      return records;
    }

    offset = data.offset;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!AIRTABLE_API_KEY) {
    throw new Error('Missing AIRTABLE_API_KEY (or VITE_AIRTABLE_API_KEY) in environment');
  }

  const { baseId, tableId, viewId } = parseAirtableUrl(args.url);
  const outputDir = path.resolve(args.out);

  await fs.mkdir(outputDir, { recursive: true });

  console.log(`Using base: ${baseId}`);
  console.log(`Using table: ${tableId}`);
  if (viewId) {
    console.log(`Using view: ${viewId}`);
  }
  console.log(`Field: ${args.field}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Per-record folders: ${args.perRecordFolders ? 'yes' : 'no'}`);
  if (args.perRecordFolders) {
    console.log(`Folder field: ${args.folderField}`);
  }
  console.log('Fetching Airtable records...');

  let records;
  let resolvedFieldName = args.field;

  try {
    records = await fetchAllRecords({
      baseId,
      tableId,
      viewId,
      field: args.field,
      limit: args.limit,
      useFieldFilter: true,
    });
  } catch (error) {
    if (!isAirtable422(error)) {
      throw error;
    }

    console.warn(
      `Field filter request failed (${getErrorDetails(error)}). Retrying without field filter...`,
    );

    records = await fetchAllRecords({
      baseId,
      tableId,
      viewId,
      field: args.field,
      limit: args.limit,
      useFieldFilter: false,
    });

    resolvedFieldName = resolveAttachmentFieldName(records, args.field);
    if (resolvedFieldName !== args.field) {
      console.warn(`Using detected attachment field: ${resolvedFieldName}`);
    }
  }

  console.log(`Found ${records.length} record(s).`);

  let scannedAttachments = 0;
  let downloaded = 0;
  const failures = [];

  for (const record of records) {
    const value = record.fields?.[resolvedFieldName];
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }

    for (let index = 0; index < value.length; index += 1) {
      const attachment = value[index];
      if (!attachment?.url) {
        continue;
      }

      scannedAttachments += 1;

      const fileName = fileNameFromAttachment(
        attachment,
        `${record.id}-${resolvedFieldName}-${index + 1}`,
      );

      const recordDir = args.perRecordFolders
        ? path.join(outputDir, folderNameFromRecord(record, args.folderField))
        : outputDir;
      const outputName = args.perRecordFolders
        ? `${String(index + 1).padStart(2, '0')}-${fileName}`
        : `${record.id}-${String(index + 1).padStart(2, '0')}-${fileName}`;
      await fs.mkdir(recordDir, { recursive: true });
      const targetPath = path.join(recordDir, outputName);

      try {
        await downloadFile(attachment.url, targetPath);
        downloaded += 1;
        console.log(`Downloaded: ${outputName}`);
      } catch (error) {
        failures.push({
          recordId: record.id,
          url: attachment.url,
          reason: error.message,
        });
        console.error(`Failed: ${outputName} (${error.message})`);
      }
    }
  }

  console.log('\nDone.');
  console.log(`Attachments found: ${scannedAttachments}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Failed: ${failures.length}`);

  if (failures.length > 0) {
    const failureLogPath = path.join(outputDir, 'download-failures.json');
    await fs.writeFile(failureLogPath, JSON.stringify(failures, null, 2));
    console.log(`Failure details saved to: ${failureLogPath}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const details = getErrorDetails(error);
  console.error(`Fatal error: ${details}`);
  process.exit(1);
});
