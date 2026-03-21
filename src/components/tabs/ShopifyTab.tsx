import { useState, useMemo } from 'react';
import type { ShopifyTabViewModel } from '@/app/appTabViewModels';
import { ExpandableDataCard } from '@/components/app/ExpandableDataCard';
import { EmptySurface, ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { darkTableHeaderClass, darkTableRowHoverClass, listingSummaryClass, mutedCodeClass } from '@/components/tabs/uiClasses';
import type { ShopifyProduct } from '@/types/shopify';

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

const detailRowClass = `flex flex-wrap items-start gap-2 rounded-md px-2 py-1.5 ${darkTableRowHoverClass}`;
const sectionHeadingClass = 'm-0 mb-2 mt-4 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]';
const thClass = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.06em] whitespace-nowrap';
const tdClass = 'px-3 py-2 text-[var(--ink)] whitespace-nowrap';
const tdMutedClass = 'px-3 py-2 text-[var(--muted)] whitespace-nowrap';

function ProductDetail({ product, storeDomain }: { product: ShopifyProduct & { id: number }; storeDomain?: string }) {
  const mainVariant = product.variants?.[0];
  const tags = product.tags ? product.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-1 text-sm text-[var(--ink)]">
      {/* Basic product fields — matches Airtable: shopify_rest_* */}
      <p className={sectionHeadingClass}>Product Info</p>
      <p className={detailRowClass}><strong className="text-[var(--muted)]">ID:</strong> <code className={mutedCodeClass}>{product.id}</code></p>
      <p className={detailRowClass}><strong className="text-[var(--muted)]">Status:</strong> <StatusBadge status={product.status ?? 'unknown'} /></p>
      <p className={detailRowClass}><strong className="text-[var(--muted)]">Vendor:</strong> {product.vendor || '—'}</p>
      <p className={detailRowClass}><strong className="text-[var(--muted)]">Product Type:</strong> {product.product_type ? trimProductType(product.product_type) : '—'}</p>
      <p className={detailRowClass}><strong className="text-[var(--muted)]">Title:</strong> {product.title || '—'}</p>
      <p className={detailRowClass}><strong className="text-[var(--muted)]">Published At:</strong> {product.published_at ? formatDate(product.published_at) : '—'}</p>
      {product.published_scope && (
        <p className={detailRowClass}><strong className="text-[var(--muted)]">Published Scope:</strong> {product.published_scope}</p>
      )}
      {product.template_suffix && (
        <p className={detailRowClass}><strong className="text-[var(--muted)]">Template Suffix:</strong> {product.template_suffix}</p>
      )}

      {/* Description — shopify_rest_body_html */}
      {product.body_html && (
        <>
          <p className={sectionHeadingClass}>Description</p>
          <p className={`${detailRowClass} block`}>{stripHtml(product.body_html) || '—'}</p>
        </>
      )}

      {/* Tags — shopify_rest_tags / airtable flat tags table */}
      {tags.length > 0 && (
        <>
          <p className={sectionHeadingClass}>Tags</p>
          <div className="flex flex-wrap gap-1.5 px-2 py-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full border border-[var(--line)] bg-white/5 px-2 py-0.5 text-xs text-[var(--muted)]">{tag}</span>
            ))}
          </div>
        </>
      )}

      {/* Options — shopify_rest_option_N_name + values (airtable flat options table) */}
      {product.options && product.options.length > 0 && !(product.options.length === 1 && product.options[0].name === 'Title') && (
        <>
          <p className={sectionHeadingClass}>Options</p>
          {product.options.map((opt) => (
            <p key={opt.name} className={detailRowClass}>
              <strong className="text-[var(--muted)]">{opt.name}:</strong>
              {opt.values.join(', ')}
            </p>
          ))}
        </>
      )}

      {/* Variants — shopify_rest_variant_N_* fields */}
      <p className={sectionHeadingClass}>Variants ({product.variants?.length ?? 0})</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
        <table className="min-w-full border-collapse text-sm">
          <thead className={darkTableHeaderClass}>
            <tr>
              <th scope="col" className={thClass}>#</th>
              <th scope="col" className={thClass}>SKU</th>
              <th scope="col" className={thClass}>Price</th>
              <th scope="col" className={thClass}>Compare At</th>
              <th scope="col" className={thClass}>Qty</th>
              <th scope="col" className={thClass}>Inv. Policy</th>
              <th scope="col" className={thClass}>Inv. Mgmt</th>
              <th scope="col" className={thClass}>Barcode</th>
              <th scope="col" className={thClass}>Fulfillment</th>
              <th scope="col" className={thClass}>Taxable</th>
              <th scope="col" className={thClass}>Ships</th>
              <th scope="col" className={thClass}>Weight</th>
              {mainVariant?.option1 !== undefined && mainVariant.option1 !== null && <th scope="col" className={thClass}>Option 1</th>}
              {mainVariant?.option2 !== undefined && mainVariant.option2 !== null && <th scope="col" className={thClass}>Option 2</th>}
              {mainVariant?.option3 !== undefined && mainVariant.option3 !== null && <th scope="col" className={thClass}>Option 3</th>}
            </tr>
          </thead>
          <tbody>
            {(product.variants?.length ? product.variants : []).map((v, i) => (
              <tr key={v.id ?? i} className={`border-t border-[var(--line)] ${darkTableRowHoverClass}`}>
                <td className={tdMutedClass}>{i + 1}</td>
                <td className={tdMutedClass}>{v.sku || '—'}</td>
                <td className={tdClass}>{v.price ? `$${v.price}` : '—'}</td>
                <td className={tdMutedClass}>{v.compare_at_price ? `$${v.compare_at_price}` : '—'}</td>
                <td className={tdClass}>{v.inventory_quantity ?? '—'}</td>
                <td className={tdMutedClass}>{v.inventory_policy || '—'}</td>
                <td className={tdMutedClass}>{v.inventory_management || '—'}</td>
                <td className={tdMutedClass}>{v.barcode || '—'}</td>
                <td className={tdMutedClass}>{v.fulfillment_service || '—'}</td>
                <td className={tdMutedClass}>{v.taxable === undefined ? '—' : v.taxable ? 'Yes' : 'No'}</td>
                <td className={tdMutedClass}>{v.requires_shipping === undefined ? '—' : v.requires_shipping ? 'Yes' : 'No'}</td>
                <td className={tdMutedClass}>{v.weight != null ? `${v.weight} ${v.weight_unit ?? ''}`.trim() : '—'}</td>
                {mainVariant?.option1 !== undefined && mainVariant.option1 !== null && <td className={tdMutedClass}>{v.option1 || '—'}</td>}
                {mainVariant?.option2 !== undefined && mainVariant.option2 !== null && <td className={tdMutedClass}>{v.option2 || '—'}</td>}
                {mainVariant?.option3 !== undefined && mainVariant.option3 !== null && <td className={tdMutedClass}>{v.option3 || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Images — shopify_rest_image_N_src / alt / position */}
      {product.images && product.images.length > 0 && (
        <>
          <p className={sectionHeadingClass}>Images ({product.images.length})</p>
          <div className="flex flex-wrap gap-3 px-2 py-1">
            {product.images.map((img, i) => (
              <div key={img.id ?? i} className="flex flex-col items-center gap-1">
                <img
                  src={img.src}
                  alt={img.alt || `Product image ${i + 1}`}
                  className="h-20 w-20 rounded-md border border-[var(--line)] object-cover"
                  loading="lazy"
                />
                <span className="text-[0.65rem] text-[var(--muted)]">#{img.position ?? i + 1}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Admin link */}
      {storeDomain && (
        <p className={`${detailRowClass} mt-2`}>
          <strong className="text-[var(--muted)]">Admin:</strong>{' '}
          <a
            className="font-medium text-[var(--accent)] underline-offset-2 transition-colors hover:text-sky-300 hover:underline"
            href={`https://${storeDomain}/admin/products/${product.id}`}
            target="_blank"
            rel="noreferrer"
          >
            View in Shopify ↗
          </a>
        </p>
      )}
    </div>
  );
}

interface ShopifyTabProps {
  viewModel: ShopifyTabViewModel;
}

const searchInputClass = 'flex-1 min-w-[180px] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[0.82rem] text-[var(--ink)] placeholder-[var(--muted)] outline-none transition-colors focus:border-[var(--accent)]';
const selectClass = 'rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[0.82rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)] cursor-pointer';

export function ShopifyTab({ viewModel }: ShopifyTabProps) {
  const { loading, error, products, storeDomain } = viewModel;
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
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
      {filteredProducts.map((product) => (
        <ExpandableDataCard
          key={product.id}
          expanded={expandedProductId === product.id}
          onToggle={() => setExpandedProductId(expandedProductId === product.id ? null : (product.id ?? null))}
          title={product.title}
          subtitle={<>{product.vendor || 'No vendor'} · {product.product_type ? trimProductType(product.product_type) : 'No type'}</>}
          side={(
            <>
              <p className="m-0 text-lg font-bold text-[var(--ink)]">
                {product.variants?.[0]?.price ? `$${product.variants[0].price}` : 'No price'}
              </p>
              <div className="mt-1"><StatusBadge status={product.status ?? 'unknown'} /></div>
            </>
          )}
        >
          <ProductDetail product={product as ShopifyProduct & { id: number }} storeDomain={storeDomain} />
        </ExpandableDataCard>
      ))}
    </PanelSurface>
  );
}
