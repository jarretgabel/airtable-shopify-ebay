import { useState, useMemo } from 'react';
import type { ShopifyTabViewModel } from '@/app/appTabViewModels';
import { EmptySurface, ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { darkTableRowHoverClass, listingSummaryClass } from '@/components/tabs/uiClasses';
import type { ShopifyProduct, ShopifyProductVariant } from '@/types/shopify';

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const statusClassName = normalizedStatus === 'active'
    ? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-200'
    : normalizedStatus === 'draft'
      ? 'border border-amber-400/35 bg-amber-500/20 text-amber-200'
      : 'border border-slate-400/35 bg-slate-500/20 text-slate-200';
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.06em] ${statusClassName}`}>{status}</span>
  );
}

function trimProductType(type: string): string {
  const lastGt = type.lastIndexOf('>');
  return lastGt >= 0 ? type.slice(lastGt + 1).trim() : type;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const productCardButtonClass = `w-full bg-[var(--panel)] px-4 py-4 text-left transition hover:bg-[var(--line)] ${darkTableRowHoverClass}`;

function summarizeVariant(product: ShopifyProduct): ShopifyProductVariant | undefined {
  return product.variants?.[0];
}

interface ShopifyTabProps {
  viewModel: ShopifyTabViewModel;
  onOpenProduct?: (productId: string) => void;
}

const searchInputClass = 'flex-1 min-w-[180px] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[0.82rem] text-[var(--ink)] placeholder-[var(--muted)] outline-none transition-colors focus:border-[var(--accent)]';
const selectClass = 'rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[0.82rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)] cursor-pointer';

export function ShopifyTab({ viewModel, onOpenProduct }: ShopifyTabProps) {
  const { loading, error, products } = viewModel;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [sort, setSort] = useState<'title-asc' | 'title-desc' | 'price-asc' | 'price-desc' | 'date-newest' | 'date-oldest'>('title-asc');

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
          p.title?.toLowerCase().includes(q) ||
          p.vendor?.toLowerCase().includes(q) ||
          p.product_type?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status?.toLowerCase() === statusFilter);
    }
    switch (sort) {
      case 'title-asc': list.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')); break;
      case 'title-desc': list.sort((a, b) => (b.title ?? '').localeCompare(a.title ?? '')); break;
      case 'price-asc': list.sort((a, b) => parseFloat(a.variants?.[0]?.price ?? '0') - parseFloat(b.variants?.[0]?.price ?? '0')); break;
      case 'price-desc': list.sort((a, b) => parseFloat(b.variants?.[0]?.price ?? '0') - parseFloat(a.variants?.[0]?.price ?? '0')); break;
      case 'date-newest': list.sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()); break;
      case 'date-oldest': list.sort((a, b) => new Date(a.published_at ?? 0).getTime() - new Date(b.published_at ?? 0).getTime()); break;
    }
    return list;
  }, [products, search, statusFilter, sort]);

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          className={searchInputClass}
          placeholder="Search title, vendor, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
        <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort products">
          <option value="title-asc">Title A→Z</option>
          <option value="title-desc">Title Z→A</option>
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
          <option value="date-newest">Newest</option>
          <option value="date-oldest">Oldest</option>
        </select>
      </div>
      <p className={listingSummaryClass}>
        <strong>{filteredProducts.length}</strong>{filteredProducts.length !== products.length ? ` of ${products.length}` : ''} products in your Shopify store.
      </p>
      {filteredProducts.length === 0 && search && (
        <p className="py-8 text-center text-[0.88rem] text-[var(--muted)]">No products match your search.</p>
      )}
      {filteredProducts.map((product) => {
        const openSnapshot = () => {
          if (product.id !== undefined) {
            onOpenProduct?.(String(product.id));
          }
        };
        const primaryVariant = summarizeVariant(product);
        const tags = product.tags ? product.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
        const descriptionPreview = product.body_html ? stripHtml(product.body_html) : '';

        return (
          <article key={product.id} className="mt-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_6px_20px_rgba(17,32,49,0.06)]">
            <button type="button" onClick={openSnapshot} className={productCardButtonClass}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-[1.08rem] font-semibold text-[var(--ink)]">{product.title}</h3>
                    <StatusBadge status={product.status ?? 'unknown'} />
                  </div>
                  <div className="mt-1.5 text-sm text-[var(--muted)]">{product.vendor || 'No vendor'} · {product.product_type ? trimProductType(product.product_type) : 'No type'}</div>
                  {descriptionPreview && <p className="m-0 mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{descriptionPreview}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    <span className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-1">{product.variants?.length ?? 0} variant{product.variants?.length === 1 ? '' : 's'}</span>
                    <span className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-1">{product.images?.length ?? 0} image{product.images?.length === 1 ? '' : 's'}</span>
                    <span className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-1">{tags.length} tag{tags.length === 1 ? '' : 's'}</span>
                    {product.published_at && <span className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-1">Published {formatDate(product.published_at)}</span>}
                  </div>
                </div>
                <div className="text-left md:min-w-[180px] md:text-right">
                  <p className="m-0 text-lg font-bold text-[var(--ink)]">
                    {primaryVariant?.price ? `$${primaryVariant.price}` : 'No price'}
                  </p>
                  {primaryVariant?.sku && <p className="m-0 mt-2 text-[0.72rem] font-mono text-[var(--muted)]">SKU {primaryVariant.sku}</p>}
                  {product.handle && <p className="m-0 mt-1 text-[0.72rem] font-mono text-[var(--muted)]">{product.handle}</p>}
                </div>
              </div>
            </button>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full border border-[var(--line)] bg-white/5 px-2 py-0.5 text-xs text-[var(--muted)]">{tag}</span>
                ))}
                {tags.length > 4 && <span className="rounded-full border border-[var(--line)] bg-white/5 px-2 py-0.5 text-xs text-[var(--muted)]">+{tags.length - 4} more</span>}
              </div>
              <button
                type="button"
                className="rounded-md border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300/50 hover:bg-sky-500/25"
                onClick={openSnapshot}
              >
                Open Snapshot
              </button>
            </div>
          </article>
        );
      })}
    </PanelSurface>
  );
}
