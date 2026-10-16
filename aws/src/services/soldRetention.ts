import { logInfo } from '../shared/logging.js';
import { hasSoldArchiveTag, SHOPIFY_SOLD_ARCHIVE_TAG } from '../shared/contracts/shopifySoldArchive.js';
import {
  addProductTags,
  denyVariantOversell,
  getProductSaleState,
  syncProductVariantInventoryLevels,
  type ShopifyProductSaleState,
} from '../providers/shopify/client.js';

export type SoldRetentionOutcome = 'retained' | 'already-retained' | 'needs-review' | 'skipped-no-product' | 'failed';

export interface SoldRetentionResult {
  success: boolean;
  retryable: boolean;
  outcome: SoldRetentionOutcome;
  message: string;
}

export interface SoldRetentionDependencies {
  getProductSaleState: typeof getProductSaleState;
  syncProductVariantInventoryLevels: typeof syncProductVariantInventoryLevels;
  addProductTags: typeof addProductTags;
  denyVariantOversell: typeof denyVariantOversell;
}

const defaultDependencies: SoldRetentionDependencies = {
  getProductSaleState,
  syncProductVariantInventoryLevels,
  addProductTags,
  denyVariantOversell,
};

function isFullyRetained(state: ShopifyProductSaleState): boolean {
  return hasSoldArchiveTag(state.tags)
    && state.totalInventory === 0
    && state.variants.every((variant) => variant.inventoryPolicy === 'DENY');
}

function needsReview(message: string): SoldRetentionResult {
  return { success: true, retryable: false, outcome: 'needs-review', message };
}

function failed(message: string, retryable: boolean): SoldRetentionResult {
  return { success: false, retryable, outcome: 'failed', message };
}

/**
 * Keeps a sold single-unit product in Shopify as a non-purchasable archive entry: stock 0, overselling denied and
 * tagged `sold-archive` (existing tags kept). The product is never deleted or restocked. Multi-unit, untracked or
 * partially visible products are left unchanged and flagged for manual review. Every write is idempotent and verified
 * by reading the product back, so a retry after a partial failure completes the remaining steps.
 */
export async function retainSoldShopifyProduct(
  input: { productId: number; soldOn: 'shopify' | 'ebay' },
  dependencies: SoldRetentionDependencies = defaultDependencies,
): Promise<SoldRetentionResult> {
  const { productId, soldOn } = input;
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return failed(`Invalid Shopify product id ${String(productId)}`, false);
  }

  try {
    const before = await dependencies.getProductSaleState(productId);
    if (!before) {
      return { success: true, retryable: false, outcome: 'skipped-no-product', message: 'Shopify product was not found; nothing to retain' };
    }
    if (before.variantsTruncated || before.variants.length === 0) {
      return needsReview('Shopify product variants could not be fully inspected; left unchanged for manual review');
    }
    if (before.totalInventory === null || before.variants.some((variant) => variant.tracked === false)) {
      return needsReview('Shopify inventory is not tracked for this product, so stock cannot be set to zero; left unchanged for manual review');
    }
    if (isFullyRetained(before)) {
      return { success: true, retryable: false, outcome: 'already-retained', message: 'Shopify product was already retained as sold' };
    }

    const stock = before.totalInventory;
    if (soldOn === 'shopify' && stock > 0) {
      return needsReview(`${stock} still in stock after the Shopify sale; not tagged ${SHOPIFY_SOLD_ARCHIVE_TAG}`);
    }
    if (soldOn === 'ebay' && stock > 1) {
      return needsReview(`Multi-unit product (${stock} in stock) left unchanged; review manually`);
    }

    if (stock > 0) {
      await dependencies.syncProductVariantInventoryLevels(productId, before.variants.map((variant) => ({
        sku: variant.sku ?? undefined,
        position: variant.position ?? undefined,
        quantity: 0,
      })));
    }

    const oversellable = before.variants.filter((variant) => variant.inventoryPolicy !== 'DENY');
    if (oversellable.length > 0) {
      await dependencies.denyVariantOversell(productId, oversellable.map((variant) => variant.id));
    }

    if (!hasSoldArchiveTag(before.tags)) {
      await dependencies.addProductTags(productId, [SHOPIFY_SOLD_ARCHIVE_TAG]);
    }

    const after = await dependencies.getProductSaleState(productId);
    if (!after || !isFullyRetained(after)) {
      return failed('Shopify sold-retention was written but could not be verified (stock 0, overselling denied and tag present); re-check the product', true);
    }

    logInfo('Retained sold Shopify product', { productId, soldOn });
    return { success: true, retryable: false, outcome: 'retained', message: `Shopify product retained (stock 0, tagged ${SHOPIFY_SOLD_ARCHIVE_TAG})` };
  } catch (error) {
    const flag = (error as { retryable?: unknown } | null)?.retryable;
    const message = error instanceof Error ? error.message : String(error);
    // Missing credentials will not fix themselves; endless retries could get the webhook subscription removed.
    const retryable = typeof flag === 'boolean' ? flag : !/Missing required environment variable/i.test(message);
    return failed(`Shopify sold-retention error: ${message}`, retryable);
  }
}
