import { updateConfiguredRecord } from '../providers/airtable/sources.js';
import { logError, logInfo } from '../shared/logging.js';
import { getOptionalSecret, requireSecret } from '../shared/secrets.js';

interface CrossChannelCloseDependencies {
  updateRecord?: typeof updateConfiguredRecord;
  forceShopifyDelete?: boolean;
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
    // Treat as closed if status is ENDED or not present
    return status === 'ENDED' || status === 'NOT_ACTIVE' || status === '';
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

async function withdrawEbayOffer(offerId: string): Promise<{ success: boolean; message: string }> {
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
      throw new Error(`eBay token request failed: ${tokenResponse.status}`);
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

    if (!withdrawResponse.ok && withdrawResponse.status !== 404) {
      const errorText = await withdrawResponse.text();
      throw new Error(`eBay withdraw failed: ${withdrawResponse.status} ${errorText.slice(0, 200)}`);
    }

    return {
      success: true,
      message: 'eBay offer withdrawn',
    };
  } catch (error) {
    return {
      success: false,
      message: `eBay withdraw error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

interface CloseResult {
  success: boolean;
  message: string;
  closedAt: string;
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
      'eBay Closed At': closedAtIso,
      'eBay Close Result': missingMsg,
    }, { typecast: true }).catch((err) => {
      logError('Failed to write close result to Airtable', err);
    });

    return {
      success: false,
      message: missingMsg,
      closedAt: closedAtIso,
    };
  }

  const offerId = getFieldValue(fields, ['eBay Offer ID']);

  try {
    const result = await withdrawEbayOffer(offerId);

    if (!result.success) {
      // Write failure to Airtable
      await updateRecord('used-gear-workflow', recordId, {
        'eBay Closed At': closedAtIso,
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
      };
    }

    // Write success to Airtable
    await updateRecord('used-gear-workflow', recordId, {
      'eBay Closed At': closedAtIso,
      'eBay Close Result': 'Cross-channel auto-close: Withdrawn when sold on Shopify',
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
      'eBay Closed At': closedAtIso,
      'eBay Close Result': errorMsg,
    }, { typecast: true }).catch((err) => {
      logError('Failed to write close result to Airtable', err);
    });

    logError('Exception during eBay cross-channel close', error);

    return {
      success: false,
      message: errorMsg,
      closedAt: closedAtIso,
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
        ? 'Cross-channel auto-close: Product already deleted'
        : 'Cross-channel auto-close: Product deleted when sold on eBay',
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
