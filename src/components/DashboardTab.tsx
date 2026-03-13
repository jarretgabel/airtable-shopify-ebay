import { formatAnswer } from '@/services/jotform';
import type { JotFormSubmission } from '@/types/jotform';

type DashboardTargetTab = 'jotform' | 'shopify' | 'airtable';

interface TrendSummary {
  direction: 'up' | 'down' | 'flat';
  text: string;
}

interface AirtableListing {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface ShopifyVariant {
  price?: string;
  inventory_quantity?: number;
}

interface ShopifyProduct {
  id: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  variants?: ShopifyVariant[];
}

interface DashboardTabProps {
  atLoading: boolean;
  spLoading: boolean;
  jfLoading: boolean;
  nonEmptyListings: AirtableListing[];
  products: ShopifyProduct[];
  jfSubmissions: JotFormSubmission[];
  totalNewSubmissions: number;
  thisWeekSubs: JotFormSubmission[];
  recentSubs: JotFormSubmission[];
  draftProducts: ShopifyProduct[];
  activeProducts: ShopifyProduct[];
  archivedProducts: ShopifyProduct[];
  acquisitionCost: number;
  inventoryValue: number;
  avgAskPrice: number;
  sellThroughPct: number | null;
  grossMarginPct: number | null;
  submissionsTrend: TrendSummary;
  dealsTrend: TrendSummary;
  acquisitionTrend: TrendSummary;
  inventoryTrend: TrendSummary;
  salesTrend: TrendSummary;
  marginTrend: TrendSummary;
  submissionDays: Array<{ label: string; count: number }>;
  maxDayCount: number;
  topBrands: Array<[string, number]>;
  now: number;
  airtableInventoryValue: number;
  uniqueAirtableBrands: number;
  uniqueAirtableTypes: number;
  componentTypeSummary: Array<[string, number]>;
  airtableBrandSummary: Array<[string, number]>;
  airtableDistributorSummary: Array<[string, { count: number; total: number }]>;
  airtableTypeTable: Array<{
    type: string;
    count: number;
    brandCount: number;
    averagePrice: number;
    totalPrice: number;
  }>;
  maxComponentTypeCount: number;
  maxAirtableBrandCount: number;
  onSelectTab: (tab: DashboardTargetTab) => void;
}

export function DashboardTab({
  atLoading,
  spLoading,
  jfLoading,
  nonEmptyListings,
  products,
  jfSubmissions,
  totalNewSubmissions,
  thisWeekSubs,
  recentSubs,
  draftProducts,
  activeProducts,
  archivedProducts,
  acquisitionCost,
  inventoryValue,
  avgAskPrice,
  sellThroughPct,
  grossMarginPct,
  submissionsTrend,
  dealsTrend,
  acquisitionTrend,
  inventoryTrend,
  salesTrend,
  marginTrend,
  submissionDays,
  maxDayCount,
  topBrands,
  now,
  airtableInventoryValue,
  uniqueAirtableBrands,
  uniqueAirtableTypes,
  componentTypeSummary,
  airtableBrandSummary,
  airtableDistributorSummary,
  airtableTypeTable,
  maxComponentTypeCount,
  maxAirtableBrandCount,
  onSelectTab,
}: DashboardTabProps) {
  const profitableItems = activeProducts.filter((product) => {
    const ask = parseFloat(product.variants?.[0]?.price ?? '0') || 0;
    return ask > 0;
  });
  const totalAsk = profitableItems.reduce((sum, product) => sum + (parseFloat(product.variants?.[0]?.price ?? '0') || 0), 0);
  const submissionWindowTotal = submissionDays.reduce((sum, day) => sum + day.count, 0);
  const submissionAverage = submissionDays.length ? submissionWindowTotal / submissionDays.length : 0;
  const activeSubmissionDays = submissionDays.filter((day) => day.count > 0).length;
  const peakSubmissionDay = submissionDays.reduce<{ label: string; count: number } | null>((peak, day) => {
    if (!peak || day.count > peak.count) {
      return day;
    }
    return peak;
  }, null);
  const peakSubmissionShare = submissionWindowTotal > 0 && peakSubmissionDay
    ? Math.round((peakSubmissionDay.count / submissionWindowTotal) * 100)
    : 0;
  const chartGuideValues = [maxDayCount, Math.max(1, Math.round(maxDayCount / 2))];

  return (
    <div className="biz-dashboard">
      <section className="biz-stats-section">
        <div className="biz-stats-heading">
          <p className="biz-stats-kicker">Dashboard Stats</p>
          <h2 className="biz-stats-title">Operations Snapshot</h2>
          <p className="biz-stats-copy">
            A quick read on submissions, pipeline health, capital deployed, inventory exposure, sales velocity, and margin.
          </p>
        </div>

        <div className="biz-kpi-row">
          <button type="button" className="biz-kpi-card biz-kpi-card-button biz-kpi-blue" onClick={() => onSelectTab('jotform')}>
            <div className="biz-kpi-header">
              <span className="biz-kpi-label">Incoming Gear Submissions</span>
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
            <p className={`biz-kpi-trend biz-kpi-trend-${submissionsTrend.direction}`}>{submissionsTrend.text}</p>
          </button>

          <button type="button" className="biz-kpi-card biz-kpi-card-button biz-kpi-amber" onClick={() => onSelectTab('shopify')}>
            <div className="biz-kpi-header">
              <span className="biz-kpi-label">Deals in Progress</span>
            </div>
            <p className="biz-kpi-value">{spLoading ? '…' : draftProducts.length}</p>
            <p className="biz-kpi-sub">
              <strong className="biz-kpi-accent">{activeProducts.length}</strong> live inventory
              &nbsp;·&nbsp;
              <strong className="biz-kpi-accent">{archivedProducts.length}</strong> closed out
            </p>
            <p className={`biz-kpi-trend biz-kpi-trend-${dealsTrend.direction}`}>{dealsTrend.text}</p>
          </button>

          <button type="button" className="biz-kpi-card biz-kpi-card-button biz-kpi-purple" onClick={() => onSelectTab('airtable')}>
            <div className="biz-kpi-header">
              <span className="biz-kpi-label">Acquisition Costs</span>
            </div>
            <p className="biz-kpi-value">
              {atLoading ? '…' : acquisitionCost > 0
                ? `$${acquisitionCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : '—'}
            </p>
            <p className="biz-kpi-sub">
              Using Airtable <strong className="biz-kpi-accent">Price</strong> from {nonEmptyListings.length} records
            </p>
            <p className={`biz-kpi-trend biz-kpi-trend-${acquisitionTrend.direction}`}>{acquisitionTrend.text}</p>
          </button>

          <button type="button" className="biz-kpi-card biz-kpi-card-button biz-kpi-green" onClick={() => onSelectTab('shopify')}>
            <div className="biz-kpi-header">
              <span className="biz-kpi-label">Inventory Value</span>
            </div>
            <p className="biz-kpi-value">
              {spLoading ? '…' : inventoryValue > 0
                ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : '—'}
            </p>
            <p className="biz-kpi-sub">
              Active listings at ask price
              &nbsp;·&nbsp;
              avg <strong className="biz-kpi-accent">{spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'}</strong>
            </p>
            <p className={`biz-kpi-trend biz-kpi-trend-${inventoryTrend.direction}`}>{inventoryTrend.text}</p>
          </button>

          <button type="button" className="biz-kpi-card biz-kpi-card-button biz-kpi-slate" onClick={() => onSelectTab('shopify')}>
            <div className="biz-kpi-header">
              <span className="biz-kpi-label">Sales Performance</span>
            </div>
            <p className="biz-kpi-value">{sellThroughPct !== null ? `${sellThroughPct}%` : '—'}</p>
            <p className="biz-kpi-sub">
              <strong className="biz-kpi-accent">{archivedProducts.length}</strong> sold or archived
              &nbsp;·&nbsp;
              sell-through rate
            </p>
            <p className={`biz-kpi-trend biz-kpi-trend-${salesTrend.direction}`}>{salesTrend.text}</p>
          </button>

          <button type="button" className="biz-kpi-card biz-kpi-card-button biz-kpi-teal" onClick={() => onSelectTab('airtable')}>
            <div className="biz-kpi-header">
              <span className="biz-kpi-label">Profit Margins</span>
            </div>
            <p className="biz-kpi-value">{grossMarginPct !== null ? `${grossMarginPct}%` : '—'}</p>
            <p className="biz-kpi-sub">
              {grossMarginPct !== null ? 'Derived from Shopify ask value and Airtable Price' : 'Add numeric Airtable prices to calculate'}
            </p>
            <p className={`biz-kpi-trend biz-kpi-trend-${marginTrend.direction}`}>{marginTrend.text}</p>
          </button>
        </div>
      </section>

      <section className="biz-panel biz-inventory-snapshot-panel">
        <div className="biz-section-head">
          <div>
            <h2 className="biz-panel-title">Airtable Inventory Recap <span className="biz-panel-sub">All products in Airtable</span></h2>
          </div>
          <button type="button" className="biz-view-all" onClick={() => onSelectTab('airtable')}>
            Open Airtable Inventory →
          </button>
        </div>

        {atLoading ? (
          <div className="loading-panel" style={{ padding: '0.5rem 0' }}>
            <div className="loader" />
            <p>Loading Airtable inventory…</p>
          </div>
        ) : nonEmptyListings.length > 0 ? (
          <>
            <div className="biz-inventory-summary-row">
              <article className="biz-mini-stat">
                <span className="biz-mini-stat-label">Products</span>
                <strong className="biz-mini-stat-value">{nonEmptyListings.length}</strong>
              </article>
              <article className="biz-mini-stat">
                <span className="biz-mini-stat-label">Brands</span>
                <strong className="biz-mini-stat-value">{uniqueAirtableBrands}</strong>
              </article>
              <article className="biz-mini-stat">
                <span className="biz-mini-stat-label">Component Types</span>
                <strong className="biz-mini-stat-value">{uniqueAirtableTypes}</strong>
              </article>
              <article className="biz-mini-stat">
                <span className="biz-mini-stat-label">Tagged Value</span>
                <strong className="biz-mini-stat-value">
                  {airtableInventoryValue > 0 ? `$${airtableInventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                </strong>
              </article>
            </div>

            <div className="biz-inventory-recap-grid">
              <section className="biz-subpanel">
                <h3 className="biz-subpanel-title">By Component Type</h3>
                <ul className="biz-summary-bars">
                  {componentTypeSummary.map(([label, count]) => (
                    <li key={label} className="biz-summary-bar-row">
                      <span className="biz-summary-bar-label">{label}</span>
                      <div className="biz-summary-bar-track">
                        <div className="biz-summary-bar-fill biz-summary-bar-fill-type" style={{ width: `${Math.round((count / maxComponentTypeCount) * 100)}%` }} />
                      </div>
                      <span className="biz-summary-bar-value">{count}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="biz-subpanel">
                <h3 className="biz-subpanel-title">Top Brands</h3>
                <ul className="biz-summary-bars">
                  {airtableBrandSummary.map(([label, count]) => (
                    <li key={label} className="biz-summary-bar-row">
                      <span className="biz-summary-bar-label">{label}</span>
                      <div className="biz-summary-bar-track">
                        <div className="biz-summary-bar-fill biz-summary-bar-fill-brand" style={{ width: `${Math.round((count / maxAirtableBrandCount) * 100)}%` }} />
                      </div>
                      <span className="biz-summary-bar-value">{count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="biz-inventory-recap-grid">
              <section className="biz-subpanel">
                <h3 className="biz-subpanel-title">By Distributor</h3>
                <div className="biz-summary-table-wrap">
                  <table className="biz-summary-table">
                    <thead>
                      <tr>
                        <th>Distributor</th>
                        <th>Products</th>
                        <th>Tagged Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {airtableDistributorSummary.map(([distributor, summary]) => (
                        <tr key={distributor}>
                          <td>{distributor}</td>
                          <td>{summary.count}</td>
                          <td>{summary.total > 0 ? `$${summary.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="biz-subpanel">
                <h3 className="biz-subpanel-title">Component Summary</h3>
                <div className="biz-summary-table-wrap">
                  <table className="biz-summary-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Products</th>
                        <th>Brands</th>
                        <th>Avg Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {airtableTypeTable.map((row) => (
                        <tr key={row.type}>
                          <td>{row.type}</td>
                          <td>{row.count}</td>
                          <td>{row.brandCount}</td>
                          <td>{row.averagePrice > 0 ? `$${Math.round(row.averagePrice).toLocaleString()}` : '—'}</td>
                          <td>{row.totalPrice > 0 ? `$${row.totalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        ) : (
          <p className="biz-empty-copy">No Airtable inventory records available yet.</p>
        )}
      </section>

      <div className="biz-row2">
        <section className="biz-panel">
          <h2 className="biz-panel-title">Submission Volume <span className="biz-panel-sub">Last 14 days</span></h2>
          {jfLoading ? (
            <div className="loading-panel" style={{ padding: '1.5rem 0' }}>
              <div className="loader" />
              <p>Loading…</p>
            </div>
          ) : (
            <>
              <div className="biz-chart-summary-row">
                <div className="biz-chart-stat">
                  <span className="biz-chart-stat-label">14-day total</span>
                  <strong className="biz-chart-stat-value">{submissionWindowTotal}</strong>
                </div>
                <div className="biz-chart-stat">
                  <span className="biz-chart-stat-label">Average / day</span>
                  <strong className="biz-chart-stat-value">{submissionAverage.toFixed(1)}</strong>
                </div>
                <div className="biz-chart-stat">
                  <span className="biz-chart-stat-label">Peak day</span>
                  <strong className="biz-chart-stat-value">{peakSubmissionDay ? `${peakSubmissionDay.count} on ${peakSubmissionDay.label}` : 'No activity'}</strong>
                </div>
              </div>

              <div className="biz-bar-chart-card">
                <div className="biz-bar-chart-meta">
                  <p className="biz-bar-chart-note">
                    <strong>{activeSubmissionDays}</strong> active days in the last two weeks
                  </p>
                  <p className="biz-bar-chart-note">
                    Peak day represented <strong>{peakSubmissionShare}%</strong> of inbound volume
                  </p>
                </div>
                <div className="biz-bar-chart-wrap">
                  <div className="biz-axis-header">
                    <span className="biz-axis-label biz-axis-label-y">Submissions per day</span>
                  </div>
                  <div className="biz-bar-chart-plot">
                    <div className="biz-bar-chart-guides" aria-hidden="true">
                      {chartGuideValues.map((value, index) => (
                        <div
                          key={`${value}-${index}`}
                          className={`biz-bar-guide-line ${index === 0 ? 'biz-bar-guide-line-top' : 'biz-bar-guide-line-mid'}`}
                        >
                          <span className="biz-bar-guide-label">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="biz-bar-chart-baseline" aria-hidden="true">
                      <span className="biz-bar-guide-label biz-bar-guide-label-baseline">0</span>
                    </div>
                    <div className="biz-bar-chart">
                      {submissionDays.map((day, index) => {
                        const height = maxDayCount > 0
                          ? day.count > 0
                            ? Math.max(8, Math.round((day.count / maxDayCount) * 100))
                            : 0
                          : 0;
                        const isPeak = peakSubmissionDay?.label === day.label && peakSubmissionDay?.count === day.count && day.count > 0;
                        const hasVolume = day.count > 0;

                        return (
                          <div key={index} className="biz-bar-col">
                            <div className="biz-bar-slot">
                              <div className="biz-bar-track">
                                <div
                                  className={`biz-bar${hasVolume ? ' biz-bar-has-volume' : ' biz-bar-empty'}${isPeak ? ' biz-bar-peak' : ''}`}
                                  style={{ height: `${height}%` }}
                                  title={`${day.label}: ${day.count} submissions`}
                                  aria-label={`${day.label}: ${day.count} submissions`}
                                >
                                  {isPeak && <span className="biz-bar-cap" aria-hidden="true" />}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="biz-bar-chart-labels">
                    {submissionDays.map((day, index) => {
                      const dayLabel = day.label.split(' ')[1] ?? day.label;

                      return (
                        <span key={`${day.label}-${index}`} className="biz-bar-label">{dayLabel}</span>
                      );
                    })}
                  </div>
                  <div className="biz-axis-footer">
                    <span className="biz-axis-label biz-axis-label-x">Date</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

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
              <span className="biz-perf-val">{spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'}</span>
            </div>
            <div className="biz-perf-item">
              <span className="biz-perf-label">Total Ask Value</span>
              <span className="biz-perf-val biz-val-green">{spLoading ? '…' : inventoryValue > 0 ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
            </div>
            <div className="biz-perf-item">
              <span className="biz-perf-label">Gross Margin</span>
              <span className={`biz-perf-val${grossMarginPct !== null && grossMarginPct > 0 ? ' biz-val-green' : ''}`}>{grossMarginPct !== null ? `${grossMarginPct}%` : '—'}</span>
            </div>
            <div className="biz-perf-item">
              <span className="biz-perf-label">Potential Profit</span>
              <span className="biz-perf-val biz-val-green">
                {acquisitionCost > 0 && totalAsk > 0 ? `$${(totalAsk - acquisitionCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="biz-row3">
        <section className="biz-panel">
          <h2 className="biz-panel-title">Top Requested Brands <span className="biz-panel-sub">From last 500 submissions</span></h2>
          {jfLoading ? (
            <div className="loading-panel" style={{ padding: '1rem 0' }}>
              <div className="loader" />
              <p>Loading…</p>
            </div>
          ) : topBrands.length > 0 ? (
            <ul className="biz-brand-list">
              {topBrands.map(([brand, count]) => (
                <li key={brand} className="biz-brand-item">
                  <span className="biz-brand-name">{brand}</span>
                  <div className="biz-brand-bar-wrap">
                    <div className="biz-brand-bar" style={{ width: `${Math.round((count / topBrands[0][1]) * 100)}%` }} />
                  </div>
                  <span className="biz-brand-count">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)', margin: 0 }}>No brand data yet.</p>
          )}
        </section>

        <section className="biz-panel">
          <h2 className="biz-panel-title">Recent Submissions <span className="biz-panel-sub">Latest 8</span></h2>
          {jfLoading ? (
            <div className="loading-panel" style={{ padding: '1rem 0' }}>
              <div className="loader" />
              <p>Loading…</p>
            </div>
          ) : (
            <>
              <ul className="biz-feed">
                {jfSubmissions.slice(0, 8).map((submission) => {
                  const sortedAnswers = Object.values(submission.answers)
                    .filter((answer) => formatAnswer(answer.answer))
                    .sort((a, b) => Number(a.order) - Number(b.order));
                  const name = formatAnswer(sortedAnswers.find((answer) => /name/i.test(answer.text || ''))?.answer) || formatAnswer(sortedAnswers[0]?.answer) || 'Unknown';
                  const brandAnswer = sortedAnswers.find((answer) => /brand/i.test(answer.text || ''));
                  const modelAnswer = sortedAnswers.find((answer) => /model/i.test(answer.text || ''));
                  const brand = formatAnswer(brandAnswer?.answer);
                  const model = formatAnswer(modelAnswer?.answer);
                  const submittedAt = new Date(submission.created_at);
                  const isNew = submission.new === '1';
                  const minutesAgo = Math.round((now - submittedAt.getTime()) / 60000);
                  const timeLabel = minutesAgo < 60
                    ? `${minutesAgo}m ago`
                    : minutesAgo < 1440
                      ? `${Math.round(minutesAgo / 60)}h ago`
                      : submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                    <li key={submission.id} className={`biz-feed-item${isNew ? ' biz-feed-new' : ''}`}>
                      <div className="biz-feed-left">
                        {isNew && <span className="jf-dot" style={{ flexShrink: 0 }} />}
                        <div>
                          <p className="biz-feed-name">{name}</p>
                          {(brand || model) && <p className="biz-feed-gear">{[brand, model].filter(Boolean).join(' · ')}</p>}
                        </div>
                      </div>
                      <div className="biz-feed-right">
                        <span className="biz-feed-time">{timeLabel}</span>
                        <button type="button" className="biz-feed-link" onClick={() => onSelectTab('jotform')}>
                          View
                        </button>
                      </div>
                    </li>
                  );
                })}
                {jfSubmissions.length === 0 && <li style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No submissions loaded.</li>}
              </ul>
              <button className="biz-view-all" onClick={() => onSelectTab('jotform')}>
                View all {jfSubmissions.length.toLocaleString()} submissions →
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}