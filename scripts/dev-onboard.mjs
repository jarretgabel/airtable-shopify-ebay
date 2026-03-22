import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const cwd = process.cwd();
const envPath = path.join(cwd, '.env');
const envLocalPath = path.join(cwd, '.env.local');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  return dotenv.parse(content);
}

const fromEnv = readEnvFile(envPath);
const fromEnvLocal = readEnvFile(envLocalPath);
const merged = {
  ...fromEnv,
  ...fromEnvLocal,
};

const required = [
  'VITE_AIRTABLE_API_KEY',
  'VITE_AIRTABLE_BASE_ID',
  'VITE_AIRTABLE_TABLE_NAME',
  'VITE_SHOPIFY_STORE_DOMAIN',
];

const oneOfRequired = [
  ['VITE_SHOPIFY_OAUTH_ACCESS_TOKEN', 'VITE_SHOPIFY_ADMIN_API_TOKEN'],
];

const optional = [
  'VITE_JOTFORM_API_KEY',
  'VITE_JOTFORM_FORM_ID',
  'VITE_EBAY_REFRESH_TOKEN',
  'VITE_GITHUB_TOKEN',
  'VITE_OPENAI_API_KEY',
  'VITE_ANALYTICS_ENDPOINT',
  'VITE_ANALYTICS_ENABLED',
];

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function mask(value) {
  if (!hasValue(value)) return '';
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

let errorCount = 0;

console.log('Local setup doctor');
console.log('==================');
console.log(`Node: ${process.version}`);
console.log(`.env present: ${fs.existsSync(envPath) ? 'yes' : 'no'}`);
console.log(`.env.local present: ${fs.existsSync(envLocalPath) ? 'yes' : 'no'}`);
console.log('');

console.log('Required variables');
for (const key of required) {
  const value = merged[key] ?? process.env[key];
  if (hasValue(value)) {
    console.log(`  OK  ${key} = ${mask(value)}`);
  } else {
    console.log(`  MISSING  ${key}`);
    errorCount += 1;
  }
}

for (const pair of oneOfRequired) {
  const matched = pair.find((key) => hasValue(merged[key] ?? process.env[key]));
  if (matched) {
    const value = merged[matched] ?? process.env[matched] ?? '';
    console.log(`  OK  one-of(${pair.join(' | ')}) via ${matched} = ${mask(value)}`);
  } else {
    console.log(`  MISSING  one-of(${pair.join(' | ')})`);
    errorCount += 1;
  }
}

console.log('');
console.log('Optional variables');
for (const key of optional) {
  const value = merged[key] ?? process.env[key];
  if (hasValue(value)) {
    console.log(`  SET  ${key} = ${mask(value)}`);
  } else {
    console.log(`  unset ${key}`);
  }
}

console.log('');
if (errorCount === 0) {
  console.log('Result: setup looks good. Run npm run dev to start the app.');
  process.exit(0);
}

console.log(`Result: ${errorCount} required setting(s) missing.`);
console.log('Action: add missing values to .env.local, then run npm run onboard again.');
process.exit(1);
