import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const cwd = process.cwd();
const DEFAULT_SKU_PREFIXES = ['LAMBDAEBAYPROBE'];
const DEFAULT_EXACT_SKUS = ['RAVMCINTOSHMA8900DEMO'];

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

function parseCsvEnv(name) {
  const raw = getOptionalEnv(name);
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveTargets() {
  const cliSkus = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
  if (cliSkus.length > 0) {
    return {
      exactSkus: [...new Set(cliSkus)],
      skuPrefixes: [],
    };
  }

  const exactSkus = [...new Set([...DEFAULT_EXACT_SKUS, ...parseCsvEnv('EBAY_CLEANUP_EXACT_SKUS')])];
  const skuPrefixes = [...new Set([...DEFAULT_SKU_PREFIXES, ...parseCsvEnv('EBAY_CLEANUP_SKU_PREFIXES')])];

  return { exactSkus, skuPrefixes };
}

function normalizeTargets(targets = {}) {
  const exactSkus = Array.isArray(targets.exactSkus)
    ? [...new Set(targets.exactSkus.map((value) => String(value || '').trim()).filter(Boolean))]
    : [];
  const skuPrefixes = Array.isArray(targets.skuPrefixes)
    ? [...new Set(targets.skuPrefixes.map((value) => String(value || '').trim()).filter(Boolean))]
    : [];

  return { exactSkus, skuPrefixes };
}

function matchesSku(sku, targets) {
  return targets.exactSkus.includes(sku) || targets.skuPrefixes.some((prefix) => sku.startsWith(prefix));
}

function requireCredential(name) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const clientId = requireCredential('VITE_EBAY_CLIENT_ID');
const clientSecret = requireCredential('VITE_EBAY_CLIENT_SECRET');
const refreshToken = requireCredential('VITE_EBAY_REFRESH_TOKEN');
const isProduction = getOptionalEnv('VITE_EBAY_ENV').toLowerCase() === 'production';
const apiBase = isProduction ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';

async function getUserToken() {
  const response = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Token request failed: ${JSON.stringify(body)}`);
  }

  return body.access_token;
}

async function ebayRequest(pathname, token, init = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function listMatchingArtifacts(token, targets) {
  const inventoryResponse = await ebayRequest('/sell/inventory/v1/inventory_item?limit=200', token);
  if (!inventoryResponse.ok) {
    throw new Error(`Failed to list inventory items: ${inventoryResponse.status} ${JSON.stringify(inventoryResponse.body)}`);
  }

  const inventoryItems = Array.isArray(inventoryResponse.body?.inventoryItems)
    ? inventoryResponse.body.inventoryItems
    : [];
  const matchingItems = inventoryItems.filter((item) => matchesSku(String(item?.sku || ''), targets));

  const artifacts = [];
  for (const item of matchingItems) {
    const sku = String(item.sku || '');
    const offersResponse = await ebayRequest(`/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&limit=25`, token);
    const offers = offersResponse.ok && Array.isArray(offersResponse.body?.offers)
      ? offersResponse.body.offers
      : [];
    artifacts.push({ sku, offers });
  }

  return artifacts;
}

async function withdrawOffer(token, offerId) {
  const response = await ebayRequest(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reasonForWithdrawal: 'OTHER' }),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to withdraw offer ${offerId}: ${response.status} ${JSON.stringify(response.body)}`);
  }
}

async function deleteInventoryItem(token, sku) {
  const response = await ebayRequest(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, token, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204 && response.status !== 404) {
    throw new Error(`Failed to delete inventory item ${sku}: ${response.status} ${JSON.stringify(response.body)}`);
  }
}

async function waitForSkuRemoval(token, targets, sku, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remainingArtifacts = await listMatchingArtifacts(token, targets);
    if (!remainingArtifacts.some((artifact) => artifact.sku === sku)) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

export async function cleanupEbayProbeListings(options = {}) {
  const dryRun = options.dryRun ?? getOptionalEnv('EBAY_CLEANUP_DRY_RUN').toLowerCase() === 'true';
  const targets = normalizeTargets(options.targets ?? resolveTargets());
  const token = await getUserToken();
  const before = await listMatchingArtifacts(token, targets);

  if (options.log !== false) {
    console.log('BEFORE');
    console.log(JSON.stringify(before, null, 2));
  }

  if (before.length === 0) {
    if (options.log !== false) {
      console.log('No matching eBay scratch listings found.');
    }
    return { before, after: [], dryRun, targets, removedAll: true };
  }

  if (dryRun) {
    if (options.log !== false) {
      console.log('Dry run only. No offers were withdrawn and no inventory items were deleted.');
    }
    return { before, after: before, dryRun, targets, removedAll: false };
  }

  for (const artifact of before) {
    for (const offer of artifact.offers) {
      if (offer?.offerId && offer?.status === 'PUBLISHED') {
        await withdrawOffer(token, String(offer.offerId));
        if (options.log !== false) {
          console.log(`WITHDREW ${offer.offerId} for ${artifact.sku}`);
        }
      }
    }
  }

  for (const artifact of before) {
    await deleteInventoryItem(token, artifact.sku);
    const removed = await waitForSkuRemoval(token, targets, artifact.sku);
    if (options.log !== false) {
      console.log(removed ? `DELETED ${artifact.sku}` : `DELETE_PENDING ${artifact.sku}`);
    }
  }

  const after = await listMatchingArtifacts(token, targets);
  if (options.log !== false) {
    console.log('AFTER');
    console.log(JSON.stringify(after, null, 2));
  }

  return { before, after, dryRun, targets, removedAll: after.length === 0 };
}

async function main() {
  const result = await cleanupEbayProbeListings();
  if (!result.removedAll && !result.dryRun) {
    process.exitCode = 1;
  }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}