import type {
  ApprovalNormalizeRequest as NormalizeApprovalParams,
  ApprovalNormalizeResult,
} from '../../shared/contracts/approval.js';
import {
  buildEbayApprovalPreviewFromFields,
} from '../ebay/approvalPreview.js';
import {
  buildShopifyApprovalPreviewFromFields,
} from '../shopify/approvalPreview.js';

interface NormalizeApprovalDependencies {
  buildShopifyApprovalPreviewFromFields: typeof buildShopifyApprovalPreviewFromFields;
  buildEbayApprovalPreviewFromFields: typeof buildEbayApprovalPreviewFromFields;
}

export async function normalizeApprovalFields(
  params: NormalizeApprovalParams,
  dependencies: NormalizeApprovalDependencies = {
    buildShopifyApprovalPreviewFromFields,
    buildEbayApprovalPreviewFromFields,
  },
): Promise<ApprovalNormalizeResult> {
  const result: ApprovalNormalizeResult = {
    target: params.target,
  };

  if (params.target === 'shopify' || params.target === 'both') {
    if (params.target === 'both') {
      try {
        result.shopify = await dependencies.buildShopifyApprovalPreviewFromFields(params.fields);
      } catch {
        // In combined preview mode, keep eBay preview available even when Shopify preview fails.
      }
    } else {
      result.shopify = await dependencies.buildShopifyApprovalPreviewFromFields(params.fields);
    }
  }

  if (params.target === 'ebay' || params.target === 'both') {
    if (params.target === 'both') {
      try {
        result.ebay = dependencies.buildEbayApprovalPreviewFromFields(params.fields, params.bodyPreview, params.categoryPreview);
      } catch {
        // In combined preview mode, keep Shopify preview available even when eBay preview fails.
      }
    } else {
      result.ebay = dependencies.buildEbayApprovalPreviewFromFields(params.fields, params.bodyPreview, params.categoryPreview);
    }
  }

  return result;
}