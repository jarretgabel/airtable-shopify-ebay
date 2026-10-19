import { useEffect, useMemo, useState } from 'react';
import { loadShopifyCollections } from '@/services/categorySuggestions';
import {
  describeCollectionRule,
  evaluateSmartCollections,
  type ListingCollectionFacts,
} from '@/services/shopifyCollectionRules';
import { parseShopifyTagList } from '@/services/shopifyTags';
import { trimShopifyProductType } from '@/services/shopifyTaxonomy';
import { buildShopifyDraftProductFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
import type { ShopifyCollectionMatch } from '@/services/shopify';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
} from '@/components/tabs/uiClasses';

const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const MAX_CLOSE_MATCHES = 12;

interface ShopifySmartCollectionsPreviewProps {
  fields: Record<string, unknown>;
}

function toNumber(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Chip({ children, tone }: { children: string; tone: 'green' | 'amber' }) {
  const toneClass = tone === 'green'
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
    : 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  return <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${toneClass}`}>{children}</span>;
}

export function ShopifySmartCollectionsPreview({ fields }: ShopifySmartCollectionsPreviewProps) {
  const [collections, setCollections] = useState<ShopifyCollectionMatch[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadShopifyCollections()
      .then((loaded) => {
        if (!cancelled) setCollections(loaded);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load Shopify collections.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const evaluations = useMemo(() => {
    if (!collections) return [];

    const product = buildShopifyDraftProductFromApprovalFields(fields as Record<string, never>);
    const variant = product.variants?.[0];
    const facts: ListingCollectionFacts = {
      tags: parseShopifyTagList(product.tags ?? ''),
      productType: trimShopifyProductType(product.product_type ?? ''),
      vendor: product.vendor ?? '',
      title: product.title ?? '',
      price: toNumber(variant?.price),
      compareAtPrice: toNumber(variant?.compare_at_price),
      inventory: toNumber(variant?.inventory_quantity),
    };
    return evaluateSmartCollections(collections, facts);
  }, [collections, fields]);

  const joins = evaluations.filter((evaluation) => evaluation.status === 'joins');
  const unknown = evaluations.filter((evaluation) => evaluation.status === 'unknown');
  // Only multi-rule collections missing exactly one rule are worth pointing out; single-tag collections would add noise.
  const closeMatches = evaluations
    .filter((evaluation) => (
      evaluation.status === 'does-not-join'
      && !evaluation.collection.appliedDisjunctively
      && (evaluation.collection.rules?.length ?? 0) > 1
      && evaluation.unmetRules.length === 1
    ))
    .slice(0, MAX_CLOSE_MATCHES);

  return (
    <div className="col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={labelClass}>Automatic Collections</span>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
        {error && <p role="alert" className="m-0 text-xs text-rose-400">{error}</p>}
        {!error && !collections && <p className="m-0 text-sm text-[var(--muted)]">Checking smart collection rules…</p>}
        {collections && (
          <>
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">
              Smart collections are filled by Shopify from tags, product type, vendor and stock. This is a preview based on the values on this form.
            </p>
            {joins.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {joins.map((evaluation) => <Chip key={evaluation.collection.id} tone="green">{evaluation.collection.title}</Chip>)}
              </div>
            ) : (
              <p className="m-0 text-sm text-[var(--muted)]">No smart collections match yet. Add tags or a product type that their rules look for.</p>
            )}
            {unknown.length > 0 && (
              <p className="m-0 mt-2 text-xs text-[var(--muted)]">
                Could not check: {unknown.map((evaluation) => evaluation.collection.title).join(', ')}
              </p>
            )}
            {closeMatches.length > 0 && (
              <details className={`mt-3 ${detailDisclosureClass}`}>
                <summary className={detailDisclosureSummaryClass}>Almost matching ({closeMatches.length})</summary>
                <div className={`${detailDisclosureBodyClass} space-y-2`}>
                  {closeMatches.map((evaluation) => (
                    <div key={evaluation.collection.id} className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
                      <Chip tone="amber">{evaluation.collection.title}</Chip>
                      <span className="text-xs text-[var(--muted)]">needs {describeCollectionRule(evaluation.unmetRules[0])}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
