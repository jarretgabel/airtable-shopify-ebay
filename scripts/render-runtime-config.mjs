import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const configuredRuntimeConfigPath = process.env.RUNTIME_CONFIG_PATH?.trim();
const publicConfigPath = configuredRuntimeConfigPath
  ? path.resolve(workspaceRoot, configuredRuntimeConfigPath)
  : path.join(workspaceRoot, 'public', 'runtime-config.json');
const distConfigPath = path.join(workspaceRoot, 'dist', 'runtime-config.json');

const PUBLIC_RUNTIME_CONFIG_KEYS = [
  'VITE_AIRTABLE_TABLE_NAME',
  'VITE_AIRTABLE_VIEW_ID',
  'VITE_AI_PROVIDER',
  'VITE_AIRTABLE_USERS_TABLE_REF',
  'VITE_AIRTABLE_USERS_TABLE_NAME',
  'VITE_AIRTABLE_APPROVAL_TABLE_REF',
  'VITE_AIRTABLE_APPROVAL_TABLE_NAME',
  'VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF',
  'VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME',
  'VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF',
  'VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME',
  'VITE_APP_API_BASE_URL',
  'VITE_SHOPIFY_STORE_DOMAIN',
  'VITE_JOTFORM_FORM_ID',
  'VITE_EBAY_AUTH_HOST',
  'VITE_EBAY_OAUTH_SCOPES',
  'VITE_EBAY_APP_SCOPE',
  'VITE_ANALYTICS_ENABLED',
];

async function readBaseConfig() {
  try {
    const raw = await readFile(publicConfigPath, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function main() {
  const baseConfig = await readBaseConfig();
  const renderedConfig = { ...baseConfig };

  for (const key of PUBLIC_RUNTIME_CONFIG_KEYS) {
    if (process.env[key] !== undefined) {
      renderedConfig[key] = process.env[key];
    }
  }

  await mkdir(path.dirname(distConfigPath), { recursive: true });
  await writeFile(distConfigPath, `${JSON.stringify(renderedConfig, null, 2)}\n`, 'utf8');
  console.log(`Using runtime config source ${publicConfigPath}`);
  console.log(`Wrote runtime config to ${distConfigPath}`);
}

await main();