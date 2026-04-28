import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const deployEnv = (process.argv[2] || 'dev').trim();
const samconfigPath = path.join(repoRoot, 'aws', 'samconfig.toml');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv = {
  ...readEnvFile(path.join(repoRoot, '.env')),
  ...readEnvFile(path.join(repoRoot, '.env.local')),
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

if (!fs.existsSync(samconfigPath)) {
  throw new Error('Missing aws/samconfig.toml. Copy aws/samconfig.toml.example first.');
}

const shopifyToken = getOptionalEnv('VITE_SHOPIFY_OAUTH_ACCESS_TOKEN') || getOptionalEnv('VITE_SHOPIFY_ADMIN_API_TOKEN');

function upsertParameterOverride(parameterOverrides, key, value) {
  const pattern = new RegExp(`${key}=[^ ]*`);
  if (pattern.test(parameterOverrides)) {
    return parameterOverrides.replace(pattern, `${key}=${value}`);
  }

  return `${parameterOverrides} ${key}=${value}`.trim();
}

const replacements = [
  ['AirtableApiKey', requireEnv('VITE_AIRTABLE_API_KEY')],
  ['ShopifyAccessToken', shopifyToken],
  ['JotformApiKey', requireEnv('VITE_JOTFORM_API_KEY')],
  ['GithubToken', getOptionalEnv('VITE_GITHUB_TOKEN')],
  ['OpenAiApiKey', getOptionalEnv('VITE_OPENAI_API_KEY')],
  ['GoogleGmailAccessToken', getOptionalEnv('VITE_GOOGLE_GMAIL_ACCESS_TOKEN')],
  ['EbayEnv', getOptionalEnv('VITE_EBAY_ENV')],
  ['EbayClientId', getOptionalEnv('VITE_EBAY_CLIENT_ID')],
  ['EbayClientSecret', getOptionalEnv('VITE_EBAY_CLIENT_SECRET')],
  ['EbayRefreshToken', getOptionalEnv('VITE_EBAY_REFRESH_TOKEN')],
  ['EbayAuthHost', getOptionalEnv('VITE_EBAY_AUTH_HOST')],
  ['EbayAppScope', getOptionalEnv('VITE_EBAY_APP_SCOPE')],
  ['EbayLocationKey', getOptionalEnv('VITE_EBAY_LOCATION_KEY')],
  ['EbayLocationCountry', getOptionalEnv('VITE_EBAY_LOCATION_COUNTRY')],
  ['EbayLocationPostalCode', getOptionalEnv('VITE_EBAY_LOCATION_POSTAL_CODE')],
  ['EbayFulfillmentPolicyId', String(getOptionalEnv('VITE_EBAY_FULFILLMENT_POLICY_ID')).split(' ')[0]],
  ['EbayPaymentPolicyId', String(getOptionalEnv('VITE_EBAY_PAYMENT_POLICY_ID')).split(' ')[0]],
  ['EbayReturnPolicyId', String(getOptionalEnv('VITE_EBAY_RETURN_POLICY_ID')).split(' ')[0]],
  ['EbayListingApi', getOptionalEnv('VITE_EBAY_LISTING_API') || 'inventory'],
];

const sectionPattern = new RegExp(`(\\[${deployEnv}\\.deploy\\.parameters\\][\\s\\S]*?parameter_overrides = ")([^\"]*)(")`);
const input = fs.readFileSync(samconfigPath, 'utf8');
const match = input.match(sectionPattern);

if (!match) {
  throw new Error(`Unable to locate [${deployEnv}.deploy.parameters] in aws/samconfig.toml`);
}

let parameterOverrides = match[2];
for (const [key, value] of replacements) {
  parameterOverrides = upsertParameterOverride(parameterOverrides, key, value);
}

const output = input.replace(sectionPattern, `$1${parameterOverrides}$3`);
fs.writeFileSync(samconfigPath, output, 'utf8');

console.log(`Updated aws/samconfig.toml for ${deployEnv}.`);