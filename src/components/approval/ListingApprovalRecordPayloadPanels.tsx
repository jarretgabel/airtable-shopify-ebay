import {
  SHOPIFY_PRODUCT_SET_MUTATION,
  SHOPIFY_SEARCH_TAXONOMY_CATEGORIES_QUERY,
  SHOPIFY_UNIFIED_PRODUCT_SET_DOCS_EXAMPLE,
} from '@/components/approval/listingApprovalShopifyConstants';
import { EBAY_DRAFT_PAYLOAD_DOCS_EXAMPLE } from '@/components/approval/listingApprovalEbayConstants';
import type { ShopifyUnifiedProductSetRequest } from '@/services/shopify';

interface ShopifyFieldResolutionSummary {
  sourceFieldName: string;
  sourceType: string;
}

interface ShopifyCategoryIdResolutionSummary {
  sourceFieldName: string;
  value: string;
}

interface ShopifyCategoryResolutionSummary {
  error?: string;
  match?: {
    fullName?: string;
    id?: string;
  } | null;
  status: string;
}

export interface ShopifyPayloadDebug {
  collectionsToJoin: string[];
  tags: string[];
}

export interface ShopifyApprovalPayloadPreviewData {
  isShopifyPayloadPreviewContext: boolean;
  shopifyProductSetRequest: ShopifyUnifiedProductSetRequest | null;
}

export interface EbayApprovalPayloadPreviewData {
  isEbayPayloadPreviewContext: boolean;
  ebayDraftPayloadBundle: unknown | null;
}

function stringifyJson(value: unknown, fallback: string) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function buildShopifyPayloadDebug(shopifyProductSetRequest: ShopifyUnifiedProductSetRequest | null): ShopifyPayloadDebug {
  if (!shopifyProductSetRequest) {
    return {
      tags: [],
      collectionsToJoin: [],
    };
  }

  return {
    tags: shopifyProductSetRequest.input.tags ?? [],
    collectionsToJoin: shopifyProductSetRequest.input.collectionsToJoin ?? [],
  };
}

function buildShopifyDraftCreatePayloadJson(shopifyProductSetRequest: ShopifyUnifiedProductSetRequest | null) {
  if (!shopifyProductSetRequest) return '';

  const previewVariables: ShopifyUnifiedProductSetRequest = {
    ...shopifyProductSetRequest,
    input: {
      ...shopifyProductSetRequest.input,
      tags: shopifyProductSetRequest.input.tags ?? [],
      collectionsToJoin: shopifyProductSetRequest.input.collectionsToJoin ?? [],
    },
  };

  return stringifyJson({
    operationName: 'ProductSet',
    query: SHOPIFY_PRODUCT_SET_MUTATION,
    variables: previewVariables,
  }, '{\n  "error": "Unable to serialize payload"\n}');
}

function buildShopifyCategorySyncPreviewJson({
  isShopifyPayloadPreviewContext,
  shopifyCategoryLookupValue,
  currentPageCategoryIdResolution,
  shopifyCategoryResolution,
}: {
  isShopifyPayloadPreviewContext: boolean;
  shopifyCategoryLookupValue: string;
  currentPageCategoryIdResolution: ShopifyCategoryIdResolutionSummary;
  shopifyCategoryResolution: ShopifyCategoryResolutionSummary;
}) {
  if (!isShopifyPayloadPreviewContext) return '';
  if (!shopifyCategoryLookupValue.trim()) return '';
  if (currentPageCategoryIdResolution.value.trim() || shopifyCategoryResolution.match?.id) return '';

  return stringifyJson({
    operationName: 'SearchTaxonomyCategories',
    query: SHOPIFY_SEARCH_TAXONOMY_CATEGORIES_QUERY,
    variables: {
      search: shopifyCategoryLookupValue,
      first: 10,
    },
    note: 'Only needed when the current page value is a taxonomy breadcrumb instead of a category GID.',
  }, '{\n  "error": "Unable to serialize GraphQL preview"\n}');
}

function buildEbayDraftPayloadBundleJson(isEbayPayloadPreviewContext: boolean, ebayDraftPayloadBundle: unknown | null) {
  if (!isEbayPayloadPreviewContext || !ebayDraftPayloadBundle) return '';

  return stringifyJson(ebayDraftPayloadBundle, '{\n  "error": "Unable to serialize payload"\n}');
}

