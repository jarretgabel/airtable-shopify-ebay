import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { APP_PAGES } from '../src/auth/pages.ts';
import {
  ROLE_GUIDES,
  WORKFLOW_ADVANCEMENT_RULES,
  WORKFLOW_FLOW_STAGES,
  getRoleStartPoints,
  getVisiblePageCards,
  getVisibleRecordCards,
  roleSummary,
} from '../src/components/tabs/workflowGuideContent.ts';

const BASE_ID = 'apprsAm2FOohEmL2u';
const TABLE_ID = 'tblquB9pdwSRXsI7c';
const OUT_DIR = path.join(process.cwd(), 'tmp', 'user-guide-table');
const APPLY_CONFIRM_TOKEN = 'SEED_USER_GUIDE_TABLE';
const CLEANUP_CONFIRM_TOKEN = 'CLEAN_USER_GUIDE_TABLE_DEFAULTS';
const STARTER_FIELD_NAMES = ['Notes', 'Assignee', 'Status', 'Attachments', 'Attachment Summary'];

const ROLE_OPTIONS = [
  { name: 'admin', color: 'redLight1' },
  { name: 'owner', color: 'orangeLight1' },
  { name: 'processor', color: 'yellowLight2' },
  { name: 'tester', color: 'blueLight2' },
  { name: 'photographer', color: 'cyanLight2' },
  { name: 'developer', color: 'greenLight2' },
];

const PAGE_OPTIONS = APP_PAGES.map((page) => ({ name: page, color: 'grayLight2' }));
const CONTENT_TYPE_OPTIONS = [
  { name: 'role-guide', color: 'blueLight2' },
  { name: 'workflow-rule', color: 'yellowLight2' },
  { name: 'workflow-stage', color: 'orangeLight1' },
  { name: 'page-guide', color: 'greenLight2' },
  { name: 'record-guide', color: 'cyanLight2' },
  { name: 'role-start-point', color: 'pinkLight2' },
];
const TONE_OPTIONS = [
  { name: 'intake', color: 'cyanLight2' },
  { name: 'decision', color: 'redLight1' },
  { name: 'routing', color: 'yellowLight2' },
  { name: 'specialist', color: 'blueLight2' },
  { name: 'publish', color: 'purpleLight2' },
  { name: 'follow-through', color: 'greenLight2' },
];

type AirtableFieldDefinition = {
  name: string;
  type: string;
  options?: Record<string, unknown>;
};

type SeedRow = {
  name: string;
  contentKey: string;
  contentType: string;
  sortOrder: number;
  fields: Record<string, unknown>;
};

