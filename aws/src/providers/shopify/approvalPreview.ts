import type { AirtableConfiguredRecordsSource } from '../airtable/sources.js';
import { getConfiguredRecord } from '../airtable/sources.js';
import type {
  ShopifyApprovalCategoryResolution,
  ShopifyApprovalFieldResolution,
  ShopifyApprovalPreviewResult as ShopifyApprovalPreview,
} from '../../shared/contracts/shopifyApproval.js';
import {
  getCollections,
  resolveTaxonomyCategory,
} from './client.js';

export type {
  ShopifyApprovalCategoryResolution,
  ShopifyApprovalFieldResolution,
  ShopifyApprovalPreview,
};
import {
  buildShopifyCollectionIdsFromApprovalFields,
  buildShopifyDraftProductFromApprovalFields,
  buildShopifyTagValuesFromApprovalFields,
  buildShopifyUnifiedProductSetRequest,
  normalizeShopifyProductForUpsert,
  type ShopifyProduct,
} from './approvalDraft.js';
import { resolveCollectionPreview } from './approvalCollectionPreview.js';
import {
  coerceToString,
  resolveBodyHtml,
  resolveCategoryId,
  resolveDescription,
  resolveProductCategory,
  trimShopifyProductType,
  type ApprovalFieldMap,
} from './approvalPreviewFieldResolvers.js';

async function resolveTaxonomyPreview(explicitCategoryId: string, lookupValue: string): Promise<ShopifyApprovalCategoryResolution> {
  const normalizedLookup = explicitCategoryId || lookupValue;
  if (!normalizedLookup.trim()) {
    return {
      status: 'idle',
      match: null,
      error: '',
    };
  }

  try {
    const match = await resolveTaxonomyCategory(normalizedLookup);
    if (match) {
      return {
        status: 'resolved',
        match,
        error: '',
      };
    }

    return {
      status: 'unresolved',
      match: null,
      error: '',
    };
  } catch (error) {
    return {
      status: 'error',
      match: null,
      error: error instanceof Error ? error.message : 'Unable to resolve Shopify taxonomy category.',
    };
  }
}

export function buildShopifyApprovalPreviewFromFields(fields: ApprovalFieldMap): Promise<ShopifyApprovalPreview> {
  const draftProduct = buildShopifyDraftProductFromApprovalFields(fields);
  const normalizedProduct = normalizeShopifyProductForUpsert(draftProduct);
  const bodyHtmlResolution = resolveBodyHtml(fields, draftProduct);
  const productDescriptionResolution = resolveDescription(fields);
  const productCategoryResolution = resolveProductCategory(fields, draftProduct);
  const categoryIdResolution = resolveCategoryId(fields);
  const categoryLookupValue = categoryIdResolution.value || productCategoryResolution.value;
  const tagValues = buildShopifyTagValuesFromApprovalFields(fields);
  const collectionIds = buildShopifyCollectionIdsFromApprovalFields(fields);

  return Promise.all([
    resolveTaxonomyPreview(categoryIdResolution.value.trim(), categoryLookupValue.trim()),
    resolveCollectionPreview(fields, collectionIds),
  ]).then(([categoryResolution, collectionPreview]) => {
    const effectiveProduct: ShopifyProduct = {
      ...normalizedProduct,
      body_html: bodyHtmlResolution.value || normalizedProduct.body_html || '',
      product_type: trimShopifyProductType(productCategoryResolution.value)
        || trimShopifyProductType(normalizedProduct.product_type ?? ''),
    };

    const resolvedCategoryId = categoryIdResolution.value.trim() || categoryResolution.match?.id;
    const productSetRequest = buildShopifyUnifiedProductSetRequest(effectiveProduct, {
      categoryId: resolvedCategoryId || undefined,
      collectionIds: collectionPreview.collectionIds,
      existingProductId: (() => {
        const parsed = Number(coerceToString(fields['Shopify REST Product ID']));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      })(),
    });

    return {
      draftProduct,
      effectiveProduct,
      tagValues,
      collectionIds: collectionPreview.collectionIds,
      collectionLabelsById: collectionPreview.collectionLabelsById,
      bodyHtmlResolution,
      productDescriptionResolution,
      productCategoryResolution,
      categoryIdResolution,
      categoryLookupValue,
      categoryResolution,
      resolvedCategoryId: resolvedCategoryId || undefined,
      productSetRequest,
    } satisfies ShopifyApprovalPreview;
  });
}

export async function buildShopifyApprovalPreviewFromSource(params: {
  source: AirtableConfiguredRecordsSource;
  recordId: string;
  fields?: ApprovalFieldMap;
}): Promise<ShopifyApprovalPreview> {
  const record = await getConfiguredRecord(params.source, params.recordId);
  return buildShopifyApprovalPreviewFromFields({
    ...(record.fields as ApprovalFieldMap),
    ...(params.fields ?? {}),
  });
}