const SHOPIFY_CREATE_PAYLOAD_DOCS_JSON = stringifyJson(SHOPIFY_UNIFIED_PRODUCT_SET_DOCS_EXAMPLE, '{\n  "input": {}\n}');
const EBAY_PAYLOAD_DOCS_JSON = stringifyJson(EBAY_DRAFT_PAYLOAD_DOCS_EXAMPLE, '{\n  "inventoryItem": {},\n  "offer": {}\n}');

export interface ShopifyApprovalPayloadDetailsProps extends ShopifyApprovalPayloadPreviewData {
  currentPageProductDescriptionResolution: ShopifyFieldResolutionSummary;
  currentPageProductDescription: string;
  currentPageProductCategoryResolution: ShopifyFieldResolutionSummary;
  currentPageCategoryIdResolution: ShopifyCategoryIdResolutionSummary;
  shopifyCategoryLookupValue: string;
  shopifyCategoryResolution: ShopifyCategoryResolutionSummary;
}

export interface EbayApprovalPayloadDetailsProps extends EbayApprovalPayloadPreviewData {}

interface ListingApprovalRecordPayloadPanelsProps extends ShopifyApprovalPayloadDetailsProps, EbayApprovalPayloadDetailsProps {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
}

export function ShopifyApprovalPayloadDetails({
  currentPageProductDescriptionResolution,
  currentPageProductDescription,
  currentPageProductCategoryResolution,
  currentPageCategoryIdResolution,
  shopifyCategoryLookupValue,
  shopifyCategoryResolution,
  isShopifyPayloadPreviewContext,
  shopifyProductSetRequest,
}: ShopifyApprovalPayloadDetailsProps) {
  const shopifyPayloadDebug = buildShopifyPayloadDebug(shopifyProductSetRequest);
  const shopifyDraftCreatePayloadJson = buildShopifyDraftCreatePayloadJson(shopifyProductSetRequest);
  const shopifyCategorySyncPreviewJson = buildShopifyCategorySyncPreviewJson({
    isShopifyPayloadPreviewContext,
    shopifyCategoryLookupValue,
    currentPageCategoryIdResolution,
    shopifyCategoryResolution,
  });

  return (
    <>
      <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
          Shopify Create Listing API Payload (Exact Request)
        </summary>
        <div className="border-t border-[var(--line)] px-3 py-3">
          <p className="m-0 mb-2 text-xs text-[var(--muted)]">
            This is the exact GraphQL request envelope used when you click Approve: one <code>productSet</code> mutation plus an optional taxonomy lookup query when the page still has a breadcrumb instead of a category GID.
          </p>
          <div className="mb-2 rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-2 text-xs text-amber-200/90">
            <p className="m-0 font-semibold text-amber-200">Description Source Debug</p>
            <p className="m-0 mt-1">Field: <code>{currentPageProductDescriptionResolution.sourceFieldName || '(none)'}</code></p>
            <p className="m-0 mt-1">Match: <code>{currentPageProductDescriptionResolution.sourceType}</code></p>
            <p className="m-0 mt-1">Resolved Length: <code>{String(currentPageProductDescription.length)}</code></p>
          </div>
          <div className="mb-2 rounded-md border border-sky-400/35 bg-sky-500/10 px-2 py-2 text-xs text-sky-100/90">
            <p className="m-0 font-semibold text-sky-100">Category Sync Debug</p>
            <p className="m-0 mt-1">Category Field: <code>{currentPageProductCategoryResolution.sourceFieldName || '(none)'}</code></p>
            <p className="m-0 mt-1">Category Match: <code>{currentPageProductCategoryResolution.sourceType}</code></p>
            <p className="m-0 mt-1">Category ID Field: <code>{currentPageCategoryIdResolution.sourceFieldName || '(none)'}</code></p>
            <p className="m-0 mt-1">Lookup Value: <code>{shopifyCategoryLookupValue || '(none)'}</code></p>
            <p className="m-0 mt-1">Resolution Status: <code>{shopifyCategoryResolution.status}</code></p>
            <p className="m-0 mt-1">Resolved Category ID: <code>{currentPageCategoryIdResolution.value || shopifyCategoryResolution.match?.id || '(unresolved)'}</code></p>
            <p className="m-0 mt-1">Resolved Category Name: <code>{shopifyCategoryResolution.match?.fullName || shopifyCategoryResolution.error || '(unresolved)'}</code></p>
          </div>
          <div className="mb-2 rounded-md border border-rose-400/35 bg-rose-500/10 px-2 py-2 text-xs text-rose-100/90">
            <p className="m-0 font-semibold text-rose-100">Inventory Quantity Note</p>
            <p className="m-0 mt-1">This unified GraphQL path does not include <code>inventory_quantity</code> because Shopify requires a location ID for inventory quantities and the current token cannot read locations.</p>
          </div>
          <div className="mb-2 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2 py-2 text-xs text-emerald-100/90">
            <p className="m-0 font-semibold text-emerald-100">Payload Field Debug</p>
            <p className="m-0 mt-1">Tags: <code>{shopifyPayloadDebug.tags.length > 0 ? shopifyPayloadDebug.tags.join(', ') : '(none)'}</code></p>
            <p className="m-0 mt-1">Collections: <code>{shopifyPayloadDebug.collectionsToJoin.length > 0 ? shopifyPayloadDebug.collectionsToJoin.join(', ') : '(none)'}</code></p>
          </div>
          <p className="m-0 mb-2 text-xs text-[var(--muted)]">GraphQL <code>productSet</code> request</p>
          <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyDraftCreatePayloadJson || '{\n  "query": "",\n  "variables": {\n    "input": {}\n  }\n}'}</pre>
          {shopifyCategorySyncPreviewJson && (
            <>
              <p className="m-0 mb-2 mt-3 text-xs text-[var(--muted)]">Optional taxonomy lookup query</p>
              <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyCategorySyncPreviewJson}</pre>
            </>
          )}
        </div>
      </details>

      <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
          Shopify Create Listing API Payload (Docs Example)
        </summary>
        <div className="border-t border-[var(--line)] px-3 py-3">
          <p className="m-0 mb-2 text-xs text-[var(--muted)]">
            Reference example showing the expected GraphQL request envelope sent to Shopify for create/update listing.
          </p>
          <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{SHOPIFY_CREATE_PAYLOAD_DOCS_JSON}</pre>
        </div>
      </details>
    </>
  );
}

