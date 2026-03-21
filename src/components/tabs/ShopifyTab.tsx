import { useState } from 'react';
import { ShopifyProduct } from '@/types/shopify';
import { ExpandableDataCard } from '@/components/app/ExpandableDataCard';
import { emptySurfaceClass, errorSurfaceClass, listingSummaryClass, loadingSurfaceClass, mutedCodeClass, panelSurfaceClass, spinnerClass } from '@/components/tabs/uiClasses';

type ShopifyProductFull = ShopifyProduct & { id: number; created_at: string; updated_at: string };

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const statusClassName = normalizedStatus === 'active'
    ? 'bg-emerald-100 text-emerald-800'
    : normalizedStatus === 'draft'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-100 text-slate-600';

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.06em] ${statusClassName}`}>{status}</span>
  );
}

interface ShopifyTabProps {
  loading: boolean;
  error: Error | null;
  products: ShopifyProductFull[];
  storeDomain?: string;
}

export function ShopifyTab({ loading, error, products, storeDomain }: ShopifyTabProps) {
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  if (error) {
    return (
      <section className={errorSurfaceClass}>
        <p className="m-0 font-bold text-[var(--error-text)]">Error loading Shopify products</p>
        <p className="mt-2 text-[var(--error-text)]/85">{error.message}</p>
      </section>
    );
  }

  if (loading && !products.length) {
    return (
      <section className={loadingSurfaceClass}>
        <div className={spinnerClass} />
        <p>Loading products from Shopify...</p>
      </section>
    );
  }

  if (!loading && products.length === 0) {
    return (
      <section className={emptySurfaceClass}>
        <p className="m-0 font-bold text-[var(--ink)]">No products found</p>
        <p>Your Shopify store has no products yet.</p>
      </section>
    );
  }

  return (
    <section className={panelSurfaceClass}>
      <p className={listingSummaryClass}>
        <strong>{products.length}</strong> products in your Shopify store.
      </p>
      {products.map((product) => (
        <ExpandableDataCard
          key={product.id}
          expanded={expandedProductId === product.id}
          onToggle={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
          title={product.title}
          subtitle={<>{product.vendor} · {product.product_type || 'No type'}</>}
          side={(
            <>
              <p className="m-0 text-lg font-bold text-slate-900">
                {product.variants?.[0]?.price ? `$${product.variants[0].price}` : 'No price'}
              </p>
              <div className="mt-1"><StatusBadge status={product.status ?? 'unknown'} /></div>
            </>
          )}
        >
          <h4 className="m-0 mb-3 text-base font-semibold text-slate-900">Product Details</h4>
          <div className="space-y-2 text-sm text-slate-700">
            <p className="m-0"><strong>ID:</strong> <code className={mutedCodeClass}>{product.id}</code></p>
            <p className="m-0"><strong>Status:</strong> <StatusBadge status={product.status ?? 'unknown'} /></p>
            <p className="m-0"><strong>Vendor:</strong> {product.vendor || 'N/A'}</p>
            <p className="m-0"><strong>Type:</strong> {product.product_type || 'N/A'}</p>
            <p className="m-0"><strong>Tags:</strong> {product.tags || 'None'}</p>
            <p className="m-0"><strong>Variants:</strong> {product.variants?.length ?? 0}</p>
            {product.variants?.map((v, i) => (
              <p key={i} className="m-0">
                <strong>Variant {i + 1}:</strong> ${v.price} — SKU: {v.sku || 'N/A'}
              </p>
            ))}
            <p className="m-0">
              <strong>Admin:</strong>{' '}
              <a
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                href={`https://${storeDomain}/admin/products/${product.id}`}
                target="_blank"
                rel="noreferrer"
              >
                View in Shopify ↗
              </a>
            </p>
          </div>
        </ExpandableDataCard>
      ))}
    </section>
  );
}