const FIELD_DEFINITIONS: AirtableFieldDefinition[] = [
  { name: 'Content Key', type: 'singleLineText' },
  { name: 'Content Type', type: 'singleSelect', options: { choices: CONTENT_TYPE_OPTIONS } },
  { name: 'Sort Order', type: 'number', options: { precision: 0 } },
  { name: 'Role', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Tone', type: 'singleSelect', options: { choices: TONE_OPTIONS } },
  { name: 'Role Summary', type: 'multilineText' },
  { name: 'Summary', type: 'multilineText' },
  { name: 'Detail', type: 'multilineText' },
  { name: 'Page 1', type: 'singleSelect', options: { choices: PAGE_OPTIONS } },
  { name: 'Page 2', type: 'singleSelect', options: { choices: PAGE_OPTIONS } },
  { name: 'Page 3', type: 'singleSelect', options: { choices: PAGE_OPTIONS } },
  { name: 'Primary Role 1', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Primary Role 2', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Primary Role 3', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Primary Role 4', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Support Role 1', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Support Role 2', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Support Role 3', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Support Role 4', type: 'singleSelect', options: { choices: ROLE_OPTIONS } },
  { name: 'Quick Start Title', type: 'singleLineText' },
  { name: 'Quick Start Summary', type: 'multilineText' },
  { name: 'Quick Start Item 1', type: 'multilineText' },
  { name: 'Quick Start Item 2', type: 'multilineText' },
  { name: 'Quick Start Item 3', type: 'multilineText' },
  { name: 'Flow Summary', type: 'multilineText' },
  { name: 'Flow Step 1 Title', type: 'singleLineText' },
  { name: 'Flow Step 1 Detail', type: 'multilineText' },
  { name: 'Flow Step 2 Title', type: 'singleLineText' },
  { name: 'Flow Step 2 Detail', type: 'multilineText' },
  { name: 'Flow Step 3 Title', type: 'singleLineText' },
  { name: 'Flow Step 3 Detail', type: 'multilineText' },
  { name: 'Flow Step 4 Title', type: 'singleLineText' },
  { name: 'Flow Step 4 Detail', type: 'multilineText' },
  { name: 'Question 1', type: 'multilineText' },
  { name: 'Answer 1', type: 'multilineText' },
  { name: 'Question 2', type: 'multilineText' },
  { name: 'Answer 2', type: 'multilineText' },
  { name: 'Module 1', type: 'multilineText' },
  { name: 'Module 2', type: 'multilineText' },
  { name: 'Module 3', type: 'multilineText' },
  { name: 'Module 4', type: 'multilineText' },
  { name: 'Workflow Use 1', type: 'multilineText' },
  { name: 'Workflow Use 2', type: 'multilineText' },
  { name: 'Workflow Use 3', type: 'multilineText' },
  { name: 'Surface 1', type: 'multilineText' },
  { name: 'Surface 2', type: 'multilineText' },
  { name: 'Surface 3', type: 'multilineText' },
  { name: 'Last Seeded At', type: 'dateTime', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' }, timeFormat: { name: '24hour', format: 'HH:mm' }, timeZone: 'utc' } },
];

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

function requireApiKey(): string {
  const apiKey = loadEnv().VITE_AIRTABLE_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    throw new Error('Missing VITE_AIRTABLE_API_KEY');
  }
  return apiKey;
}

function parseArgs(argv: string[]) {
  const options: Record<string, string> = {};
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

function writeJson(fileName: string, value: unknown) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function fetchJson(url: string, apiKey: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const json = await response.json();
  if (response.ok === false) {
    throw new Error(JSON.stringify(json, null, 2));
  }
  return json;
}

async function fetchTable(apiKey: string) {
  const payload = await fetchJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, apiKey);
  const table = payload.tables.find((entry: { id: string }) => entry.id === TABLE_ID);
  if (!table) {
    throw new Error(`Airtable metadata table not found for ${TABLE_ID}.`);
  }
  return table;
}

async function createField(apiKey: string, definition: AirtableFieldDefinition) {
  return fetchJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`, apiKey, {
    method: 'POST',
    body: JSON.stringify(definition),
  });
}

async function deleteField(apiKey: string, fieldId: string) {
  return fetchJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields/${fieldId}`, apiKey, {
    method: 'DELETE',
  });
}

async function fetchAllRecords(apiKey: string) {
  const records: Array<{ id: string; fields: Record<string, unknown>; createdTime: string }> = [];
  let offset = '';

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    if (offset) {
      url.searchParams.set('offset', offset);
    }
    const payload = await fetchJson(url.toString(), apiKey);
    records.push(...(payload.records ?? []));
    offset = payload.offset ?? '';
  } while (offset);

  return records;
}

async function createRecords(apiKey: string, records: Array<{ fields: Record<string, unknown> }>) {
  return fetchJson(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, apiKey, {
    method: 'POST',
    body: JSON.stringify({ records, typecast: true }),
  });
}

async function updateRecords(apiKey: string, records: Array<{ id: string; fields: Record<string, unknown> }>) {
  return fetchJson(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, apiKey, {
    method: 'PATCH',
    body: JSON.stringify({ records, typecast: true }),
  });
}

