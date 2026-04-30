import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ALLOWED_KEYS = new Set([
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
]);

const FORBIDDEN_KEY_PATTERNS = [
  /API_KEY/i,
  /ACCESS_TOKEN/i,
  /CLIENT_SECRET/i,
  /REFRESH_TOKEN/i,
  /PASSWORD/i,
  /SECRET/i,
];

const VALID_AI_PROVIDERS = new Set(['github', 'openai', 'none']);
const VALID_BOOLEAN_STRINGS = new Set(['true', 'false', '1', '0', 'on', 'off', 'yes', 'no']);

function readJson(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${filePath}: runtime config must be a JSON object.`);
  }
  return parsed;
}

function validateFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`${filePath}: file does not exist.`);
  }

  const config = readJson(resolvedPath);
  const errors = [];
  const warnings = [];

  for (const [key, value] of Object.entries(config)) {
    if (!ALLOWED_KEYS.has(key)) {
      errors.push(`${filePath}: unsupported key ${key}`);
    }

    if (FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      errors.push(`${filePath}: forbidden secret-like key ${key}`);
    }

    if (typeof value !== 'string') {
      errors.push(`${filePath}: ${key} must be a string value.`);
      continue;
    }

    if (key === 'VITE_AI_PROVIDER' && value.trim() && !VALID_AI_PROVIDERS.has(value.trim())) {
      errors.push(`${filePath}: VITE_AI_PROVIDER must be one of github, openai, none.`);
    }

    if (key === 'VITE_ANALYTICS_ENABLED' && value.trim() && !VALID_BOOLEAN_STRINGS.has(value.trim().toLowerCase())) {
      errors.push(`${filePath}: VITE_ANALYTICS_ENABLED must be a boolean-like string.`);
    }
  }

  if (!('VITE_APP_API_BASE_URL' in config)) {
    warnings.push(`${filePath}: missing VITE_APP_API_BASE_URL; empty string is recommended for same-origin /api routing.`);
  }

  return { errors, warnings };
}

function main() {
  const filePaths = process.argv.slice(2);
  const targets = filePaths.length > 0 ? filePaths : ['public/runtime-config.json'];
  const allErrors = [];
  const allWarnings = [];

  for (const target of targets) {
    const { errors, warnings } = validateFile(target);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  for (const warning of allWarnings) {
    console.warn(`[runtime-config] ${warning}`);
  }

  if (allErrors.length > 0) {
    for (const error of allErrors) {
      console.error(`[runtime-config] ${error}`);
    }
    process.exit(1);
  }

  console.log(`Validated runtime config: ${targets.join(', ')}`);
}

main();