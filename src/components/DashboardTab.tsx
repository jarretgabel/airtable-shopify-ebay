import { useEffect, useMemo, useState } from 'react';
import { AppPage, PAGE_DEFINITIONS } from '@/auth/pages';
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav';
import { spinnerClass } from '@/components/tabs/uiClasses';
import { formatAnswer } from '@/services/jotform';
import type { JotFormSubmission } from '@/types/jotform';

type DashboardTargetTab = AppPage;

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
  insights: Array<{
    id: string;
    title: string;
    detail: string;
    severity: 'critical' | 'warning' | 'info' | 'positive';
    targetTab?: DashboardTargetTab;
  }>;
  accessiblePages: AppPage[];
  approvalLoading: boolean;
  approvalError: string | null;
  approvalTotal: number;
  approvalApproved: number;
  approvalPending: number;
  aiProvider: 'github' | 'openai' | 'none';
  ebayAuthenticated: boolean;
  ebayRestoringSession: boolean;
  ebayLoading: boolean;
  ebayError: string | null;
  ebayTotal: number;
  ebayPublishedCount: number;
  ebayDraftCount: number;
  marketLoading: boolean;
  marketError: string | null;
  marketCurrentSlug: string;
  marketListingCount: number;
  userCount: number;
  adminCount: number;
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
  insights,
  accessiblePages,
  approvalLoading,
  approvalError,
  approvalTotal,
  approvalApproved,
  approvalPending,
  aiProvider,
  ebayAuthenticated,
  ebayRestoringSession,
  ebayLoading,
  ebayError,
  ebayTotal,
  ebayPublishedCount,
  ebayDraftCount,
  marketLoading,
  marketError,
  marketCurrentSlug,
  marketListingCount,
  userCount,
  adminCount,
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
  const kpiCardClass = 'w-full appearance-none rounded-[14px] border border-[var(--line)] border-t-[3px] bg-[var(--panel)] px-4 pb-3 pt-3 text-left text-[var(--ink)] shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)] transition hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(17,32,49,0.09),0_8px_24px_rgba(17,32,49,0.08)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-200';
  const trendToneClass = {
    up: 'text-green-700',
    down: 'text-amber-400',
    flat: 'text-[var(--muted)]',
  } as const;
  const insightToneClass = {
    critical: 'border-red-500/30 bg-red-950/30 text-red-300',
    warning: 'border-amber-500/30 bg-amber-950/30 text-amber-300',
    info: 'border-blue-500/30 bg-blue-950/30 text-blue-300',
    positive: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300',
  } as const;
  const insightBadgeClass = {
    critical: 'bg-red-900/50 text-red-300',
    warning: 'bg-amber-900/50 text-amber-300',
    info: 'bg-blue-900/50 text-blue-300',
    positive: 'bg-emerald-900/50 text-emerald-300',
  } as const;
  const sectionBaseClass = 'scroll-mt-24';
  const workflowCards = useMemo(() => {
    const cards: Array<{
      id: AppPage;
      title: string;
      eyebrow: string;
      detail: string;
      stats: string[];
    }> = [];

    if (accessiblePages.includes('ebay')) {
      cards.push({
        id: 'ebay',
        title: 'eBay Publishing',
        eyebrow: ebayLoading ? 'Syncing seller inventory' : ebayAuthenticated ? 'Seller account connected' : ebayRestoringSession ? 'Restoring seller session' : 'Connection required',
        detail: ebayError
          ? ebayError
          : ebayAuthenticated
            ? 'Review live offers, manage inventory-mode drafts, and publish sample listings.'
            : 'Authorize the seller account before pushing inventory or offers to eBay.',
        stats: ebayAuthenticated
          ? [
            `${ebayPublishedCount} live offer${ebayPublishedCount === 1 ? '' : 's'}`,
            `${ebayDraftCount} draft${ebayDraftCount === 1 ? '' : 's'}`,
            `${ebayTotal} tracked SKU${ebayTotal === 1 ? '' : 's'}`,
          ]
          : ['OAuth setup', 'Inventory sync', 'Draft publish'],
      });
    }

    if (accessiblePages.includes('approval')) {
      cards.push({
        id: 'approval',
        title: 'Listing Approval Queue',
        eyebrow: approvalLoading ? 'Refreshing queue' : approvalError ? 'Queue needs attention' : `${approvalPending} awaiting review`,
        detail: approvalError
          ? approvalError
          : 'Open pending records, validate mapped listing fields, and mark approved items ready for the next step.',
        stats: approvalLoading
          ? ['Loading queue…']
          : [
            `${approvalTotal} total record${approvalTotal === 1 ? '' : 's'}`,
            `${approvalPending} pending`,
            `${approvalApproved} approved`,
          ],
      });
    }

    if (accessiblePages.includes('market')) {
      cards.push({
        id: 'market',
        title: 'Market Pricing Research',
        eyebrow: marketCurrentSlug ? `Tracking ${marketCurrentSlug}` : 'No active lookup',
        detail: marketError
          ? marketError
          : marketCurrentSlug
            ? 'Use the saved HiFiShark lookup to compare asking prices and validate current market demand.'
            : 'Run a model search to capture current comps before pricing inventory.',
        stats: marketLoading
          ? ['Searching HiFiShark…']
          : marketCurrentSlug
            ? [`${marketListingCount} result${marketListingCount === 1 ? '' : 's'}`, 'Price comps', 'Research linkouts']
            : ['Model slug search', 'Recent comps', 'Pricing check'],
      });
    }

    if (accessiblePages.includes('imagelab')) {
      cards.push({
        id: 'imagelab',
        title: 'Image Lab',
        eyebrow: aiProvider === 'none' ? 'AI identification offline' : aiProvider === 'github' ? 'GitHub Models ready' : 'OpenAI ready',
        detail: 'Batch-identify equipment from photos, optimize exports, and prep listing-ready image assets.',
        stats: [
          aiProvider === 'none' ? 'Manual image processing' : 'Equipment identification',
          'Resize + watermark',
          'Clipboard-ready copy',
        ],
      });
    }

    if (accessiblePages.includes('users')) {
      cards.push({
        id: 'users',
        title: 'User Management',
        eyebrow: `${userCount} account${userCount === 1 ? '' : 's'} in workspace`,
        detail: 'Adjust page access, reset passwords, and keep operator permissions aligned with the current workflow.',
        stats: [
          `${adminCount} admin${adminCount === 1 ? '' : 's'}`,
          `${Math.max(0, userCount - adminCount)} operator${userCount - adminCount === 1 ? '' : 's'}`,
          `${accessiblePages.length} page${accessiblePages.length === 1 ? '' : 's'} available to you`,
        ],
      });
    }

    return cards;
  }, [
    accessiblePages,
    adminCount,
    aiProvider,
    approvalApproved,
    approvalError,
    approvalLoading,
    approvalPending,
    approvalTotal,
    ebayAuthenticated,
    ebayDraftCount,
    ebayError,
    ebayPublishedCount,
    ebayRestoringSession,
    ebayTotal,
    marketCurrentSlug,
    marketError,
    marketListingCount,
    marketLoading,
    userCount,
  ]);
  const sections = useMemo(() => {
    const hasEbayWorkflow = workflowCards.some((card) => card.id === 'ebay');
    const baseSections = [
      { id: 'overview', label: 'Dashboard' },
      { id: 'insights', label: 'Insights' },
      { id: 'inventory', label: 'Airtable' },
      { id: 'pipeline', label: 'Shopify' },
      { id: 'inquiries', label: 'JotForm' },
    ];

    return workflowCards.length > 0
      ? [...baseSections, { id: 'workflows', label: hasEbayWorkflow ? 'eBay + Utilities' : 'Utilities' }]
      : baseSections;
  }, [workflowCards]);
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? 'overview');

  useEffect(() => {
    setActiveSectionId((current) => sections.some((section) => section.id === current) ? current : sections[0]?.id ?? 'overview');
  }, [sections]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveSectionId(visible.target.id);
        }
      },
      {
        rootMargin: '-15% 0px -60% 0px',
        threshold: [0.2, 0.35, 0.5],
      },
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  function scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (!element) return;

    const top = element.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />

      <section id="overview" className={`${sectionBaseClass} flex flex-col gap-3`}>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(19,37,59,0.96),rgba(31,111,235,0.9))] px-4 py-2.5 text-slate-50 shadow-[0_4px_12px_rgba(17,32,49,0.12)]">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white/60">Dashboard</span>
          <span className="text-white/30">·</span>
          <h2 className="m-0 text-[0.95rem] font-bold leading-none">Operations Snapshot</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <button type="button" className={`${kpiCardClass} border-t-blue-500`} onClick={() => onSelectTab('jotform')}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Incoming Gear Submissions</span>
            </div>
            <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{jfLoading ? '…' : jfSubmissions.length.toLocaleString()}</p>
            <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">
              <strong className="font-semibold text-[var(--accent)]">{thisWeekSubs.length}</strong> this week
              &nbsp;·&nbsp;
              <strong className="font-semibold text-[var(--accent)]">{recentSubs.length}</strong> last 30 days
              {totalNewSubmissions > 0 && (
                <>
                  &nbsp;·&nbsp;
                  <span className="font-semibold text-red-600">{totalNewSubmissions} unread</span>
                </>
              )}
            </p>
            <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[submissionsTrend.direction]}`}>{submissionsTrend.text}</p>
          </button>

          <button type="button" className={`${kpiCardClass} border-t-amber-500`} onClick={() => onSelectTab('shopify')}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Deals in Progress</span>
            </div>
            <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{spLoading ? '…' : draftProducts.length}</p>
            <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">
              <strong className="font-semibold text-[var(--accent)]">{activeProducts.length}</strong> live inventory
              &nbsp;·&nbsp;
              <strong className="font-semibold text-[var(--accent)]">{archivedProducts.length}</strong> closed out
            </p>
            <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[dealsTrend.direction]}`}>{dealsTrend.text}</p>
          </button>

          <button type="button" className={`${kpiCardClass} border-t-violet-500`} onClick={() => onSelectTab('airtable')}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Acquisition Costs</span>
            </div>
            <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">
              {atLoading ? '…' : acquisitionCost > 0
                ? `$${acquisitionCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : '—'}
            </p>
            <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">
              Using Airtable <strong className="font-semibold text-[var(--accent)]">Price</strong> from {nonEmptyListings.length} records
            </p>
            <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[acquisitionTrend.direction]}`}>{acquisitionTrend.text}</p>
          </button>

          <button type="button" className={`${kpiCardClass} border-t-emerald-500`} onClick={() => onSelectTab('shopify')}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Inventory Value</span>
            </div>
            <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">
              {spLoading ? '…' : inventoryValue > 0
                ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : '—'}
            </p>
            <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">
              Active listings at ask price
              &nbsp;·&nbsp;
              avg <strong className="font-semibold text-[var(--accent)]">{spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'}</strong>
            </p>
            <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[inventoryTrend.direction]}`}>{inventoryTrend.text}</p>
          </button>

          <button type="button" className={`${kpiCardClass} border-t-slate-600`} onClick={() => onSelectTab('shopify')}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Sales Performance</span>
            </div>
            <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{sellThroughPct !== null ? `${sellThroughPct}%` : '—'}</p>
            <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">
              <strong className="font-semibold text-[var(--accent)]">{archivedProducts.length}</strong> sold or archived
              &nbsp;·&nbsp;
              sell-through rate
            </p>
            <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[salesTrend.direction]}`}>{salesTrend.text}</p>
          </button>

          <button type="button" className={`${kpiCardClass} border-t-teal-500`} onClick={() => onSelectTab('airtable')}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Profit Margins</span>
            </div>
            <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{grossMarginPct !== null ? `${grossMarginPct}%` : '—'}</p>
            <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">
              {grossMarginPct !== null ? 'Derived from Shopify ask value and Airtable Price' : 'Add numeric Airtable prices to calculate'}
            </p>
            <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[marginTrend.direction]}`}>{marginTrend.text}</p>
          </button>
        </div>
      </section>

      <section id="insights" className={`${sectionBaseClass} flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <h2 className="m-0 text-[0.92rem] font-bold text-[var(--ink)]">Operational Insights</h2>
            <p className="m-0 text-[0.78rem] text-[var(--muted)]">Automated trend alerts from current dashboard metrics</p>
          </div>
          {insights.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {insights.map((insight) => (
                <article
                  key={insight.id}
                  className={`rounded-xl border px-4 py-3 ${insightToneClass[insight.severity]}`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h3 className="m-0 text-[0.86rem] font-bold">{insight.title}</h3>
                    <span className={`rounded-full px-2 py-[0.15rem] text-[0.64rem] font-bold uppercase tracking-[0.07em] ${insightBadgeClass[insight.severity]}`}>
                      {insight.severity}
                    </span>
                  </div>
                  <p className="m-0 text-[0.8rem] leading-[1.45] opacity-90">{insight.detail}</p>
                  {insight.targetTab && (
                    <button
                      type="button"
                      className="mt-3 rounded-lg border border-current/30 bg-white/10 px-3 py-1.5 text-[0.72rem] font-semibold transition hover:bg-white/20"
                      onClick={() => {
                        if (insight.targetTab) {
                          onSelectTab(insight.targetTab);
                        }
                      }}
                    >
                      Review in {PAGE_DEFINITIONS[insight.targetTab].label} →
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-[0.84rem] text-emerald-200">
              No active alerts right now. The dashboard will surface warnings here when inventory, inquiries, or sales trends drift.
            </div>
          )}
        </section>

      <section id="inventory" className={`${sectionBaseClass} flex flex-col gap-[1.1rem] rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Airtable Inventory Recap <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">All products in Airtable</span></h2>
          </div>
          <button type="button" className="cursor-pointer self-start rounded-lg border border-[var(--line)] bg-transparent px-[0.85rem] py-[0.38rem] text-[0.78rem] font-semibold text-[var(--accent)] transition-[background,border-color] duration-[140ms] hover:border-[var(--accent)] hover:bg-[var(--panel)]" onClick={() => onSelectTab('airtable')}>
            Open Airtable Inventory →
          </button>
        </div>

        {atLoading ? (
          <div className="flex items-center gap-3 py-2 text-[var(--muted)]">
            <div className={spinnerClass} />
            <p>Loading Airtable inventory…</p>
          </div>
        ) : nonEmptyListings.length > 0 ? (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4 leading-tight shadow-[0_8px_24px_rgba(17,32,49,0.04)]">
                <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Products</span>
                <strong className="text-[1.3rem] leading-[1.1] text-[var(--ink)] [font-variant-numeric:tabular-nums]">{nonEmptyListings.length}</strong>
              </article>
              <article className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4 leading-tight shadow-[0_8px_24px_rgba(17,32,49,0.04)]">
                <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Brands</span>
                <strong className="text-[1.3rem] leading-[1.1] text-[var(--ink)] [font-variant-numeric:tabular-nums]">{uniqueAirtableBrands}</strong>
              </article>
              <article className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4 leading-tight shadow-[0_8px_24px_rgba(17,32,49,0.04)]">
                <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Component Types</span>
                <strong className="text-[1.3rem] leading-[1.1] text-[var(--ink)] [font-variant-numeric:tabular-nums]">{uniqueAirtableTypes}</strong>
              </article>
              <article className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4 leading-tight shadow-[0_8px_24px_rgba(17,32,49,0.04)]">
                <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Tagged Value</span>
                <strong className="text-[1.3rem] leading-[1.1] text-[var(--ink)] [font-variant-numeric:tabular-nums]">
                  {airtableInventoryValue > 0 ? `$${airtableInventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                </strong>
              </article>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4">
                <h3 className="mb-3 text-[0.9rem] font-bold text-[var(--ink)]">By Component Type</h3>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {componentTypeSummary.map(([label, count]) => (
                    <li key={label} className="grid grid-cols-[minmax(90px,140px)_1fr_32px] items-center gap-3">
                      <span className="truncate whitespace-nowrap text-[0.82rem] text-[var(--ink)]">{label}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
                        <div className="h-full min-w-[6px] rounded-full bg-gradient-to-r from-teal-500 to-teal-300" style={{ width: `${Math.round((count / maxComponentTypeCount) * 100)}%` }} />
                      </div>
                      <span className="text-right text-[0.8rem] font-bold text-[var(--ink)] [font-variant-numeric:tabular-nums]">{count}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4">
                <h3 className="mb-3 text-[0.9rem] font-bold text-[var(--ink)]">Top Brands</h3>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {airtableBrandSummary.map(([label, count]) => (
                    <li key={label} className="grid grid-cols-[minmax(90px,140px)_1fr_32px] items-center gap-3">
                      <span className="truncate whitespace-nowrap text-[0.82rem] text-[var(--ink)]">{label}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
                        <div className="h-full min-w-[6px] rounded-full bg-gradient-to-r from-blue-500 to-blue-300" style={{ width: `${Math.round((count / maxAirtableBrandCount) * 100)}%` }} />
                      </div>
                      <span className="text-right text-[0.8rem] font-bold text-[var(--ink)] [font-variant-numeric:tabular-nums]">{count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4">
                <h3 className="mb-3 text-[0.9rem] font-bold text-[var(--ink)]">By Distributor</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[0.84rem]">
                    <thead>
                      <tr>
                        <th className="border-b border-[var(--line)] px-2 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Distributor</th>
                        <th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Products</th>
                        <th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Tagged Value</th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr:last-child>td]:border-b-0">
                      {airtableDistributorSummary.map(([distributor, summary]) => (
                        <tr key={distributor}>
                          <td className="border-b border-[var(--line)] px-2 py-2 align-middle">{distributor}</td>
                          <td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{summary.count}</td>
                          <td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{summary.total > 0 ? `$${summary.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4">
                <h3 className="mb-3 text-[0.9rem] font-bold text-[var(--ink)]">Component Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[0.84rem]">
                    <thead>
                      <tr>
                        <th className="border-b border-[var(--line)] px-2 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Type</th>
                        <th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Products</th>
                        <th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Brands</th>
                        <th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Avg Price</th>
                        <th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr:last-child>td]:border-b-0">
                      {airtableTypeTable.map((row) => (
                        <tr key={row.type}>
                          <td className="border-b border-[var(--line)] px-2 py-2 align-middle">{row.type}</td>
                          <td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{row.count}</td>
                          <td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{row.brandCount}</td>
                          <td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{row.averagePrice > 0 ? `$${Math.round(row.averagePrice).toLocaleString()}` : '—'}</td>
                          <td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{row.totalPrice > 0 ? `$${row.totalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        ) : (
          <p className="m-0 text-[var(--muted)]">No Airtable inventory records available yet.</p>
        )}
      </section>

      <div id="pipeline" className={`${sectionBaseClass} grid grid-cols-1 gap-4 md:grid-cols-2`}>
        <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
          <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Submission Volume <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">Last 14 days</span></h2>
          {jfLoading ? (
            <div className="flex items-center gap-3 py-6 text-[var(--muted)]">
              <div className={spinnerClass} />
              <p>Loading…</p>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-[0.8rem]">
                <div className="flex flex-col gap-[0.28rem] rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-[0.85rem_0.95rem]">
                  <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">14-day total</span>
                  <strong className="text-[0.96rem] leading-[1.35] text-[var(--ink)]">{submissionWindowTotal}</strong>
                </div>
                <div className="flex flex-col gap-[0.28rem] rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-[0.85rem_0.95rem]">
                  <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Average / day</span>
                  <strong className="text-[0.96rem] leading-[1.35] text-[var(--ink)]">{submissionAverage.toFixed(1)}</strong>
                </div>
                <div className="flex flex-col gap-[0.28rem] rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-[0.85rem_0.95rem]">
                  <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Peak day</span>
                  <strong className="text-[0.96rem] leading-[1.35] text-[var(--ink)]">{peakSubmissionDay ? `${peakSubmissionDay.count} on ${peakSubmissionDay.label}` : 'No activity'}</strong>
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--line)] bg-[radial-gradient(circle_at_top,rgba(104,164,255,0.08),transparent_55%),linear-gradient(180deg,rgba(16,26,40,0.98),rgba(11,20,31,0.98))] p-4">
                <div className="mb-[0.85rem] flex flex-wrap justify-between gap-4">
                  <p className="m-0 text-[0.82rem] text-[var(--muted)] [&_strong]:text-[var(--ink)]">
                    <strong>{activeSubmissionDays}</strong> active days in the last two weeks
                  </p>
                  <p className="m-0 text-[0.82rem] text-[var(--muted)] [&_strong]:text-[var(--ink)]">
                    Peak day represented <strong>{peakSubmissionShare}%</strong> of inbound volume
                  </p>
                </div>
                <div className="relative pb-0 pl-[2.9rem] pt-[1.2rem]">
                  <div className="pointer-events-none absolute left-0 right-0 top-0 flex justify-start">
                    <span className="pl-[0.1rem] text-[0.68rem] font-bold uppercase leading-none tracking-[0.08em] text-[var(--muted)]">Submissions per day</span>
                  </div>
                  <div className="relative h-[180px]">
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                      {chartGuideValues.map((value, index) => (
                        <div
                          key={`${value}-${index}`}
                          className={`absolute left-0 right-0 border-t border-dashed border-[rgba(148,163,184,0.35)] [min-height:1px] ${index === 0 ? 'top-0' : 'top-1/2 -translate-y-[0.5px]'}`}
                        >
                          <span className="absolute left-[-2rem] top-[-0.55rem] text-[0.7rem] text-[var(--muted)] [font-variant-numeric:tabular-nums]">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-[rgba(148,163,184,0.45)]" aria-hidden="true">
                      <span className="absolute left-[-2rem] top-[-0.7rem] text-[0.7rem] text-[var(--muted)] [font-variant-numeric:tabular-nums]">0</span>
                    </div>
                    <div className="relative flex h-full items-stretch gap-[10px]">
                      {submissionDays.map((day, index) => {
                        const height = maxDayCount > 0
                          ? day.count > 0
                            ? Math.max(8, Math.round((day.count / maxDayCount) * 100))
                            : 0
                          : 0;
                        const isPeak = peakSubmissionDay?.label === day.label && peakSubmissionDay?.count === day.count && day.count > 0;
                        const hasVolume = day.count > 0;

                        return (
                          <div key={index} className="relative z-[1] flex h-full flex-1 items-end">
                            <div className="flex h-full w-full items-end justify-center">
                              <div className="flex h-full w-[72%] items-end justify-center rounded-t-[14px] bg-[linear-gradient(180deg,rgba(148,163,184,0.08),rgba(148,163,184,0.02))]">
                                <div
                                  className={[
                                    'relative w-full rounded-t-[10px] transition-[opacity,transform,filter] duration-[120ms]',
                                    !hasVolume && 'min-h-0 opacity-0 shadow-none',
                                    hasVolume && !isPeak && 'min-h-[6px] bg-[linear-gradient(180deg,var(--accent),#5da6ff)] opacity-90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_-2px_12px_rgba(31,111,235,0.12)] hover:opacity-100 hover:-translate-y-0.5 hover:brightness-[1.03]',
                                    hasVolume && isPeak && 'min-h-[6px] bg-[linear-gradient(180deg,#22d3ee,#3b82f6_55%,#2563eb)] opacity-90 shadow-[0_14px_26px_rgba(59,130,246,0.24)] hover:opacity-100 hover:-translate-y-0.5 hover:brightness-[1.03]',
                                  ].filter(Boolean).join(' ')}
                                  style={{ height: `${height}%` }}
                                  title={`${day.label}: ${day.count} submissions`}
                                  aria-label={`${day.label}: ${day.count} submissions`}
                                >
                                  {isPeak && <span className="absolute left-1/2 top-[-6px] h-[10px] w-[10px] -translate-x-1/2 rounded-full bg-[#67e8f9] shadow-[0_0_0_4px_rgba(103,232,249,0.14)]" aria-hidden="true" />}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-[0.45rem] flex min-h-[1rem] gap-[10px]">
                    {submissionDays.map((day, index) => {
                      const dayLabel = day.label.split(' ')[1] ?? day.label;

                      return (
                        <span key={`${day.label}-${index}`} className="flex-1 whitespace-nowrap text-center text-[0.64rem] font-semibold text-[var(--muted)] [font-variant-numeric:tabular-nums]">{dayLabel}</span>
                      );
                    })}
                  </div>
                  <div className="pointer-events-none relative mt-[0.2rem] flex justify-end">
                    <span className="pr-[0.1rem] text-[0.68rem] font-bold uppercase leading-none tracking-[0.08em] text-[var(--muted)]">Date</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
          <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Sales Performance</h2>
          <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
            <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
              <span className="text-[0.8rem] text-[var(--muted)]">Total Listings</span>
              <span className="text-[0.9rem] font-bold text-[var(--ink)] [font-variant-numeric:tabular-nums]">{spLoading ? '…' : products.length}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
              <span className="text-[0.8rem] text-[var(--muted)]">Active</span>
              <span className="text-[0.9rem] font-bold text-green-400 [font-variant-numeric:tabular-nums]">{spLoading ? '…' : activeProducts.length}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
              <span className="text-[0.8rem] text-[var(--muted)]">Draft / Pending</span>
              <span className="text-[0.9rem] font-bold text-amber-400 [font-variant-numeric:tabular-nums]">{spLoading ? '…' : draftProducts.length}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
              <span className="text-[0.8rem] text-[var(--muted)]">Sold / Archived</span>
              <span className="text-[0.9rem] font-medium text-[var(--muted)] [font-variant-numeric:tabular-nums]">{spLoading ? '…' : archivedProducts.length}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
              <span className="text-[0.8rem] text-[var(--muted)]">Avg Ask Price</span>
              <span className="text-[0.9rem] font-bold text-[var(--ink)] [font-variant-numeric:tabular-nums]">{spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
              <span className="text-[0.8rem] text-[var(--muted)]">Total Ask Value</span>
              <span className="text-[0.9rem] font-bold text-green-400 [font-variant-numeric:tabular-nums]">{spLoading ? '…' : inventoryValue > 0 ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
              <span className="text-[0.8rem] text-[var(--muted)]">Gross Margin</span>
              <span className={`text-[0.9rem] font-bold [font-variant-numeric:tabular-nums] ${grossMarginPct !== null && grossMarginPct > 0 ? 'text-green-400' : 'text-[var(--ink)]'}`}>{grossMarginPct !== null ? `${grossMarginPct}%` : '—'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
              <span className="text-[0.8rem] text-[var(--muted)]">Potential Profit</span>
              <span className="text-[0.9rem] font-bold text-green-400 [font-variant-numeric:tabular-nums]">
                {acquisitionCost > 0 && totalAsk > 0 ? `$${(totalAsk - acquisitionCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div id="inquiries" className={`${sectionBaseClass} grid grid-cols-1 gap-4 md:grid-cols-2`}>
        <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
          <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Top Requested Brands <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">From last 500 submissions</span></h2>
          {jfLoading ? (
            <div className="flex items-center gap-3 py-4 text-[var(--muted)]">
              <div className={spinnerClass} />
              <p>Loading…</p>
            </div>
          ) : topBrands.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-[0.65rem] p-0">
              {topBrands.map(([brand, count]) => (
                <li key={brand} className="grid grid-cols-[130px_1fr_36px] items-center gap-3 max-[520px]:grid-cols-[90px_1fr_30px]">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.82rem] font-semibold text-[var(--ink)]">{brand}</span>
                  <div className="h-[7px] overflow-hidden rounded-full bg-[var(--line)]">
                    <div className="h-full min-w-[4px] rounded-full bg-[linear-gradient(90deg,var(--accent),#5da6ff)] transition-[width] duration-[600ms] ease-in-out" style={{ width: `${Math.round((count / topBrands[0][1]) * 100)}%` }} />
                  </div>
                  <span className="text-right text-[0.75rem] font-semibold text-[var(--muted)] [font-variant-numeric:tabular-nums]">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)', margin: 0 }}>No brand data yet.</p>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
          <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Recent Submissions <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">Latest 8</span></h2>
          {jfLoading ? (
            <div className="flex items-center gap-3 py-4 text-[var(--muted)]">
              <div className={spinnerClass} />
              <p>Loading…</p>
            </div>
          ) : (
            <>
              <ul className="m-0 flex-1 list-none p-0">
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
                    <li key={submission.id} className={`flex items-center justify-between gap-2 border-b border-[var(--line)] py-[0.6rem] last:border-b-0${isNew ? ' -mx-2 rounded-[6px] bg-[linear-gradient(90deg,rgba(31,111,235,0.05),transparent)] px-2' : ''}`}>
                      <div className="flex min-w-0 items-center gap-2">
                        {isNew && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)]" />}
                        <div>
                          <p className="m-0 max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.84rem] font-semibold text-[var(--ink)]">{name}</p>
                          {(brand || model) && <p className="m-0 mt-[0.1rem] max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.74rem] text-[var(--muted)]">{[brand, model].filter(Boolean).join(' · ')}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-[0.65rem]">
                        <span className="text-[0.72rem] text-[var(--muted)] [font-variant-numeric:tabular-nums]">{timeLabel}</span>
                        <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[0.76rem] font-bold text-[var(--accent)] no-underline hover:underline" onClick={() => onSelectTab('jotform')}>
                          View
                        </button>
                      </div>
                    </li>
                  );
                })}
                {jfSubmissions.length === 0 && <li style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No submissions loaded.</li>}
              </ul>
              <button className="cursor-pointer self-start rounded-lg border border-[var(--line)] bg-transparent px-[0.85rem] py-[0.38rem] text-[0.78rem] font-semibold text-[var(--accent)] transition-[background,border-color] duration-[140ms] hover:border-[var(--accent)] hover:bg-[var(--panel)]" onClick={() => onSelectTab('jotform')}>
                View all {jfSubmissions.length.toLocaleString()} submissions →
              </button>
            </>
          )}
        </section>
      </div>

      {workflowCards.length > 0 && (
        <section id="workflows" className={`${sectionBaseClass} flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <div>
              <h2 className="m-0 text-[0.92rem] font-bold text-[var(--ink)]">eBay and Utility Shortcuts</h2>
              <p className="m-0 mt-1 text-[0.78rem] text-[var(--muted)]">Quick access to eBay operations and utility tools.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {workflowCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="flex h-full flex-col gap-3 rounded-[16px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(104,164,255,0.1),transparent_56%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,15,26,0.96))] p-4 text-left text-[var(--ink)] transition hover:-translate-y-px hover:border-sky-400/35 hover:shadow-[0_18px_34px_rgba(2,6,23,0.28)]"
                onClick={() => onSelectTab(card.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-sky-200/80">{card.eyebrow}</p>
                    <h3 className="m-0 mt-1 text-[0.98rem] font-bold text-white">{card.title}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.68rem] font-semibold text-white/70">{PAGE_DEFINITIONS[card.id].label}</span>
                </div>
                <p className="m-0 min-h-[3.6rem] text-[0.8rem] leading-[1.55] text-slate-300">{card.detail}</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {card.stats.map((stat) => (
                    <span key={stat} className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-sky-100">
                      {stat}
                    </span>
                  ))}
                </div>
                <span className="text-[0.74rem] font-semibold text-[var(--accent)]">Open {PAGE_DEFINITIONS[card.id].label} →</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}