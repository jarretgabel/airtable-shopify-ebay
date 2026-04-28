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

const replacements = [
  [/AirtableApiKeySsmPath=[^ ]+|AirtableApiKey=[^ ]+/, `AirtableApiKey=${requireEnv('VITE_AIRTABLE_API_KEY')}`],
  [/ShopifyAccessTokenSsmPath=[^ ]+|ShopifyAccessToken=[^ ]+/, `ShopifyAccessToken=${shopifyToken}`],
  [/JotformApiKeySsmPath=[^ ]+|JotformApiKey=[^ ]+/, `JotformApiKey=${requireEnv('VITE_JOTFORM_API_KEY')}`],
  [/GithubTokenSsmPath=[^ ]*|GithubToken=[^ ]*/, `GithubToken=${getOptionalEnv('VITE_GITHUB_TOKEN')}`],
  [/OpenAiApiKeySsmPath=[^ ]*|OpenAiApiKey=[^ ]*/, `OpenAiApiKey=${getOptionalEnv('VITE_OPENAI_API_KEY')}`],
  [/GoogleGmailAccessTokenSsmPath=[^ ]*|GoogleGmailAccessToken=[^ ]*/, `GoogleGmailAccessToken=${getOptionalEnv('VITE_GOOGLE_GMAIL_ACCESS_TOKEN')}`],
];

const sectionPattern = new RegExp(`(\\[${deployEnv}\\.deploy\\.parameters\\][\\s\\S]*?parameter_overrides = ")([^\"]*)(")`);
const input = fs.readFileSync(samconfigPath, 'utf8');
const match = input.match(sectionPattern);

if (!match) {
  throw new Error(`Unable to locate [${deployEnv}.deploy.parameters] in aws/samconfig.toml`);
}

let parameterOverrides = match[2];
for (const [pattern, replacement] of replacements) {
  parameterOverrides = parameterOverrides.replace(pattern, replacement);
}

const output = input.replace(sectionPattern, `$1${parameterOverrides}$3`);
fs.writeFileSync(samconfigPath, output, 'utf8');

console.log(`Updated aws/samconfig.toml for ${deployEnv}.`);