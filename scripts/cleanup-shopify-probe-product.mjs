import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
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

function getOptionalEnv(name) {
  const value = mergedEnv[name]?.trim();
  return value || '';
}

function requireEnv(name) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeStoreDomain(rawDomain) {
  const trimmed = rawDomain.trim();
  if (!trimmed) {
    throw new Error('VITE_SHOPIFY_STORE_DOMAIN is required.');
  }

  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function resolveProductId(productIdInput) {
  const productId = Number(productIdInput);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Provide a numeric Shopify product id as the first argument or SHOPIFY_CLEANUP_PRODUCT_ID.');
  }

  return productId;
}

export async function cleanupShopifyProbeProduct(options = {}) {
  const productIdRaw = options.productId ?? process.argv[2] ?? getOptionalEnv('SHOPIFY_CLEANUP_PRODUCT_ID');
  const productId = resolveProductId(productIdRaw);

  const storeDomain = normalizeStoreDomain(requireEnv('VITE_SHOPIFY_STORE_DOMAIN'));
  const accessToken = getOptionalEnv('VITE_SHOPIFY_OAUTH_ACCESS_TOKEN') || getOptionalEnv('VITE_SHOPIFY_ADMIN_API_TOKEN');

  if (!accessToken) {
    throw new Error('Missing Shopify admin access token in VITE_SHOPIFY_OAUTH_ACCESS_TOKEN or VITE_SHOPIFY_ADMIN_API_TOKEN.');
  }

  const response = await fetch(`https://${storeDomain}/admin/api/2024-04/products/${productId}.json`, {
    method: 'DELETE',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete Shopify product ${productId}: ${response.status} ${text}`);
  }

  if (options.log !== false) {
    console.log(`Deleted Shopify scratch product ${productId}.`);
  }

  return { productId };
}

async function main() {
  await cleanupShopifyProbeProduct();
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}