export function EbayApprovalPayloadDetails({
  isEbayPayloadPreviewContext,
  ebayDraftPayloadBundle,
}: EbayApprovalPayloadDetailsProps) {
  const ebayDraftPayloadBundleJson = buildEbayDraftPayloadBundleJson(isEbayPayloadPreviewContext, ebayDraftPayloadBundle);

  return (
    <>
      <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
          eBay Create Listing API Payload (Exact Request)
        </summary>
        <div className="border-t border-[var(--line)] px-3 py-3">
          <p className="m-0 mb-2 text-xs text-[var(--muted)]">
            Live payload preview for eBay Inventory Item and Offer requests using the current page values.
          </p>
          <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{ebayDraftPayloadBundleJson || '{\n  "inventoryItem": {},\n  "offer": {}\n}'}</pre>
        </div>
      </details>

      <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
          eBay Create Listing API Payload (Docs Example)
        </summary>
        <div className="border-t border-[var(--line)] px-3 py-3">
          <p className="m-0 mb-2 text-xs text-[var(--muted)]">
            Reference example for typical Sell Inventory API inventory item and offer request bodies.
          </p>
          <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{EBAY_PAYLOAD_DOCS_JSON}</pre>
        </div>
      </details>
    </>
  );
}

export function ListingApprovalRecordPayloadPanels({
  approvalChannel,
  currentPageProductDescriptionResolution,
  currentPageProductDescription,
  currentPageProductCategoryResolution,
  currentPageCategoryIdResolution,
  shopifyCategoryLookupValue,
  shopifyCategoryResolution,
  isShopifyPayloadPreviewContext,
  shopifyProductSetRequest,
  isEbayPayloadPreviewContext,
  ebayDraftPayloadBundle,
}: ListingApprovalRecordPayloadPanelsProps) {
  return (
    <>
      {approvalChannel === 'shopify' && (
        <ShopifyApprovalPayloadDetails
          currentPageProductDescriptionResolution={currentPageProductDescriptionResolution}
          currentPageProductDescription={currentPageProductDescription}
          currentPageProductCategoryResolution={currentPageProductCategoryResolution}
          currentPageCategoryIdResolution={currentPageCategoryIdResolution}
          shopifyCategoryLookupValue={shopifyCategoryLookupValue}
          shopifyCategoryResolution={shopifyCategoryResolution}
          isShopifyPayloadPreviewContext={isShopifyPayloadPreviewContext}
          shopifyProductSetRequest={shopifyProductSetRequest}
        />
      )}

      {approvalChannel === 'ebay' && (
        <EbayApprovalPayloadDetails
          isEbayPayloadPreviewContext={isEbayPayloadPreviewContext}
          ebayDraftPayloadBundle={ebayDraftPayloadBundle}
        />
      )}
    </>
  );
}