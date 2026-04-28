import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const cwd = process.cwd();

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
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

function mask(value) {
  if (!value) return '';
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

const outputPath = path.join(cwd, 'aws', 'env.local.json');
const payload = {
  ShopifyGetProductsFunction: {
    SHOPIFY_STORE_DOMAIN: requireEnv('VITE_SHOPIFY_STORE_DOMAIN'),
    SHOPIFY_ACCESS_TOKEN: requireEnv(mergedEnv.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN?.trim() ? 'VITE_SHOPIFY_OAUTH_ACCESS_TOKEN' : 'VITE_SHOPIFY_ADMIN_API_TOKEN'),
  },
  JotformGetFormsFunction: {
    JOTFORM_API_KEY: requireEnv('VITE_JOTFORM_API_KEY'),
  },
  JotformGetFormSubmissionsFunction: {
    JOTFORM_API_KEY: requireEnv('VITE_JOTFORM_API_KEY'),
  },
  AirtableGetListingsFunction: {
    AIRTABLE_API_KEY: requireEnv('VITE_AIRTABLE_API_KEY'),
    AIRTABLE_BASE_ID: requireEnv('VITE_AIRTABLE_BASE_ID'),
    ALLOWED_AIRTABLE_TABLE_NAME: requireEnv('VITE_AIRTABLE_TABLE_NAME'),
    ...(getOptionalEnv('VITE_AIRTABLE_VIEW_ID') ? { ALLOWED_AIRTABLE_VIEW_ID: getOptionalEnv('VITE_AIRTABLE_VIEW_ID') } : {}),
  },
  AirtableGetConfiguredRecordsFunction: {
    AIRTABLE_API_KEY: requireEnv('VITE_AIRTABLE_API_KEY'),
    AIRTABLE_BASE_ID: requireEnv('VITE_AIRTABLE_BASE_ID'),
    ...(getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF') ? { AIRTABLE_USERS_TABLE_REF: getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF') } : {}),
    ...(getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME') ? { AIRTABLE_USERS_TABLE_NAME: getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME') } : {}),
    ...(getOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_REF') ? { AIRTABLE_APPROVAL_TABLE_REF: getOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_REF') } : {}),
    ...(getOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_NAME') ? { AIRTABLE_APPROVAL_TABLE_NAME: getOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_NAME') } : {}),
    ...(getOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF') ? { AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF: getOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF') } : {}),
    ...(getOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME') ? { AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME: getOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME') } : {}),
    ...(getOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF') ? { AIRTABLE_COMBINED_LISTINGS_TABLE_REF: getOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF') } : {}),
    ...(getOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME') ? { AIRTABLE_COMBINED_LISTINGS_TABLE_NAME: getOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME') } : {}),
  },
  AiIdentifyEquipmentFunction: {
    ...(getOptionalEnv('VITE_GITHUB_TOKEN') ? { GITHUB_TOKEN: getOptionalEnv('VITE_GITHUB_TOKEN') } : {}),
    ...(getOptionalEnv('VITE_OPENAI_API_KEY') ? { OPENAI_API_KEY: getOptionalEnv('VITE_OPENAI_API_KEY') } : {}),
  },
  GmailSendFunction: {
    ...(getOptionalEnv('VITE_GOOGLE_GMAIL_ACCESS_TOKEN') ? { GOOGLE_GMAIL_ACCESS_TOKEN: getOptionalEnv('VITE_GOOGLE_GMAIL_ACCESS_TOKEN') } : {}),
    ...(getOptionalEnv('VITE_GOOGLE_GMAIL_FROM_EMAIL') ? { GOOGLE_GMAIL_FROM_EMAIL: getOptionalEnv('VITE_GOOGLE_GMAIL_FROM_EMAIL') } : {}),
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log('Wrote aws/env.local.json');
console.log(`  SHOPIFY_STORE_DOMAIN = ${mask(payload.ShopifyGetProductsFunction.SHOPIFY_STORE_DOMAIN)}`);
console.log(`  SHOPIFY_ACCESS_TOKEN = ${mask(payload.ShopifyGetProductsFunction.SHOPIFY_ACCESS_TOKEN)}`);
console.log(`  JOTFORM_API_KEY = ${mask(payload.JotformGetFormsFunction.JOTFORM_API_KEY)}`);
console.log(`  AIRTABLE_API_KEY = ${mask(payload.AirtableGetListingsFunction.AIRTABLE_API_KEY)}`);
console.log(`  AIRTABLE_BASE_ID = ${mask(payload.AirtableGetListingsFunction.AIRTABLE_BASE_ID)}`);
console.log(`  ALLOWED_AIRTABLE_TABLE_NAME = ${mask(payload.AirtableGetListingsFunction.ALLOWED_AIRTABLE_TABLE_NAME)}`);
if (payload.AirtableGetListingsFunction.ALLOWED_AIRTABLE_VIEW_ID) {
  console.log(`  ALLOWED_AIRTABLE_VIEW_ID = ${mask(payload.AirtableGetListingsFunction.ALLOWED_AIRTABLE_VIEW_ID)}`);
}
if (payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_USERS_TABLE_REF) {
  console.log(`  AIRTABLE_USERS_TABLE_REF = ${mask(payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_USERS_TABLE_REF)}`);
}
if (payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_USERS_TABLE_NAME) {
  console.log(`  AIRTABLE_USERS_TABLE_NAME = ${mask(payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_USERS_TABLE_NAME)}`);
}
if (payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_APPROVAL_TABLE_REF) {
  console.log(`  AIRTABLE_APPROVAL_TABLE_REF = ${mask(payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_APPROVAL_TABLE_REF)}`);
}
if (payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_APPROVAL_TABLE_NAME) {
  console.log(`  AIRTABLE_APPROVAL_TABLE_NAME = ${mask(payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_APPROVAL_TABLE_NAME)}`);
}
if (payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF) {
  console.log(`  AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF = ${mask(payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF)}`);
}
if (payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME) {
  console.log(`  AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME = ${mask(payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME)}`);
}
if (payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_COMBINED_LISTINGS_TABLE_REF) {
  console.log(`  AIRTABLE_COMBINED_LISTINGS_TABLE_REF = ${mask(payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_COMBINED_LISTINGS_TABLE_REF)}`);
}
if (payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME) {
  console.log(`  AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = ${mask(payload.AirtableGetConfiguredRecordsFunction.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME)}`);
}
if (payload.AiIdentifyEquipmentFunction.GITHUB_TOKEN) {
  console.log(`  GITHUB_TOKEN = ${mask(payload.AiIdentifyEquipmentFunction.GITHUB_TOKEN)}`);
}
if (payload.AiIdentifyEquipmentFunction.OPENAI_API_KEY) {
  console.log(`  OPENAI_API_KEY = ${mask(payload.AiIdentifyEquipmentFunction.OPENAI_API_KEY)}`);
}
if (payload.GmailSendFunction.GOOGLE_GMAIL_ACCESS_TOKEN) {
  console.log(`  GOOGLE_GMAIL_ACCESS_TOKEN = ${mask(payload.GmailSendFunction.GOOGLE_GMAIL_ACCESS_TOKEN)}`);
}
if (payload.GmailSendFunction.GOOGLE_GMAIL_FROM_EMAIL) {
  console.log(`  GOOGLE_GMAIL_FROM_EMAIL = ${mask(payload.GmailSendFunction.GOOGLE_GMAIL_FROM_EMAIL)}`);
}