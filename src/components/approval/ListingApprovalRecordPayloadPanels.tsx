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

interface ShopifyPayloadDebug {
  collectionsToJoin: string[];
  tags: string[];
}

interface ListingApprovalRecordPayloadPanelsProps {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  currentPageProductDescriptionResolution: ShopifyFieldResolutionSummary;
  currentPageProductDescription: string;
  currentPageProductCategoryResolution: ShopifyFieldResolutionSummary;
  currentPageCategoryIdResolution: ShopifyCategoryIdResolutionSummary;
  shopifyCategoryLookupValue: string;
  shopifyCategoryResolution: ShopifyCategoryResolutionSummary;
  shopifyPayloadDebug: ShopifyPayloadDebug;
  shopifyDraftCreatePayloadJson: string;
  shopifyCategorySyncPreviewJson: string;
  shopifyCreatePayloadDocsJson: string;
  ebayDraftPayloadBundleJson: string;
  ebayPayloadDocsJson: string;
}

export function ListingApprovalRecordPayloadPanels({
  approvalChannel,
  currentPageProductDescriptionResolution,
  currentPageProductDescription,
  currentPageProductCategoryResolution,
  currentPageCategoryIdResolution,
  shopifyCategoryLookupValue,
  shopifyCategoryResolution,
  shopifyPayloadDebug,
  shopifyDraftCreatePayloadJson,
  shopifyCategorySyncPreviewJson,
  shopifyCreatePayloadDocsJson,
  ebayDraftPayloadBundleJson,
  ebayPayloadDocsJson,
}: ListingApprovalRecordPayloadPanelsProps) {
  return (
    <>
      {approvalChannel === 'shopify' && (
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
      )}

      {approvalChannel === 'shopify' && (
        <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
            Shopify Create Listing API Payload (Docs Example)
          </summary>
          <div className="border-t border-[var(--line)] px-3 py-3">
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">
              Reference example showing the expected GraphQL request envelope sent to Shopify for create/update listing.
            </p>
            <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyCreatePayloadDocsJson}</pre>
          </div>
        </details>
      )}

      {approvalChannel === 'ebay' && (
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
              <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{ebayPayloadDocsJson}</pre>
            </div>
          </details>
        </>
      )}
    </>
  );
}