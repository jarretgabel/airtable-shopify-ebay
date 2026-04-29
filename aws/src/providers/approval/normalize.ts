import type {
  ApprovalEbayBodyPreviewInput as EbayBodyPreviewInput,
  ApprovalEbayCategoryPreviewInput as EbayCategoryPreviewInput,
  ApprovalNormalizeRequest as NormalizeApprovalParams,
  ApprovalNormalizeResult,
} from '../../shared/contracts/approval.js';
import {
  buildEbayApprovalPreviewFromFields,
  type EbayApprovalPreview,
} from '../ebay/approvalPreview.js';
import {
  buildShopifyApprovalPreviewFromFields,
  type ShopifyApprovalPreview,
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
    result.shopify = await dependencies.buildShopifyApprovalPreviewFromFields(params.fields);
  }

  if (params.target === 'ebay' || params.target === 'both') {
    result.ebay = dependencies.buildEbayApprovalPreviewFromFields(params.fields, params.bodyPreview, params.categoryPreview);
  }

  return result;
}