import { useState, useRef, FormEvent } from 'react';
import { useListings } from '@/hooks/useListings';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { useHiFiShark } from '@/hooks/useHiFiShark';
import { useJotFormInquiries } from '@/hooks/useJotForm';
import { formatAnswer } from '@/services/jotform';
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

type Tab = 'dashboard' | 'airtable' | 'shopify' | 'market' | 'jotform';

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-${status}`}>{status}</span>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tableName = import.meta.env.VITE_AIRTABLE_TABLE_NAME || 'Table 1';
  const viewId = import.meta.env.VITE_AIRTABLE_VIEW_ID;
  const { listings, loading: atLoading, error: atError, refetch: atRefetch } = useListings(tableName, viewId);
  const nonEmptyListings = listings.filter((listing) => hasNonEmptyFields(listing.fields));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { products, loading: spLoading, error: spError, refetch: spRefetch } = useShopifyProducts();
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  const { listings: sharkListings, loading: sharkLoading, error: sharkError, search: sharkSearch, currentSlug } = useHiFiShark();
  const sharkInputRef = useRef<HTMLInputElement>(null);

  function handleSharkSearch(e: FormEvent) {
    e.preventDefault();
    const val = sharkInputRef.current?.value?.trim();
    if (val) sharkSearch(val);
  }

  const JOTFORM_FORM_ID = import.meta.env.VITE_JOTFORM_FORM_ID || '213604252654047';
  const {
    submissions: jfSubmissions,
    loading: jfLoading,
    polling: jfPolling,
    error: jfError,
    refetch: jfRefetch,
    lastUpdated: jfLastUpdated,
    freshCount: jfFreshCount,
    clearFresh: jfClearFresh,
  } = useJotFormInquiries(JOTFORM_FORM_ID);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const totalNewSubmissions = jfSubmissions.filter(s => s.new === '1').length;

  const loading = activeTab === 'airtable' ? atLoading : activeTab === 'shopify' ? spLoading : activeTab === 'jotform' ? jfLoading : false;
  const refetch = activeTab === 'airtable' ? atRefetch : activeTab === 'shopify' ? spRefetch : activeTab === 'jotform' ? jfRefetch : () => {};

  // ── Dashboard metrics derived from live data ──────────────────────────────

  // Incoming gear: JotForm submissions received in the last 30 days
  const now = Date.now();
  const MS_30D = 30 * 24 * 60 * 60 * 1000;
  const MS_7D  =  7 * 24 * 60 * 60 * 1000;
  const recentSubs = jfSubmissions.filter(s => now - new Date(s.created_at).getTime() < MS_30D);
  const thisWeekSubs = jfSubmissions.filter(s => now - new Date(s.created_at).getTime() < MS_7D);

  // Deals in progress: Shopify draft products (sent offer / waiting)
  const draftProducts = products.filter(p => p.status === 'draft');
  const activeProducts = products.filter(p => p.status === 'active');
  const archivedProducts = products.filter(p => p.status === 'archived');

  // Inventory value: sum of all active Shopify variant prices
  const inventoryValue = products.reduce((sum, p) => {
    if (p.status !== 'active') return sum;
    const price = parseFloat(p.variants?.[0]?.price ?? '0') || 0;
    const qty = p.variants?.[0]?.inventory_quantity ?? 1;
    return sum + price * Math.max(qty, 1);
  }, 0);

  // Acquisition cost proxy: Airtable Price field summed
  const acquisitionCost = nonEmptyListings.reduce((sum, l) => {
    const raw = String(l.fields.Price ?? l.fields['Purchase Price'] ?? l.fields.Cost ?? '').replace(/[^0-9.]/g, '');
    return sum + (parseFloat(raw) || 0);
  }, 0);

  // Sales performance: active * avg price vs archived (completed sales)
  const avgAskPrice = activeProducts.length
    ? activeProducts.reduce((s, p) => s + (parseFloat(p.variants?.[0]?.price ?? '0') || 0), 0) / activeProducts.length
    : 0;

  // Profit margin proxy: (inventory value - acquisition cost) / inventory value
  const profitableItems = activeProducts.filter(p => {
    const ask = parseFloat(p.variants?.[0]?.price ?? '0') || 0;
    return ask > 0;
  });
  const totalAsk = profitableItems.reduce((s, p) => s + (parseFloat(p.variants?.[0]?.price ?? '0') || 0), 0);
  const grossMarginPct = acquisitionCost > 0 && totalAsk > 0
    ? Math.round(((totalAsk - acquisitionCost) / totalAsk) * 100)
    : null;

  // Submission trend for sparkline-style bar chart (last 14 days, grouped by day)
  const submissionDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 24 * 60 * 60 * 1000);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = jfSubmissions.filter(s => {
      const sd = new Date(s.created_at);
      return sd.toDateString() === d.toDateString();
    }).length;
    return { label, count };
  });
  const maxDayCount = Math.max(...submissionDays.map(d => d.count), 1);

  // Brand breakdown from JotForm answers
  const brandCounts: Record<string, number> = {};
  jfSubmissions.slice(0, 500).forEach(s => {
    const brandAnswer = Object.values(s.answers).find(a =>
      /brand/i.test(a.text || '') || /brand/i.test(a.name || '')
    );
    const brand = formatAnswer(brandAnswer?.answer)?.trim();
    if (brand && brand.length < 50) {
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    }
  });
  const topBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

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
            <p>Market: <strong>{sharkListings.length}</strong> listings{currentSlug ? ` for "${currentSlug}"` : ''}</p>
            <p>JotForm: <strong>{jfSubmissions.length}</strong> submissions{totalNewSubmissions > 0 ? ` · ${totalNewSubmissions} unread` : ''}</p>
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
          <article className="stat-card">
            <p className="stat-label">Market Listings</p>
            <p className="stat-value">{sharkListings.length || '—'}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">New Inquiries</p>
            <p className="stat-value">{jfLoading ? '…' : totalNewSubmissions || '—'}</p>
          </article>
        </section>

        <div className="tab-row">
          <div className="tab-bar">
            <button
              className={`tab-btn${activeTab === 'dashboard' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
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
            <button
              className={`tab-btn${activeTab === 'market' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('market')}
            >
              Market Prices
            </button>
            <button
              className={`tab-btn${activeTab === 'jotform' ? ' tab-active' : ''}${totalNewSubmissions > 0 ? ' tab-has-badge' : ''}`}
              onClick={() => setActiveTab('jotform')}
            >
              Inquiries
              {totalNewSubmissions > 0 && (
                <span className="tab-badge">{totalNewSubmissions}</span>
              )}
            </button>
          </div>
          <button onClick={refetch} disabled={loading} className="refresh-button">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* ── Business Metrics Dashboard Tab ── */}
        {activeTab === 'dashboard' && (
          <div className="biz-dashboard">

            {/* Row 1: KPI cards */}
            <div className="biz-kpi-row">

              {/* Incoming Gear Submissions */}
              <article className="biz-kpi-card biz-kpi-blue">
                <div className="biz-kpi-header">
                  <span className="biz-kpi-label">Incoming Submissions</span>
                </div>
                <p className="biz-kpi-value">{jfLoading ? '…' : jfSubmissions.length.toLocaleString()}</p>
                <p className="biz-kpi-sub">
                  <strong className="biz-kpi-accent">{thisWeekSubs.length}</strong> this week
                  &nbsp;·&nbsp;
                  <strong className="biz-kpi-accent">{recentSubs.length}</strong> last 30 days
                  {totalNewSubmissions > 0 && (
                    <>
                      &nbsp;·&nbsp;
                      <span className="biz-kpi-alert">{totalNewSubmissions} unread</span>
                    </>
                  )}
                </p>
              </article>

              {/* Deals in Progress */}
              <article className="biz-kpi-card biz-kpi-amber">
                <div className="biz-kpi-header">
                  <span className="biz-kpi-label">Deals in Progress</span>
                </div>
                <p className="biz-kpi-value">{spLoading ? '…' : draftProducts.length}</p>
                <p className="biz-kpi-sub">
                  <strong className="biz-kpi-accent">{activeProducts.length}</strong> active
                  &nbsp;·&nbsp;
                  <strong className="biz-kpi-accent">{archivedProducts.length}</strong> archived/sold
                </p>
              </article>

              {/* Inventory Value */}
              <article className="biz-kpi-card biz-kpi-green">
                <div className="biz-kpi-header">
                  <span className="biz-kpi-label">Inventory Value</span>
                </div>
                <p className="biz-kpi-value">
                  {spLoading ? '…' : inventoryValue > 0
                    ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                    : '—'
                  }
                </p>
                <p className="biz-kpi-sub">
                  Active listings at ask price
                  &nbsp;·&nbsp;
                  avg <strong className="biz-kpi-accent">
                    {spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'}
                  </strong>
                </p>
              </article>

              {/* Acquisition Cost */}
              <article className="biz-kpi-card biz-kpi-purple">
                <div className="biz-kpi-header">
                  <span className="biz-kpi-label">Acquisition Costs</span>
                </div>
                <p className="biz-kpi-value">
                  {atLoading ? '…' : acquisitionCost > 0
                    ? `$${acquisitionCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                    : '—'
                  }
                </p>
                <p className="biz-kpi-sub">
                  From <strong className="biz-kpi-accent">{nonEmptyListings.length}</strong> Airtable records
                </p>
              </article>

              {/* Profit Margin */}
              <article className="biz-kpi-card biz-kpi-teal">
                <div className="biz-kpi-header">
                  <span className="biz-kpi-label">Profit Margin</span>
                </div>
                <p className="biz-kpi-value">
                  {grossMarginPct !== null ? `${grossMarginPct}%` : '—'}
                </p>
                <p className="biz-kpi-sub">
                  {grossMarginPct !== null
                    ? `Ask vs acquisition across active inventory`
                    : 'Add prices to Airtable to calculate'
                  }
                </p>
              </article>

            </div>{/* end kpi-row */}

            {/* Row 2: two-column layout */}
            <div className="biz-row2">

              {/* Submission volume chart */}
              <section className="biz-panel">
                <h2 className="biz-panel-title">Submission Volume <span className="biz-panel-sub">Last 14 days</span></h2>
                {jfLoading ? (
                  <div className="loading-panel" style={{ padding: '1.5rem 0' }}>
                    <div className="loader" />
                    <p>Loading…</p>
                  </div>
                ) : (
                  <div className="biz-bar-chart">
                    {submissionDays.map((d, i) => (
                      <div key={i} className="biz-bar-col">
                        <div
                          className="biz-bar"
                          style={{ height: `${Math.round((d.count / maxDayCount) * 100)}%` }}
                          title={`${d.label}: ${d.count}`}
                        />
                        <span className="biz-bar-label">{d.label.split(' ')[1]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Sales performance */}
              <section className="biz-panel">
                <h2 className="biz-panel-title">Sales Performance</h2>
                <div className="biz-perf-grid">
                  <div className="biz-perf-item">
                    <span className="biz-perf-label">Total Listings</span>
                    <span className="biz-perf-val">{spLoading ? '…' : products.length}</span>
                  </div>
                  <div className="biz-perf-item">
                    <span className="biz-perf-label">Active</span>
                    <span className="biz-perf-val biz-val-green">{spLoading ? '…' : activeProducts.length}</span>
                  </div>
                  <div className="biz-perf-item">
                    <span className="biz-perf-label">Draft / Pending</span>
                    <span className="biz-perf-val biz-val-amber">{spLoading ? '…' : draftProducts.length}</span>
                  </div>
                  <div className="biz-perf-item">
                    <span className="biz-perf-label">Sold / Archived</span>
                    <span className="biz-perf-val biz-val-muted">{spLoading ? '…' : archivedProducts.length}</span>
                  </div>
                  <div className="biz-perf-item">
                    <span className="biz-perf-label">Avg Ask Price</span>
                    <span className="biz-perf-val">
                      {spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div className="biz-perf-item">
                    <span className="biz-perf-label">Total Ask Value</span>
                    <span className="biz-perf-val biz-val-green">
                      {spLoading ? '…' : inventoryValue > 0 ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                    </span>
                  </div>
                  <div className="biz-perf-item">
                    <span className="biz-perf-label">Gross Margin</span>
                    <span className={`biz-perf-val${grossMarginPct !== null && grossMarginPct > 0 ? ' biz-val-green' : ''}`}>
                      {grossMarginPct !== null ? `${grossMarginPct}%` : '—'}
                    </span>
                  </div>
                  <div className="biz-perf-item">
                    <span className="biz-perf-label">Potential Profit</span>
                    <span className="biz-perf-val biz-val-green">
                      {acquisitionCost > 0 && totalAsk > 0
                        ? `$${(totalAsk - acquisitionCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                        : '—'
                      }
                    </span>
                  </div>
                </div>
              </section>

            </div>{/* end row2 */}

            {/* Row 3: Top brands + recent submissions */}
            <div className="biz-row3">

              {/* Top requested brands */}
              <section className="biz-panel">
                <h2 className="biz-panel-title">Top Requested Brands <span className="biz-panel-sub">From last 500 submissions</span></h2>
                {jfLoading ? (
                  <div className="loading-panel" style={{ padding: '1rem 0' }}>
                    <div className="loader" /><p>Loading…</p>
                  </div>
                ) : topBrands.length > 0 ? (
                  <ul className="biz-brand-list">
                    {topBrands.map(([brand, count]) => (
                      <li key={brand} className="biz-brand-item">
                        <span className="biz-brand-name">{brand}</span>
                        <div className="biz-brand-bar-wrap">
                          <div
                            className="biz-brand-bar"
                            style={{ width: `${Math.round((count / topBrands[0][1]) * 100)}%` }}
                          />
                        </div>
                        <span className="biz-brand-count">{count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--muted)', margin: 0 }}>No brand data yet.</p>
                )}
              </section>

              {/* Recent submissions feed */}
              <section className="biz-panel">
                <h2 className="biz-panel-title">Recent Submissions <span className="biz-panel-sub">Latest 8</span></h2>
                {jfLoading ? (
                  <div className="loading-panel" style={{ padding: '1rem 0' }}>
                    <div className="loader" /><p>Loading…</p>
                  </div>
                ) : (
                  <ul className="biz-feed">
                    {jfSubmissions.slice(0, 8).map(sub => {
                      const sortedAnswers = Object.values(sub.answers)
                        .filter(a => formatAnswer(a.answer))
                        .sort((a, b) => Number(a.order) - Number(b.order));
                      const name = formatAnswer(sortedAnswers.find(a => /name/i.test(a.text || ''))?.answer) || formatAnswer(sortedAnswers[0]?.answer) || 'Unknown';
                      const brandAnswer = sortedAnswers.find(a => /brand/i.test(a.text || ''));
                      const modelAnswer = sortedAnswers.find(a => /model/i.test(a.text || ''));
                      const brand = formatAnswer(brandAnswer?.answer);
                      const model = formatAnswer(modelAnswer?.answer);
                      const submittedAt = new Date(sub.created_at);
                      const isNew = sub.new === '1';
                      const minutesAgo = Math.round((now - submittedAt.getTime()) / 60000);
                      const timeLabel = minutesAgo < 60
                        ? `${minutesAgo}m ago`
                        : minutesAgo < 1440
                          ? `${Math.round(minutesAgo / 60)}h ago`
                          : submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                      return (
                        <li key={sub.id} className={`biz-feed-item${isNew ? ' biz-feed-new' : ''}`}>
                          <div className="biz-feed-left">
                            {isNew && <span className="jf-dot" style={{ flexShrink: 0 }} />}
                            <div>
                              <p className="biz-feed-name">{name}</p>
                              {(brand || model) && (
                                <p className="biz-feed-gear">
                                  {[brand, model].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="biz-feed-time">{timeLabel}</span>
                        </li>
                      );
                    })}
                    {jfSubmissions.length === 0 && (
                      <li style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No submissions loaded.</li>
                    )}
                  </ul>
                )}
                <button
                  className="biz-view-all"
                  onClick={() => setActiveTab('jotform')}
                >
                  View all {jfSubmissions.length.toLocaleString()} submissions →
                </button>
              </section>

            </div>{/* end row3 */}

          </div>
        )}

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
        {/* ── Market Prices Tab ── */}
        {activeTab === 'market' && (
          <>
            <section className="panel shark-search-panel">
              <form onSubmit={handleSharkSearch} className="shark-form">
                <div className="shark-form-inner">
                  <div className="shark-input-group">
                    <label htmlFor="shark-input" className="shark-label">
                      Model Slug
                    </label>
                    <input
                      id="shark-input"
                      ref={sharkInputRef}
                      type="text"
                      className="shark-input"
                      placeholder="e.g. accuphase-e-530"
                      defaultValue={currentSlug}
                    />
                  </div>
                  <button type="submit" className="refresh-button" disabled={sharkLoading}>
                    {sharkLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
                <p className="shark-hint">
                  Enter a HiFiShark model slug from{' '}
                  <code>hifishark.com/model/<strong>accuphase-e-530</strong></code>.
                  You can also click a model in the Airtable tab to pre-fill.
                </p>
              </form>
            </section>

            {sharkError && (
              <section className="panel error-panel" style={{ marginTop: '0.75rem' }}>
                <p className="error-title">Error loading market data</p>
                <p className="error-message">{sharkError.message}</p>
              </section>
            )}

            {sharkLoading && (
              <section className="panel loading-panel" style={{ marginTop: '0.75rem' }}>
                <div className="loader" />
                <p>Fetching market listings from HiFiShark…</p>
              </section>
            )}

            {!sharkLoading && sharkListings.length > 0 && (
              <section className="panel listings-panel" style={{ marginTop: '0.75rem' }}>
                <p className="listings-summary">
                  <strong>{sharkListings.length}</strong> listings found for <code>{currentSlug}</code>
                  {' · '}
                  {sharkListings.filter(l => l.price).length} with prices
                  {' · '}
                  lowest{' '}
                  <strong>
                    {(() => {
                      const priced = sharkListings.filter(l => l.priceNumeric && l.currency === 'USD');
                      if (!priced.length) return 'N/A';
                      const min = Math.min(...priced.map(l => l.priceNumeric!));
                      return `$${min.toLocaleString()}`;
                    })()}
                  </strong>
                </p>
                <div className="shark-table-wrap">
                  <table className="shark-table">
                    <thead>
                      <tr>
                        <th>Listing</th>
                        <th>Site</th>
                        <th>Country</th>
                        <th>Price</th>
                        <th>Listed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharkListings.map((listing) => (
                        <tr key={listing.id} className="shark-row">
                          <td>
                            <a
                              href={listing.url}
                              target="_blank"
                              rel="noreferrer"
                              className="shark-link"
                            >
                              {listing.title || '(no title)'}
                            </a>
                          </td>
                          <td className="shark-cell-muted">{listing.site || '—'}</td>
                          <td className="shark-cell-muted">{listing.country || '—'}</td>
                          <td className="shark-price">
                            {listing.price ? (
                              <span className={`price-tag currency-${listing.currency.toLowerCase()}`}>
                                {listing.price}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="shark-cell-muted shark-date">{listing.listedDate || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {!sharkLoading && !sharkError && sharkListings.length === 0 && currentSlug && (
              <section className="panel empty-panel" style={{ marginTop: '0.75rem' }}>
                <p className="empty-title">No listings found</p>
                <p>Try a different slug or check if the model exists on HiFiShark.</p>
              </section>
            )}

            {!currentSlug && !sharkLoading && (
              <section className="panel empty-panel" style={{ marginTop: '0.75rem' }}>
                <p className="empty-title">Search for a model above</p>
                <p>Example slugs: <code>accuphase-e-530</code>, <code>naim-nac-282</code>, <code>wilson-audio-sasha</code></p>
              </section>
            )}
          </>
        )}

        {/* ── JotForm Inquiries Tab ── */}
        {activeTab === 'jotform' && (
          <>
            {/* Live polling status bar */}
            <div className="jf-status-bar">
              <div className="jf-status-left">
                <span className={`jf-live-dot${jfPolling ? ' jf-live-polling' : ''}`} />
                <span className="jf-live-label">Live · Request a Quote</span>
                {jfLastUpdated && (
                  <span className="jf-status-updated">
                    Updated {jfLastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                {jfPolling && <span className="jf-polling-text">Checking…</span>}
              </div>
              <div className="jf-status-right">
                {!jfLoading && jfSubmissions.length > 0 && (
                  <span className="jf-status-count">
                    {jfSubmissions.length.toLocaleString()} submissions
                    {totalNewSubmissions > 0 && (
                      <> · <span className="jf-new-count">{totalNewSubmissions.toLocaleString()} unread</span></>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* New-submissions-since-load alert */}
            {jfFreshCount > 0 && (
              <div className="jf-fresh-banner">
                <span>
                  🔔 <strong>{jfFreshCount}</strong> new submission{jfFreshCount !== 1 ? 's' : ''} received since you opened this page
                </span>
                <button
                  className="jf-fresh-dismiss"
                  onClick={() => { jfClearFresh(); jfRefetch(); }}
                >
                  Reload list
                </button>
              </div>
            )}

            {jfError && (
              <section className="panel error-panel" style={{ marginTop: '0.75rem' }}>
                <p className="error-title">Error loading submissions</p>
                <p className="error-message">{jfError.message}</p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Make sure <code>VITE_JOTFORM_API_KEY</code> and <code>VITE_JOTFORM_FORM_ID</code> are set in <code>.env.local</code>.
                </p>
              </section>
            )}

            {jfLoading && (
              <section className="panel loading-panel" style={{ marginTop: '0.75rem' }}>
                <div className="loader" />
                <p>Loading submissions from JotForm…</p>
              </section>
            )}

            {!jfLoading && jfSubmissions.filter(s => s.status === 'ACTIVE').length > 0 && (
              <section className="panel jf-subs-panel" style={{ marginTop: '0.75rem' }}>
                <ul className="jf-sub-list">
                  {jfSubmissions
                    .filter(s => s.status === 'ACTIVE')
                    .map(sub => {
                      const isExpanded = expandedSubmissionId === sub.id;
                      const isNew = sub.new === '1';
                      const sortedAnswers = Object.values(sub.answers)
                        .filter(a => formatAnswer(a.answer))
                        .sort((a, b) => Number(a.order) - Number(b.order));
                      const previewAnswer = sortedAnswers[0];
                      const submittedAt = new Date(sub.created_at);

                      return (
                        <li
                          key={sub.id}
                          className={`jf-sub-item${isNew ? ' jf-sub-new' : ''}${isExpanded ? ' jf-sub-expanded' : ''}`}
                        >
                          <div
                            className="jf-sub-header"
                            onClick={() => setExpandedSubmissionId(isExpanded ? null : sub.id)}
                          >
                            <div className="jf-sub-left">
                              {isNew && <span className="jf-dot" />}
                              <div className="jf-sub-preview">
                                <span className="jf-sub-primary">
                                  {previewAnswer ? formatAnswer(previewAnswer.answer) : `Submission #${sub.id}`}
                                </span>
                                {sortedAnswers[1] && (
                                  <span className="jf-sub-secondary">
                                    {formatAnswer(sortedAnswers[1].answer)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="jf-sub-right">
                              <span className="jf-sub-date">
                                {submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              <span className="jf-sub-chevron">{isExpanded ? '▾' : '›'}</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="jf-sub-body">
                              <dl className="jf-answers">
                                {sortedAnswers.map(answer => (
                                  <div key={answer.name} className="jf-answer-row">
                                    <dt className="jf-answer-label">{answer.text || answer.name}</dt>
                                    <dd className="jf-answer-value">{formatAnswer(answer.answer)}</dd>
                                  </div>
                                ))}
                              </dl>
                              <p className="jf-sub-timestamp">
                                Submitted {submittedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                {sub.ip && ` · IP ${sub.ip}`}
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </section>
            )}

            {!jfLoading && !jfError && jfSubmissions.filter(s => s.status === 'ACTIVE').length === 0 && (
              <section className="panel empty-panel" style={{ marginTop: '0.75rem' }}>
                <p className="empty-title">No submissions yet</p>
                <p>Submissions will appear here automatically as your form receives responses.</p>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
