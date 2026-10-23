import { updateConfiguredRecord } from '../store/index.js';
import { logError, logInfo } from '../shared/logging.js';
import { getOptionalSecret, requireSecret } from '../shared/secrets.js';
import { retainSoldShopifyProduct, type SoldRetentionOutcome } from './soldRetention.js';

interface CrossChannelCloseDependencies {
  updateRecord?: typeof updateConfiguredRecord;
  forceShopifyDelete?: boolean;
  retainShopifyProduct?: typeof retainSoldShopifyProduct;
  productIdHint?: string;
}

function normalizeFieldValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'bigint') {
    return String(value);
  }

  return '';
}

function getFieldValue(fields: Record<string, unknown>, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    const normalized = normalizeFieldValue(fields[fieldName]);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function isAlreadyClosed(fields: Record<string, unknown>, channel: 'shopify' | 'ebay'): boolean {
  if (channel === 'ebay') {
    const status = getFieldValue(fields, ['eBay Listing Status', 'eBay Offer Status']);
    if (status === 'ENDED' || status === 'NOT_ACTIVE') {
      return true;
    }

    // A withdrawal recorded by an earlier attempt counts only if it happened after the latest publish,
    // so a relisted offer is still withdrawn when it later sells.
    const closedAt = Date.parse(getFieldValue(fields, ['eBay Closed At']));
    if (!Number.isFinite(closedAt) || !getFieldValue(fields, ['eBay Close Result']).toLowerCase().includes('withdrawn')) {
      return false;
    }
    const publishedAt = Date.parse(getFieldValue(fields, ['eBay Published At']));
    return !Number.isFinite(publishedAt) || closedAt >= publishedAt;
  }
  if (channel === 'shopify') {
    const closedAt = getFieldValue(fields, ['Shopify Closed At']);
    if (closedAt.length === 0) {
      return false;
    }

    const closeResult = getFieldValue(fields, ['Shopify Close Result']).toLowerCase();
    if (!closeResult) {
      return false;
    }

    return closeResult.includes('deleted') || closeResult.includes('already closed');
  }
  return false;
}

function hasRequiredIds(fields: Record<string, unknown>, targetChannel: 'shopify' | 'ebay'): boolean {
  if (targetChannel === 'ebay') {
    const offerId = getFieldValue(fields, ['eBay Offer ID']);
    const listingId = getFieldValue(fields, ['eBay Listing ID']);
    return offerId.length > 0 && listingId.length > 0;
  }
  if (targetChannel === 'shopify') {
    const productId = getFieldValue(fields, ['Shopify REST Product ID']);
    return productId.length > 0;
  }
  return false;
}

async function deleteShopifyProduct(productId: string): Promise<{ success: boolean; message: string }> {
  try {
    const storeDomain = requireSecret('SHOPIFY_STORE_DOMAIN');
    const accessToken = requireSecret('SHOPIFY_ACCESS_TOKEN');

    const normalizedProductId = productId.includes('gid://shopify/Product/')
      ? productId.split('/').pop()?.trim() ?? ''
      : productId.trim();

    if (!/^\d+$/.test(normalizedProductId)) {
      return {
        success: false,
        message: `Shopify delete failed: invalid product id ${productId}`,
      };
    }

    const response = await fetch(
      `https://${storeDomain}/admin/api/2024-04/products/${encodeURIComponent(normalizedProductId)}.json`,
      {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      return {
        success: false,
        message: `Shopify delete failed: ${response.status} ${errorText.slice(0, 200)}`,
      };
    }

    return {
      success: true,
      message: response.status === 404 ? 'Shopify product already deleted' : 'Shopify product deleted',
    };
  } catch (error) {
    return {
      success: false,
      message: `Shopify delete error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Network and server-side failures are worth retrying; client errors and missing configuration will not fix themselves.
function isRetryableError(error: unknown): boolean {
  const flag = (error as { retryable?: unknown } | null)?.retryable;
  if (typeof flag === 'boolean') {
    return flag;
  }
  return !/Missing required environment variable/i.test(error instanceof Error ? error.message : String(error));
}

function httpFailure(message: string, status: number): Error {
  return Object.assign(new Error(message), { retryable: status >= 500 || status === 429 });
}

async function withdrawEbayOffer(offerId: string): Promise<{ success: boolean; message: string; retryable?: boolean }> {
  try {
    const apiBase = (getOptionalSecret('EBAY_ENV') ?? '').toLowerCase() !== 'production'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    const clientId = requireSecret('EBAY_CLIENT_ID');
    const clientSecret = requireSecret('EBAY_CLIENT_SECRET');
    const rawRefreshToken = requireSecret('EBAY_REFRESH_TOKEN');
    let refreshToken = rawRefreshToken;
    try {
      refreshToken = decodeURIComponent(rawRefreshToken);
    } catch {
      refreshToken = rawRefreshToken;
    }

    // Get access token
    const tokenResponse = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
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

    if (!tokenResponse.ok) {
      throw httpFailure(`eBay token request failed: ${tokenResponse.status}`, tokenResponse.status);
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const token = tokenData.access_token;

    // Withdraw offer
    const withdrawResponse = await fetch(
      `${apiBase}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept-Language': 'en-US',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reasonForWithdrawal: 'SOLD' }),
      },
    );

    if (!withdrawResponse.ok) {
      const errorText = await withdrawResponse.text();
      throw httpFailure(`eBay withdraw failed: ${withdrawResponse.status} ${errorText.slice(0, 200)}`, withdrawResponse.status);
    }

    return {
      success: true,
      message: 'eBay offer withdrawn',
    };
  } catch (error) {
    return {
      success: false,
      message: `eBay withdraw error: ${error instanceof Error ? error.message : String(error)}`,
      retryable: isRetryableError(error),
    };
  }
}

interface CloseResult {
  success: boolean;
  message: string;
  closedAt: string;
  retryable?: boolean;
  outcome?: SoldRetentionOutcome;
}

export async function closeEbayListingWhenSoldOnShopify(
  recordId: string,
  fields: Record<string, unknown>,
  dependencies: CrossChannelCloseDependencies = {},
): Promise<CloseResult> {
  const updateRecord = dependencies.updateRecord ?? updateConfiguredRecord;
  const closedAtIso = new Date().toISOString();

  // Check if eBay is already closed
  if (isAlreadyClosed(fields, 'ebay')) {
    logInfo('eBay listing already closed (skipping cross-channel close)', {
      recordId,
      channel: 'ebay',
      reason: 'already_closed',
    });
    return {
      success: true,
      message: 'eBay listing was already closed',
      closedAt: closedAtIso,
    };
  }

  // Validate required eBay IDs exist
  if (!hasRequiredIds(fields, 'ebay')) {
    const missingMsg = 'Missing eBay Offer ID or Listing ID (cannot close eBay listing)';
    logError('Cannot close eBay listing: missing required identifiers', {
      recordId,
      channel: 'ebay',
      offerId: getFieldValue(fields, ['eBay Offer ID']),
      listingId: getFieldValue(fields, ['eBay Listing ID']),
    });

    // Write failure to Airtable for operator recovery
    await updateRecord('used-gear-workflow', recordId, {
      'eBay Close Result': missingMsg,
    }, { typecast: true }).catch((err) => {
      logError('Failed to write close result to Airtable', err);
    });

    return {
      success: false,
      message: missingMsg,
      closedAt: closedAtIso,
      retryable: false,
    };
  }

  const offerId = getFieldValue(fields, ['eBay Offer ID']);

  try {
    const result = await withdrawEbayOffer(offerId);

    if (!result.success) {
      // Write failure to Airtable
      await updateRecord('used-gear-workflow', recordId, {
        'eBay Close Result': result.message,
      }, { typecast: true }).catch((err) => {
        logError('Failed to write close result to Airtable', err);
      });

      logError('Failed to withdraw eBay offer (cross-channel close)', {
        recordId,
        offerId,
        message: result.message,
      });

      return {
        success: false,
        message: result.message,
        closedAt: closedAtIso,
        retryable: result.retryable ?? true,
      };
    }

    // Write success to Airtable
    await updateRecord('used-gear-workflow', recordId, {
      'eBay Closed At': closedAtIso,
      'eBay Close Result': 'eBay offer withdrawn',
    }, { typecast: true });

    logInfo('eBay listing closed (cross-channel auto-close from Shopify sale)', {
      recordId,
      offerId,
      message: result.message,
    });

    return {
      success: true,
      message: result.message,
      closedAt: closedAtIso,
    };
  } catch (error) {
    const errorMsg = `eBay close error: ${error instanceof Error ? error.message : String(error)}`;

    // Write error to Airtable
    await updateRecord('used-gear-workflow', recordId, {
      'eBay Close Result': errorMsg,
    }, { typecast: true }).catch((err) => {
      logError('Failed to write close result to Airtable', err);
    });

    logError('Exception during eBay cross-channel close', error);

    return {
      success: false,
      message: errorMsg,
      closedAt: closedAtIso,
      retryable: isRetryableError(error),
    };
  }
}

export async function closeShopifyProductWhenSoldOnEbay(
  recordId: string,
  fields: Record<string, unknown>,
  dependencies: CrossChannelCloseDependencies = {},
): Promise<CloseResult> {
  const updateRecord = dependencies.updateRecord ?? updateConfiguredRecord;
  const forceShopifyDelete = dependencies.forceShopifyDelete === true;
  const closedAtIso = new Date().toISOString();

  // Check if Shopify is already closed
  if (!forceShopifyDelete && isAlreadyClosed(fields, 'shopify')) {
    logInfo('Shopify product already closed (skipping cross-channel close)', {
      recordId,
      channel: 'shopify',
      reason: 'already_closed',
    });
    return {
      success: true,
      message: 'Shopify product was already closed',
      closedAt: closedAtIso,
    };
  }

  if (forceShopifyDelete) {
    logInfo('Forcing Shopify product delete attempt during takedown', {
      recordId,
      channel: 'shopify',
    });
  }

  // Validate required Shopify ID exists
  if (!hasRequiredIds(fields, 'shopify')) {
    const missingMsg = 'Missing Shopify REST Product ID (cannot close Shopify product)';
    logError('Cannot close Shopify product: missing required identifier', {
      recordId,
      channel: 'shopify',
      productId: getFieldValue(fields, ['Shopify REST Product ID']),
    });

    // Write failure to Airtable for operator recovery
    await updateRecord('used-gear-workflow', recordId, {
      'Shopify Close Result': missingMsg,
    }, { typecast: true }).catch((err) => {
      logError('Failed to write close result to Airtable', err);
    });

    return {
      success: false,
      message: missingMsg,
      closedAt: closedAtIso,
    };
  }

  const productId = getFieldValue(fields, ['Shopify REST Product ID']);

  try {
    const result = await deleteShopifyProduct(productId);

    if (!result.success) {
      // Write failure to Airtable
      await updateRecord('used-gear-workflow', recordId, {
        'Shopify Close Result': result.message,
      }, { typecast: true }).catch((err) => {
        logError('Failed to write close result to Airtable', err);
      });

      logError('Failed to delete Shopify product (cross-channel close)', {
        recordId,
        productId,
        message: result.message,
      });

      return {
        success: false,
        message: result.message,
        closedAt: closedAtIso,
      };
    }

    // Write success to Airtable
    await updateRecord('used-gear-workflow', recordId, {
      'Shopify Closed At': closedAtIso,
      'Shopify Close Result': result.message.includes('already deleted')
        ? 'Shopify product already deleted'
        : 'Shopify product deleted',
    }, { typecast: true });

    logInfo('Shopify product closed (cross-channel auto-close from eBay sale)', {
      recordId,
      productId,
      message: result.message,
    });

    return {
      success: true,
      message: result.message,
      closedAt: closedAtIso,
    };
  } catch (error) {
    const errorMsg = `Shopify close error: ${error instanceof Error ? error.message : String(error)}`;

    // Write error to Airtable
    await updateRecord('used-gear-workflow', recordId, {
      'Shopify Close Result': errorMsg,
    }, { typecast: true }).catch((err) => {
      logError('Failed to write close result to Airtable', err);
    });

    logError('Exception during Shopify cross-channel close', error);

    return {
      success: false,
      message: errorMsg,
      closedAt: closedAtIso,
    };
  }
}

function normalizeShopifyProductId(raw: string): number | null {
  const id = raw.includes('gid://shopify/Product/') ? raw.split('/').pop()?.trim() ?? '' : raw.trim();
  return /^\d+$/.test(id) ? Number(id) : null;
}

async function retainShopifyProductAfterSale(
  soldOn: 'shopify' | 'ebay',
  recordId: string,
  fields: Record<string, unknown>,
  dependencies: CrossChannelCloseDependencies,
): Promise<CloseResult> {
  const updateRecord = dependencies.updateRecord ?? updateConfiguredRecord;
  const retainProduct = dependencies.retainShopifyProduct ?? retainSoldShopifyProduct;
  const closedAtIso = new Date().toISOString();
  const recordResult = (message: string, extra: Record<string, unknown> = {}) => updateRecord('used-gear-workflow', recordId, {
    'Shopify Close Result': message,
    ...extra,
  }, { typecast: true }).catch((err) => {
    logError('Failed to write close result to Airtable', err);
  });

  // The sold order's own product is authoritative on a Shopify sale; otherwise use the record's saved product.
  const productId = normalizeShopifyProductId(dependencies.productIdHint ?? '')
    ?? normalizeShopifyProductId(getFieldValue(fields, ['Shopify REST Product ID']));
  if (productId === null) {
    const missingMsg = 'Missing Shopify REST Product ID (cannot retain Shopify product)';
    logError('Cannot retain Shopify product: missing required identifier', { recordId, soldOn });
    await recordResult(missingMsg);
    return { success: false, message: missingMsg, closedAt: closedAtIso, retryable: false };
  }

  const result = await retainProduct({ productId, soldOn });

  if (result.outcome === 'retained') {
    await recordResult(result.message, { 'Shopify Closed At': closedAtIso });
    logInfo('Shopify product retained as sold', { recordId, productId, soldOn });
  } else if (result.outcome !== 'already-retained') {
    await recordResult(result.message);
    if (result.success) {
      logInfo('Shopify product left unchanged after sale', { recordId, productId, soldOn, outcome: result.outcome, message: result.message });
    } else {
      logError('Failed to retain sold Shopify product', new Error(result.message), { recordId, productId, soldOn, retryable: result.retryable });
    }
  }

  return { success: result.success, message: result.message, closedAt: closedAtIso, retryable: result.retryable, outcome: result.outcome };
}

// eBay sale: keep the Shopify product as a sold, non-purchasable archive entry instead of deleting it.
export async function retainShopifyProductWhenSoldOnEbay(
  recordId: string,
  fields: Record<string, unknown>,
  dependencies: CrossChannelCloseDependencies = {},
): Promise<CloseResult> {
  return retainShopifyProductAfterSale('ebay', recordId, fields, dependencies);
}

// Shopify sale: Shopify already reduced stock; make sure the product is tagged and cannot be oversold.
export async function retainShopifyProductWhenSoldOnShopify(
  recordId: string,
  fields: Record<string, unknown>,
  dependencies: CrossChannelCloseDependencies = {},
): Promise<CloseResult> {
  return retainShopifyProductAfterSale('shopify', recordId, fields, dependencies);
}