async function deleteRecords(apiKey: string, recordIds: string[]) {
  for (const batch of chunkArray(recordIds, 10)) {
    const params = new URLSearchParams();
    batch.forEach((recordId) => params.append('records[]', recordId));
    await fetchJson(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params.toString()}`, apiKey, {
      method: 'DELETE',
    });
  }
}

function chunkArray<T>(items: T[], size: number): T[] {
  const chunks: T[] = [] as T[];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size) as T);
  }
  return chunks;
}

function compactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return true;
    }),
  );
}

function fieldList(prefix: string, values: Array<string | undefined>, count: number) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `${prefix} ${index + 1}`,
      values[index] ?? null,
    ]),
  );
}

function buildSeedRows(nowIso: string): SeedRow[] {
  const rows: SeedRow[] = [];
  let sortOrder = 10;
  const pageCards = getVisiblePageCards([...APP_PAGES]);
  const recordCards = getVisibleRecordCards([...APP_PAGES]);
  const roleOrder = Object.keys(ROLE_GUIDES);

  roleOrder.forEach((role) => {
    const guide = ROLE_GUIDES[role as keyof typeof ROLE_GUIDES];
    rows.push({
      name: `${guide.quickStartTitle}`,
      contentKey: `role-guide.${role}`,
      contentType: 'role-guide',
      sortOrder,
      fields: compactFields({
        'Content Key': `role-guide.${role}`,
        'Content Type': 'role-guide',
        'Sort Order': sortOrder,
        Role: role,
        'Role Summary': roleSummary(role as keyof typeof ROLE_GUIDES),
        'Quick Start Title': guide.quickStartTitle,
        'Quick Start Summary': guide.quickStartSummary,
        'Quick Start Item 1': guide.quickStartItems[0] ?? null,
        'Quick Start Item 2': guide.quickStartItems[1] ?? null,
        'Quick Start Item 3': guide.quickStartItems[2] ?? null,
        'Flow Summary': guide.flowSummary,
        'Flow Step 1 Title': guide.flowSteps[0]?.title ?? null,
        'Flow Step 1 Detail': guide.flowSteps[0]?.detail ?? null,
        'Flow Step 2 Title': guide.flowSteps[1]?.title ?? null,
        'Flow Step 2 Detail': guide.flowSteps[1]?.detail ?? null,
        'Flow Step 3 Title': guide.flowSteps[2]?.title ?? null,
        'Flow Step 3 Detail': guide.flowSteps[2]?.detail ?? null,
        'Flow Step 4 Title': guide.flowSteps[3]?.title ?? null,
        'Flow Step 4 Detail': guide.flowSteps[3]?.detail ?? null,
        'Question 1': guide.questions[0]?.question ?? null,
        'Answer 1': guide.questions[0]?.answer ?? null,
        'Question 2': guide.questions[1]?.question ?? null,
        'Answer 2': guide.questions[1]?.answer ?? null,
        'Last Seeded At': nowIso,
      }),
    });
    sortOrder += 10;
  });

  WORKFLOW_ADVANCEMENT_RULES.forEach((rule, index) => {
    rows.push({
      name: `Rule ${String(index + 1).padStart(2, '0')} - ${rule.title}`,
      contentKey: `workflow-rule.${String(index + 1).padStart(2, '0')}`,
      contentType: 'workflow-rule',
      sortOrder,
      fields: compactFields({
        'Content Key': `workflow-rule.${String(index + 1).padStart(2, '0')}`,
        'Content Type': 'workflow-rule',
        'Sort Order': sortOrder,
        Summary: rule.title,
        Detail: rule.detail,
        'Last Seeded At': nowIso,
      }),
    });
    sortOrder += 10;
  });

  WORKFLOW_FLOW_STAGES.forEach((stage, index) => {
    rows.push({
      name: `Stage - ${stage.title}`,
      contentKey: `workflow-stage.${String(index + 1).padStart(2, '0')}`,
      contentType: 'workflow-stage',
      sortOrder,
      fields: compactFields({
        'Content Key': `workflow-stage.${String(index + 1).padStart(2, '0')}`,
        'Content Type': 'workflow-stage',
        'Sort Order': sortOrder,
        Summary: stage.title,
        Detail: stage.detail,
        Tone: stage.tone,
        ...fieldList('Page', stage.pages, 3),
        ...fieldList('Primary Role', stage.primaryRoles, 4),
        ...fieldList('Support Role', stage.supportRoles ?? [], 4),
        'Last Seeded At': nowIso,
      }),
    });
    sortOrder += 10;
  });

  pageCards.forEach((card, index) => {
    rows.push({
      name: `Page - ${card.title}`,
      contentKey: `page-guide.${String(index + 1).padStart(2, '0')}`,
      contentType: 'page-guide',
      sortOrder,
      fields: compactFields({
        'Content Key': `page-guide.${String(index + 1).padStart(2, '0')}`,
        'Content Type': 'page-guide',
        'Sort Order': sortOrder,
        Summary: card.summary,
        ...fieldList('Page', card.pages, 3),
        'Module 1': card.modules[0] ?? null,
        'Module 2': card.modules[1] ?? null,
        'Module 3': card.modules[2] ?? null,
        'Module 4': card.modules[3] ?? null,
        'Workflow Use 1': card.workflows[0] ?? null,
        'Workflow Use 2': card.workflows[1] ?? null,
        'Workflow Use 3': card.workflows[2] ?? null,
        'Last Seeded At': nowIso,
      }),
    });
    sortOrder += 10;
  });

  recordCards.forEach((card, index) => {
    rows.push({
      name: `Record - ${card.title}`,
      contentKey: `record-guide.${String(index + 1).padStart(2, '0')}`,
      contentType: 'record-guide',
      sortOrder,
      fields: compactFields({
        'Content Key': `record-guide.${String(index + 1).padStart(2, '0')}`,
        'Content Type': 'record-guide',
        'Sort Order': sortOrder,
        Summary: card.summary,
        ...fieldList('Page', card.pages, 3),
        'Surface 1': card.surfaces[0] ?? null,
        'Surface 2': card.surfaces[1] ?? null,
        'Surface 3': card.surfaces[2] ?? null,
        'Workflow Use 1': card.workflows[0] ?? null,
        'Workflow Use 2': card.workflows[1] ?? null,
        'Workflow Use 3': card.workflows[2] ?? null,
        'Last Seeded At': nowIso,
      }),
    });
    sortOrder += 10;
  });

  roleOrder.forEach((role) => {
    const startPoints = getRoleStartPoints(role as keyof typeof ROLE_GUIDES, [...APP_PAGES]);
    startPoints.forEach((item, index) => {
      rows.push({
        name: `Start - ${role} - ${item.title}`,
        contentKey: `role-start-point.${role}.${String(index + 1).padStart(2, '0')}`,
        contentType: 'role-start-point',
        sortOrder,
        fields: compactFields({
          'Content Key': `role-start-point.${role}.${String(index + 1).padStart(2, '0')}`,
          'Content Type': 'role-start-point',
          'Sort Order': sortOrder,
          Role: role,
          Summary: item.title,
          Detail: item.detail,
          'Page 1': item.page,
          'Last Seeded At': nowIso,
        }),
      });
      sortOrder += 10;
    });
  });

  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apply = options.apply === 'true';
  const confirm = options.confirm ?? '';
  const cleanupDefaults = options['cleanup-defaults'] === 'true';
  const nowIso = new Date().toISOString();
  const rows = buildSeedRows(nowIso);

  const apiKey = requireApiKey();
  const before = await fetchTable(apiKey);
  writeJson('prechange-table-metadata.json', before);
  const existingRecords = await fetchAllRecords(apiKey);

  if (cleanupDefaults) {
    if (apply && confirm !== CLEANUP_CONFIRM_TOKEN) {
      throw new Error(`Cleanup mode requires --confirm ${CLEANUP_CONFIRM_TOKEN}`);
    }

    const starterFields = (before.fields ?? [])
      .filter((field: { id: string; name: string; type: string }) => STARTER_FIELD_NAMES.includes(field.name))
      .map((field: { id: string; name: string; type: string }) => ({ id: field.id, name: field.name, type: field.type }));
    const starterRows = existingRecords
      .filter((record) => typeof record.fields['Content Key'] !== 'string' || record.fields['Content Key'].trim() === '')
      .map((record) => ({ id: record.id, name: typeof record.fields.Name === 'string' ? record.fields.Name : '' }));

    writeJson('cleanup-preview.json', {
      apply,
      confirmRequired: CLEANUP_CONFIRM_TOKEN,
      starterFieldCount: starterFields.length,
      starterFieldNames: starterFields.map((field) => field.name),
      starterRowCount: starterRows.length,
      starterRows,
    });

    if (!apply) {
      console.log(`DRY_RUN cleanupFieldDeletes=${starterFields.length} cleanupRowDeletes=${starterRows.length}`);
      console.log(`Re-run with --cleanup-defaults --apply --confirm ${CLEANUP_CONFIRM_TOKEN} to remove Airtable starter fields and rows.`);
      return;
    }

    if (starterRows.length > 0) {
      await deleteRecords(apiKey, starterRows.map((row) => row.id));
    }

    const skippedFields: string[] = [];
    for (const field of starterFields) {
      try {
        await deleteField(apiKey, field.id);
        console.log(`DELETED_FIELD ${field.name}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('NOT_FOUND')) {
          skippedFields.push(field.name);
          console.log(`SKIPPED_FIELD ${field.name} (Airtable field deletion is not available through this API path)`);
          continue;
        }
        throw error;
      }
    }

    const afterCleanup = await fetchTable(apiKey);
    writeJson('postcleanup-table-metadata.json', afterCleanup);
    writeJson('cleanup-summary.json', {
      deletedFieldCount: starterFields.length - skippedFields.length,
      deletedFieldNames: starterFields.filter((field) => !skippedFields.includes(field.name)).map((field) => field.name),
      skippedFieldCount: skippedFields.length,
      skippedFieldNames: skippedFields,
      deletedRowCount: starterRows.length,
      deletedRowIds: starterRows.map((row) => row.id),
    });

    console.log(`DELETED_FIELD_COUNT ${starterFields.length - skippedFields.length}`);
    console.log(`SKIPPED_FIELD_COUNT ${skippedFields.length}`);
    console.log(`DELETED_ROW_COUNT ${starterRows.length}`);
    return;
  }

  if (apply && confirm !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply mode requires --confirm ${APPLY_CONFIRM_TOKEN}`);
  }

  const existingFieldNames = new Set((before.fields ?? []).map((field: { name: string }) => field.name));
  const missingFields = FIELD_DEFINITIONS.filter((field) => !existingFieldNames.has(field.name));
  const existingByKey = new Map(
    existingRecords.flatMap((record) => {
      const contentKey = typeof record.fields['Content Key'] === 'string' ? record.fields['Content Key'] : '';
      return contentKey ? [[contentKey, { id: record.id }]] : [];
    }),
  );

  const createPayload = rows
    .filter((row) => !existingByKey.has(row.contentKey))
    .map((row) => ({ fields: { Name: row.name, ...row.fields } }));

  const updatePayload = rows
    .filter((row) => existingByKey.has(row.contentKey))
    .map((row) => ({ id: existingByKey.get(row.contentKey)!.id, fields: { Name: row.name, ...row.fields } }));

  writeJson('seed-preview.json', {
    apply,
    confirmRequired: APPLY_CONFIRM_TOKEN,
    tableId: TABLE_ID,
    missingFieldCount: missingFields.length,
    missingFieldNames: missingFields.map((field) => field.name),
    existingRecordCount: existingRecords.length,
    seedRowCount: rows.length,
    createCount: createPayload.length,
    updateCount: updatePayload.length,
    sampleRows: rows.slice(0, 5).map((row) => ({
      name: row.name,
      contentKey: row.contentKey,
      contentType: row.contentType,
      sortOrder: row.sortOrder,
    })),
  });

  if (!apply) {
    console.log(`DRY_RUN fieldCreates=${missingFields.length} recordCreates=${createPayload.length} recordUpdates=${updatePayload.length}`);
    console.log(`Re-run with --apply --confirm ${APPLY_CONFIRM_TOKEN} to create fields and seed records.`);
    return;
  }

  const createdFields: Array<{ id: string; name: string; type: string }> = [];
  for (const definition of missingFields) {
    const created = await createField(apiKey, definition);
    createdFields.push({ id: created.id, name: created.name, type: created.type });
    console.log(`CREATED_FIELD ${created.name}`);
  }

  const createdRecords: Array<{ id: string; name: string }> = [];
  for (const batch of chunkArray(createPayload, 10)) {
    const payload = await createRecords(apiKey, batch);
    createdRecords.push(...(payload.records ?? []).map((record: { id: string; fields: Record<string, unknown> }) => ({
      id: record.id,
      name: typeof record.fields.Name === 'string' ? record.fields.Name : record.id,
    })));
  }

  const updatedRecords: Array<{ id: string; name: string }> = [];
  for (const batch of chunkArray(updatePayload, 10)) {
    const payload = await updateRecords(apiKey, batch);
    updatedRecords.push(...(payload.records ?? []).map((record: { id: string; fields: Record<string, unknown> }) => ({
      id: record.id,
      name: typeof record.fields.Name === 'string' ? record.fields.Name : record.id,
    })));
  }

  const after = await fetchTable(apiKey);
  writeJson('postchange-table-metadata.json', after);
  writeJson('created-fields.json', createdFields);
  writeJson('created-records.json', createdRecords);
  writeJson('updated-records.json', updatedRecords);
  writeJson('summary.json', {
    tableId: TABLE_ID,
    createdFieldCount: createdFields.length,
    createdFieldNames: createdFields.map((field) => field.name),
    createdRecordCount: createdRecords.length,
    updatedRecordCount: updatedRecords.length,
    totalSeedRows: rows.length,
    seededAt: nowIso,
  });

  console.log(`CREATED_FIELD_COUNT ${createdFields.length}`);
  console.log(`CREATED_RECORD_COUNT ${createdRecords.length}`);
  console.log(`UPDATED_RECORD_COUNT ${updatedRecords.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});