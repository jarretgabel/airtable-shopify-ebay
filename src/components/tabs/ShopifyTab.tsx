import { useState } from 'react';
import type { ShopifyTabViewModel } from '@/app/appTabViewModels';
import { ExpandableDataCard } from '@/components/app/ExpandableDataCard';
import { EmptySurface, ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { listingSummaryClass, mutedCodeClass } from '@/components/tabs/uiClasses';

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
  viewModel: ShopifyTabViewModel;
}

export function ShopifyTab({ viewModel }: ShopifyTabProps) {
  const { loading, error, products, storeDomain } = viewModel;
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  if (error) {
    return <ErrorSurface title="Error loading Shopify products" message={error.message} />;
  }

  if (loading && !products.length) {
    return <LoadingSurface message="Loading products from Shopify..." />;
  }

  if (!loading && products.length === 0) {
    return <EmptySurface title="No products found" message="Your Shopify store has no products yet." />;
  }

  return (
    <PanelSurface>
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
    </PanelSurface>
  );
}
