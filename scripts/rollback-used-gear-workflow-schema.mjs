import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const DEFAULT_PLAN_PATH = path.join(
  process.cwd(),
  'tmp',
  'used-gear-workflow-schema',
  'rollback-delete-approved-workflow-fields.json',
);
const DEFAULT_CONFIRM_TOKEN = 'DELETE_APPROVED_WORKFLOW_FIELDS';

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

function printHelp() {
  console.log('Used Gear Workflow schema rollback helper');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/rollback-used-gear-workflow-schema.mjs [--plan path]');
  console.log('  node scripts/rollback-used-gear-workflow-schema.mjs --plan path --apply --confirm DELETE_APPROVED_WORKFLOW_FIELDS');
  console.log('');
  console.log('Behavior:');
  console.log('  - Dry-run by default. No Airtable fields are deleted unless --apply is passed.');
  console.log('  - Reads rollbackOrder from the generated rollback JSON artifact.');
  console.log(`  - Defaults to ${DEFAULT_PLAN_PATH}`);
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/rollback-used-gear-workflow-schema.mjs');
  console.log('  node scripts/rollback-used-gear-workflow-schema.mjs --plan tmp/used-gear-workflow-schema/rollback-delete-created-fields.json');
  console.log('  node scripts/rollback-used-gear-workflow-schema.mjs --apply --confirm DELETE_APPROVED_WORKFLOW_FIELDS');
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

function readRollbackPlan(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Rollback plan not found: ${resolvedPath}`);
  }

  const plan = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('Rollback plan must be a JSON object.');
  }

  if (!plan.baseId || !plan.tableId) {
    throw new Error('Rollback plan must include baseId and tableId.');
  }

  if (!Array.isArray(plan.rollbackOrder)) {
    throw new Error('Rollback plan must include rollbackOrder.');
  }

  return {
    resolvedPath,
    plan,
  };
}

async function deleteField({ apiKey, baseId, tableId, fieldId }) {
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const json = await response.json();
  if (response.ok === false) {
    throw new Error(JSON.stringify(json, null, 2));
  }

  return json;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help === 'true') {
    printHelp();
    return;
  }

  const planPath = options.plan ?? DEFAULT_PLAN_PATH;
  const { resolvedPath, plan } = readRollbackPlan(planPath);
  const rollbackOrder = plan.rollbackOrder;

  console.log(`ROLLBACK_PLAN ${resolvedPath}`);
  console.log(`MODE ${options.apply === 'true' ? 'apply' : 'dry-run'}`);
  console.log(`FIELD_COUNT ${rollbackOrder.length}`);

  if (rollbackOrder.length === 0) {
    console.log('No fields listed in rollbackOrder. Nothing to do.');
    return;
  }

  for (const field of rollbackOrder) {
    console.log(`FIELD ${field.id} ${field.name} ${field.type}`);
  }

  if (options.apply !== 'true') {
    console.log(`Dry-run complete. Re-run with --apply --confirm ${DEFAULT_CONFIRM_TOKEN} to execute deletions.`);
    return;
  }

  if (options.confirm !== DEFAULT_CONFIRM_TOKEN) {
    throw new Error(`Applying deletions requires --confirm ${DEFAULT_CONFIRM_TOKEN}`);
  }

  const apiKey = requireApiKey();
  for (const field of rollbackOrder) {
    await deleteField({
      apiKey,
      baseId: plan.baseId,
      tableId: plan.tableId,
      fieldId: field.id,
    });
    console.log(`DELETED ${field.name} (${field.id})`);
  }

  console.log(`DELETED_COUNT ${rollbackOrder.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});