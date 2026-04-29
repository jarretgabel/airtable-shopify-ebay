export type {
  ApprovalFieldMap,
  ShopifyMetafield,
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyProductOption,
  ShopifyProductVariant,
} from './approvalDraftTypes.js';

export { buildShopifyCollectionIdsFromApprovalFields } from './approvalDraftCollections.js';
export { buildShopifyBodyHtml, getHandleField, resolveShopifyBodyHtml } from './approvalDraftBody.js';
export { buildImages } from './approvalDraftImages.js';
export { buildShopifyDraftProductFromApprovalFields } from './approvalDraftProduct.js';
export { buildShopifyTagValuesFromApprovalFields, parseShopifyTagList, serializeShopifyTagsCsv } from './approvalDraftTags.js';
export { buildShopifyUnifiedProductSetRequest, normalizeShopifyProductForUpsert } from './approvalDraftUnified.js';
