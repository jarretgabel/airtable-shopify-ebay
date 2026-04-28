import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { requireReadyLocalApiOrigin } from './local-api-origin.mjs';
import { cleanupEbayProbeListings } from './cleanup-ebay-probe-listings.mjs';

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

function parseJsonEnv(name) {
  const raw = requireEnv(name);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(error instanceof Error ? `${name}: ${error.message}` : `${name} must contain valid JSON.`);
  }
}

function normalizeCurrencyValue(value) {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function ensureApprovalProbePricing(approvalBundle) {
  const offer = approvalBundle?.offer;
  if (!offer || typeof offer !== 'object') return null;

  const pricingSummary = offer.pricingSummary && typeof offer.pricingSummary === 'object'
    ? offer.pricingSummary
    : (offer.pricingSummary = {});
  const price = pricingSummary.price && typeof pricingSummary.price === 'object'
    ? pricingSummary.price
    : (pricingSummary.price = {});

  const currentValue = normalizeCurrencyValue(price.value);
  if (currentValue !== null && currentValue >= 4999) {
    if (!price.currency) price.currency = 'USD';
    return null;
  }

  price.value = '4999.00';
  price.currency = price.currency || 'USD';
  return currentValue;
}

function ensureApprovalProbeAspects(approvalBundle) {
  const inventoryItem = approvalBundle?.inventoryItem;
  if (!inventoryItem || typeof inventoryItem !== 'object') return;

  const product = inventoryItem.product && typeof inventoryItem.product === 'object'
    ? inventoryItem.product
    : (inventoryItem.product = {});
  const aspects = product.aspects && typeof product.aspects === 'object' && !Array.isArray(product.aspects)
    ? product.aspects
    : (product.aspects = {});

  const brand = typeof product.brand === 'string' && product.brand.trim()
    ? product.brand.trim()
    : 'Resolution AV';
  const mpn = typeof product.mpn === 'string' && product.mpn.trim()
    ? product.mpn.trim()
    : String(inventoryItem.sku || 'LAMBDAEBAYPROBE');

  if (!Array.isArray(aspects.Brand) || aspects.Brand.length === 0) {
    aspects.Brand = [brand];
  }

  if (!Array.isArray(aspects.Connectivity) || aspects.Connectivity.length === 0) {
    aspects.Connectivity = ['Wired'];
  }

  if (!Array.isArray(aspects.Model) || aspects.Model.length === 0) {
    aspects.Model = [mpn];
  }

  if (!Array.isArray(aspects.MPN) || aspects.MPN.length === 0) {
    aspects.MPN = [mpn];
  }

  if (!Array.isArray(aspects.Type) || aspects.Type.length === 0) {
    aspects.Type = ['Integrated Amplifier'];
  }

  if (!Array.isArray(aspects['Country/Region of Manufacture']) || aspects['Country/Region of Manufacture'].length === 0) {
    aspects['Country/Region of Manufacture'] = ['United States'];
  }

  if (!Array.isArray(aspects['Power Output']) || aspects['Power Output'].length === 0) {
    aspects['Power Output'] = ['200W per channel'];
  }

  if (!Array.isArray(aspects.Impedance) || aspects.Impedance.length === 0) {
    aspects.Impedance = ['8 ohms'];
  }

  if (!Array.isArray(aspects.Color) || aspects.Color.length === 0) {
    aspects.Color = ['Black/Silver'];
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Request failed for ${url}: ${message}`);
  }

  return body;
}

async function uploadProbeImage(lambdaOrigin, imageName, imageBase64, imageMimeType) {
  if (!imageName || !imageBase64) {
    throw new Error('Both EBAY_WRITE_PROBE_IMAGE_NAME and EBAY_WRITE_PROBE_IMAGE_BASE64 are required for image upload probing.');
  }

  const uploadedImage = await fetchJson(`${lambdaOrigin}/api/ebay/images`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: imageName,
      mimeType: imageMimeType,
      file: imageBase64,
    }),
  });

  if (!uploadedImage?.url) {
    throw new Error('Image upload response did not include a hosted picture URL.');
  }

  return uploadedImage;
}

function printHelp() {
  console.log('Skipping eBay write probe. Set EBAY_WRITE_PROBE_ENABLED=true and provide one or more of:');
  console.log('  EBAY_WRITE_PROBE_PUBLISH_SETUP_JSON={"locationConfig":{...},"policyConfig":{...}}');
  console.log('  EBAY_WRITE_PROBE_SAMPLE_MODE=inventory|trading|trading-verify');
  console.log('  EBAY_WRITE_PROBE_APPROVAL_BUNDLE_JSON={"inventoryItem":{...},"offer":{...}}');
  console.log('  EBAY_WRITE_PROBE_IMAGE_NAME=lambda-probe.jpg');
  console.log('  EBAY_WRITE_PROBE_IMAGE_BASE64=/9j/4AAQSkZJRgABAQ...');
  console.log('Optional:');
  console.log('  EBAY_WRITE_PROBE_IMAGE_MIME_TYPE=image/jpeg');
  console.log('  EBAY_WRITE_PROBE_AUTO_CLEANUP=true');
  console.log('Use scratch SKUs and image assets only. Clean up created scratch listings with `npm run cleanup:ebay:probe`.');
}

async function main() {
  if (getOptionalEnv('EBAY_WRITE_PROBE_ENABLED').toLowerCase() !== 'true') {
    printHelp();
    return;
  }

  const lambdaOrigin = await requireReadyLocalApiOrigin(getOptionalEnv, { purpose: 'eBay Lambda write probe' });
  const publishSetup = parseJsonEnv('EBAY_WRITE_PROBE_PUBLISH_SETUP_JSON');
  const sampleMode = (getOptionalEnv('EBAY_WRITE_PROBE_SAMPLE_MODE') || 'inventory').trim();
  const approvalBundle = getOptionalEnv('EBAY_WRITE_PROBE_APPROVAL_BUNDLE_JSON')
    ? parseJsonEnv('EBAY_WRITE_PROBE_APPROVAL_BUNDLE_JSON')
    : null;
  const imageName = getOptionalEnv('EBAY_WRITE_PROBE_IMAGE_NAME');
  const imageBase64 = getOptionalEnv('EBAY_WRITE_PROBE_IMAGE_BASE64');
  const imageMimeType = getOptionalEnv('EBAY_WRITE_PROBE_IMAGE_MIME_TYPE') || 'image/jpeg';
  const autoCleanup = getOptionalEnv('EBAY_WRITE_PROBE_AUTO_CLEANUP').toLowerCase() === 'true';
  const cleanupSkus = new Set();
  let uploadedImage = null;

  console.log(`Running eBay write probe against ${lambdaOrigin}`);

  const sampleResult = await fetchJson(`${lambdaOrigin}/api/ebay/sample-listings`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: sampleMode,
      publishSetup,
    }),
  });

  if (!sampleResult?.sku) {
    throw new Error('Sample listing response did not include a sku.');
  }

  console.log(`OK  sample listing -> ${sampleResult.sku} (${sampleResult.status})`);
  cleanupSkus.add(String(sampleResult.sku));

  const publishResult = await fetchJson(`${lambdaOrigin}/api/ebay/sample-listings/publish`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publishSetup }),
  });

  if (!publishResult?.listingId) {
    throw new Error('Publish response did not include a listingId.');
  }

  console.log(`OK  publish sample draft -> ${publishResult.listingId}`);

  if (approvalBundle) {
    ensureApprovalProbeAspects(approvalBundle);
    const previousPrice = ensureApprovalProbePricing(approvalBundle);
    if (previousPrice !== null && previousPrice < 4999) {
      console.log(`INFO approval probe price adjusted from ${previousPrice.toFixed(2)} to 4999.00 to avoid shipping-policy rejections from the active business policy`);
    }

    const approvalInventoryItem = approvalBundle.inventoryItem;
    const approvalProduct = approvalInventoryItem && typeof approvalInventoryItem === 'object'
      ? approvalInventoryItem.product
      : null;
    const approvalImageUrls = approvalProduct && typeof approvalProduct === 'object'
      ? approvalProduct.imageUrls
      : null;

    if ((!Array.isArray(approvalImageUrls) || approvalImageUrls.length === 0) && imageName && imageBase64) {
      uploadedImage ||= await uploadProbeImage(lambdaOrigin, imageName, imageBase64, imageMimeType);
      if (approvalProduct && typeof approvalProduct === 'object') {
        approvalProduct.imageUrls = [uploadedImage.url];
      }
    }

    const approvalResult = await fetchJson(`${lambdaOrigin}/api/ebay/approval-listings/publish`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bundle: approvalBundle,
        publishSetup,
      }),
    });

    if (!approvalResult?.listingId) {
      throw new Error('Approval publish response did not include a listingId.');
    }

    console.log(`OK  approval publish -> ${approvalResult.listingId}`);

    const approvalSku = approvalBundle?.inventoryItem?.sku;
    if (approvalSku) {
      cleanupSkus.add(String(approvalSku));
    }
  }

  if (imageName || imageBase64) {
    uploadedImage ||= await uploadProbeImage(lambdaOrigin, imageName, imageBase64, imageMimeType);

    console.log(`OK  image upload -> ${uploadedImage.url}`);
  }

  if (autoCleanup) {
    console.log('Starting auto-cleanup for probe-created scratch listings.');
    const cleanupResult = await cleanupEbayProbeListings({
      targets: {
        exactSkus: [...cleanupSkus],
        skuPrefixes: [],
      },
    });

    if (!cleanupResult.removedAll) {
      throw new Error(`Auto-cleanup did not remove all probe-created SKUs: ${cleanupResult.after.map((artifact) => artifact.sku).join(', ')}`);
    }

    console.log(`OK  auto-cleanup removed ${cleanupResult.before.length} scratch listing(s)`);
  }

  console.log(autoCleanup
    ? 'eBay write probe finished with auto-cleanup.'
    : 'eBay write probe finished. Clean up created scratch listings with `npm run cleanup:ebay:probe`.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});