import { useState } from 'react';
import { useListings } from '@/hooks/useListings';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import './App.css';

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function hasNonEmptyFields(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some((value) => hasValue(value));
}

function recordTitle(fields: Record<string, unknown>): string {
  return displayValue(fields.Brand ?? fields.Name ?? fields.Model ?? 'Untitled Listing');
}

type Tab = 'airtable' | 'shopify';

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-${status}`}>{status}</span>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('airtable');

  const tableName = import.meta.env.VITE_AIRTABLE_TABLE_NAME || 'Table 1';
  const viewId = import.meta.env.VITE_AIRTABLE_VIEW_ID;
  const { listings, loading: atLoading, error: atError, refetch: atRefetch } = useListings(tableName, viewId);
  const nonEmptyListings = listings.filter((listing) => hasNonEmptyFields(listing.fields));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { products, loading: spLoading, error: spError, refetch: spRefetch } = useShopifyProducts();
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  const loading = activeTab === 'airtable' ? atLoading : spLoading;
  const refetch = activeTab === 'airtable' ? atRefetch : spRefetch;

  return (
    <main className="dashboard-shell">
      <section className="dashboard-container">
        <header className="dashboard-hero">
          <div>
            <p className="hero-kicker">Inventory Operations</p>
            <h1 className="hero-title">Listing Control Center</h1>
            <p className="hero-subtitle">Monitor your Airtable inventory and Shopify product catalog in one place.</p>
          </div>
          <div className="hero-meta">
            <p>Airtable: <strong>{nonEmptyListings.length}</strong> records</p>
            <p>Shopify: <strong>{products.length}</strong> products</p>
          </div>
        </header>

        <section className="stats-row">
          <article className="stat-card">
            <p className="stat-label">Airtable Records</p>
            <p className="stat-value">{nonEmptyListings.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Shopify Products</p>
            <p className="stat-value">{products.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Shopify Active</p>
            <p className="stat-value">{products.filter(p => p.status === 'active').length}</p>
          </article>
        </section>

        <div className="tab-row">
          <div className="tab-bar">
            <button
              className={`tab-btn${activeTab === 'airtable' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('airtable')}
            >
              Airtable Inventory
            </button>
            <button
              className={`tab-btn${activeTab === 'shopify' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('shopify')}
            >
              Shopify Products
            </button>
          </div>
          <button onClick={refetch} disabled={loading} className="refresh-button">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* ── Airtable Tab ── */}
        {activeTab === 'airtable' && (
          <>
            {atError && (
              <section className="panel error-panel">
                <p className="error-title">Error loading Airtable records</p>
                <p className="error-message">{atError.message}</p>
              </section>
            )}

            {atLoading && !nonEmptyListings.length && (
              <section className="panel loading-panel">
                <div className="loader" />
                <p>Loading records from Airtable...</p>
              </section>
            )}

            {!atLoading && nonEmptyListings.length > 0 && (
              <section className="panel listings-panel">
                <p className="listings-summary">
                  Showing <strong>{nonEmptyListings.length}</strong> rows with meaningful data.
                </p>
                {nonEmptyListings.map((listing) => (
                  <article key={listing.id} className="listing-card">
                    <button
                      onClick={() => setExpandedId(expandedId === listing.id ? null : listing.id)}
                      className="listing-toggle"
                    >
                      <div className="listing-main">
                        <div>
                          <h3 className="listing-title">{recordTitle(listing.fields)}</h3>
                          <p className="listing-subtitle">
                            Model: <code>{displayValue(listing.fields.Model)}</code>
                          </p>
                        </div>
                        <div className="listing-side">
                          <p className="listing-price">{displayValue(listing.fields.Price)}</p>
                          <p className="listing-meta">Distributor: {displayValue(listing.fields.Distributor)}</p>
                        </div>
                      </div>
                    </button>
                    {expandedId === listing.id && (
                      <div className="listing-details">
                        <h4>Record Details</h4>
                        <div className="details-grid">
                          <p><strong>ID:</strong> <code>{listing.id}</code></p>
                          <p><strong>Created:</strong> {new Date(listing.createdTime).toLocaleString()}</p>
                          {hasValue(listing.fields.Component ?? listing.fields['Component Type']) && (
                            <p><strong>Component:</strong> {displayValue(listing.fields.Component ?? listing.fields['Component Type'])}</p>
                          )}
                          {hasValue(listing.fields.Status) && (
                            <p><strong>Status:</strong> {displayValue(listing.fields.Status)}</p>
                          )}
                          <div className="json-block">
                            <p>{JSON.stringify(listing.fields, null, 2)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}

            {!atLoading && nonEmptyListings.length === 0 && !atError && (
              <section className="panel empty-panel">
                <p className="empty-title">No non-empty rows found</p>
                <p>Rows with empty field payloads are currently hidden.</p>
              </section>
            )}
          </>
        )}

        {/* ── Shopify Tab ── */}
        {activeTab === 'shopify' && (
          <>
            {spError && (
              <section className="panel error-panel">
                <p className="error-title">Error loading Shopify products</p>
                <p className="error-message">{spError.message}</p>
              </section>
            )}

            {spLoading && !products.length && (
              <section className="panel loading-panel">
                <div className="loader" />
                <p>Loading products from Shopify...</p>
              </section>
            )}

            {!spLoading && products.length > 0 && (
              <section className="panel listings-panel">
                <p className="listings-summary">
                  <strong>{products.length}</strong> products in your Shopify store.
                </p>
                {products.map((product) => (
                  <article key={product.id} className="listing-card">
                    <button
                      onClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
                      className="listing-toggle"
                    >
                      <div className="listing-main">
                        <div>
                          <h3 className="listing-title">{product.title}</h3>
                          <p className="listing-subtitle">
                            {product.vendor} · {product.product_type || 'No type'}
                          </p>
                        </div>
                        <div className="listing-side">
                          <p className="listing-price">
                            {product.variants?.[0]?.price ? `$${product.variants[0].price}` : 'No price'}
                          </p>
                          <StatusBadge status={product.status ?? 'unknown'} />
                        </div>
                      </div>
                    </button>
                    {expandedProductId === product.id && (
                      <div className="listing-details">
                        <h4>Product Details</h4>
                        <div className="details-grid">
                          <p><strong>ID:</strong> <code>{product.id}</code></p>
                          <p><strong>Status:</strong> <StatusBadge status={product.status ?? 'unknown'} /></p>
                          <p><strong>Vendor:</strong> {product.vendor || 'N/A'}</p>
                          <p><strong>Type:</strong> {product.product_type || 'N/A'}</p>
                          <p><strong>Tags:</strong> {product.tags || 'None'}</p>
                          <p><strong>Variants:</strong> {product.variants?.length ?? 0}</p>
                          {product.variants?.map((v, i) => (
                            <p key={i}>
                              <strong>Variant {i + 1}:</strong> ${v.price} — SKU: {v.sku || 'N/A'}
                            </p>
                          ))}
                          <p>
                            <strong>Admin:</strong>{' '}
                            <a
                              href={`https://${import.meta.env.VITE_SHOPIFY_STORE_DOMAIN}/admin/products/${product.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View in Shopify ↗
                            </a>
                          </p>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}

            {!spLoading && products.length === 0 && !spError && (
              <section className="panel empty-panel">
                <p className="empty-title">No products found</p>
                <p>Your Shopify store has no products yet.</p>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
