import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { resolveLocalApiOrigin } from './local-api-origin.mjs';
import { cleanupShopifyProbeProduct } from './cleanup-shopify-probe-product.mjs';

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

function parseOptionalJsonEnv(name, fallback) {
  const raw = getOptionalEnv(name);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(error instanceof Error ? `${name}: ${error.message}` : `${name} must contain valid JSON.`);
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

function printHelp() {
  console.log('Skipping Shopify write probe. Set SHOPIFY_WRITE_PROBE_ENABLED=true and provide one or more of:');
  console.log('  SHOPIFY_WRITE_PROBE_ALLOW_CREATE=true');
  console.log('  SHOPIFY_WRITE_PROBE_CREATE_REQUEST_JSON={...}');
  console.log('  SHOPIFY_WRITE_PROBE_WITH_COLLECTIONS_REQUEST_JSON={...}');
  console.log('  SHOPIFY_WRITE_PROBE_PRODUCT_ID=123456789');
  console.log('  SHOPIFY_WRITE_PROBE_COLLECTION_IDS_JSON=["gid://shopify/Collection/..."]');
  console.log('  SHOPIFY_WRITE_PROBE_CATEGORY_ID=gid://shopify/TaxonomyCategory/...');
  console.log('  SHOPIFY_WRITE_PROBE_IMAGE_NAME=lambda-probe.jpg');
  console.log('  SHOPIFY_WRITE_PROBE_IMAGE_BASE64=...');
  console.log('Optional:');
  console.log('  SHOPIFY_WRITE_PROBE_IMAGE_MIME_TYPE=image/jpeg');
  console.log('  SHOPIFY_WRITE_PROBE_IMAGE_ALT=Lambda probe image');
  console.log('  SHOPIFY_WRITE_PROBE_AUTO_CLEANUP=true');
  console.log('Use scratch products only. Shopify write probes only auto-delete products created in the current run when SHOPIFY_WRITE_PROBE_AUTO_CLEANUP=true.');
}

function isMissingShopifyImageScopeError(message) {
  const normalized = message.toLowerCase();
  return normalized.includes('access denied for filecreate field')
    || normalized.includes('write_files access scope')
    || normalized.includes('write_images access scope')
    || normalized.includes('write_themes access scope');
}

async function main() {
  if (getOptionalEnv('SHOPIFY_WRITE_PROBE_ENABLED').toLowerCase() !== 'true') {
    printHelp();
    return;
  }

  const lambdaOrigin = await resolveLocalApiOrigin(getOptionalEnv);
  const allowCreate = getOptionalEnv('SHOPIFY_WRITE_PROBE_ALLOW_CREATE').toLowerCase() === 'true';
  const createRequest = getOptionalEnv('SHOPIFY_WRITE_PROBE_CREATE_REQUEST_JSON')
    ? parseJsonEnv('SHOPIFY_WRITE_PROBE_CREATE_REQUEST_JSON')
    : null;
  const combinedRequest = getOptionalEnv('SHOPIFY_WRITE_PROBE_WITH_COLLECTIONS_REQUEST_JSON')
    ? parseJsonEnv('SHOPIFY_WRITE_PROBE_WITH_COLLECTIONS_REQUEST_JSON')
    : null;
  const collectionIds = parseOptionalJsonEnv('SHOPIFY_WRITE_PROBE_COLLECTION_IDS_JSON', []);
  const categoryId = getOptionalEnv('SHOPIFY_WRITE_PROBE_CATEGORY_ID');
  const imageName = getOptionalEnv('SHOPIFY_WRITE_PROBE_IMAGE_NAME');
  const imageBase64 = getOptionalEnv('SHOPIFY_WRITE_PROBE_IMAGE_BASE64');
  const imageMimeType = getOptionalEnv('SHOPIFY_WRITE_PROBE_IMAGE_MIME_TYPE') || 'image/jpeg';
  const imageAlt = getOptionalEnv('SHOPIFY_WRITE_PROBE_IMAGE_ALT');
  const autoCleanup = getOptionalEnv('SHOPIFY_WRITE_PROBE_AUTO_CLEANUP').toLowerCase() === 'true';

  let productId = Number(getOptionalEnv('SHOPIFY_WRITE_PROBE_PRODUCT_ID'));
  let createdProductId = null;
  let shouldRetryStandaloneCollectionAssignment = false;

  console.log(`Running Shopify write probe against ${lambdaOrigin}`);

  if (createRequest) {
    if (!allowCreate) {
      throw new Error('SHOPIFY_WRITE_PROBE_ALLOW_CREATE=true is required before creating a Shopify product.');
    }

    const createdProduct = await fetchJson(`${lambdaOrigin}/api/shopify/product-set`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request: createRequest }),
    });

    if (!createdProduct?.id) {
      throw new Error('Create response did not include a Shopify product id.');
    }

    productId = Number(createdProduct.id);
    createdProductId = productId;
    console.log(`OK  product-set -> ${createdProduct.id}`);
    if (!autoCleanup) {
      console.log(`Manual cleanup reminder: product ${createdProduct.id} was not auto-deleted.`);
    }
  }

  if (combinedRequest) {
    const combinedResult = await fetchJson(`${lambdaOrigin}/api/shopify/product-set-with-collections`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request: combinedRequest,
        collectionIds,
      }),
    });

    if (Number.isFinite(Number(combinedResult?.product?.id))) {
      productId = Number(combinedResult.product.id);
    }

    console.log(`OK  product-set-with-collections -> ${combinedResult?.product?.id ?? '<unknown>'}`);
    if (Array.isArray(combinedResult?.collectionFailures) && combinedResult.collectionFailures.length > 0) {
      console.log(`Collection failures: ${combinedResult.collectionFailures.join(' | ')}`);
      shouldRetryStandaloneCollectionAssignment = true;
    }
  }

  if (categoryId || shouldRetryStandaloneCollectionAssignment || (!combinedRequest && collectionIds.length > 0)) {
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new Error('SHOPIFY_WRITE_PROBE_PRODUCT_ID or a successful create probe is required for category/collection updates.');
    }
  }

  if (categoryId) {
    const categoryResult = await fetchJson(`${lambdaOrigin}/api/shopify/products/${productId}/category`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ categoryId }),
    });

    if (!categoryResult?.updated) {
      throw new Error('Category update response did not confirm updated=true.');
    }

    console.log(`OK  update category -> ${productId}`);
  }

  if (shouldRetryStandaloneCollectionAssignment || (!combinedRequest && collectionIds.length > 0)) {
    const collectionResult = await fetchJson(`${lambdaOrigin}/api/shopify/products/${productId}/collections`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ collectionIds }),
    });

    if (!collectionResult?.assigned) {
      throw new Error('Collection assignment response did not confirm assigned=true.');
    }

    console.log(`OK  add collections -> ${productId}`);
  }

  if (imageName || imageBase64) {
    if (!imageName || !imageBase64) {
      throw new Error('Both SHOPIFY_WRITE_PROBE_IMAGE_NAME and SHOPIFY_WRITE_PROBE_IMAGE_BASE64 are required for image upload probing.');
    }

    let uploadedImage;
    try {
      uploadedImage = await fetchJson(`${lambdaOrigin}/api/shopify/images`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: imageName,
          mimeType: imageMimeType,
          file: imageBase64,
          alt: imageAlt || undefined,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isMissingShopifyImageScopeError(message)) {
        throw new Error(`${message}\nShopify image upload is blocked by app permissions, not the Lambda seam. Add one of write_files, write_images, or write_themes, plus create-files permission, then rerun the probe.`);
      }
      throw error;
    }

    console.log(`OK  image upload -> ${uploadedImage?.id ?? '<unknown>'}`);
  }

  if (autoCleanup && createdProductId) {
    console.log(`Starting auto-cleanup for Shopify probe product ${createdProductId}.`);
    await cleanupShopifyProbeProduct({ productId: createdProductId });
    console.log(`OK  auto-cleanup removed product ${createdProductId}`);
  } else if (autoCleanup) {
    console.log('Auto-cleanup skipped because this probe did not create a new Shopify product in the current run.');
  }

  console.log(autoCleanup
    ? 'Shopify write probe finished with auto-cleanup handling.'
    : 'Shopify write probe finished. Review any created scratch products manually.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});