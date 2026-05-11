import type {
  DashboardSection,
  DashboardWorkflowSource,
  ShopifyProduct,
  WorkflowCard,
} from '@/components/dashboard/dashboardTabTypes';

interface DashboardSummaryMetrics {
  totalAsk: number;
  submissionWindowTotal: number;
  submissionAverage: number;
  activeSubmissionDays: number;
  peakSubmissionDay: { label: string; count: number } | null;
  peakSubmissionShare: number;
  chartGuideValues: number[];
}

export function buildDashboardSummaryMetrics(
  activeProducts: ShopifyProduct[],
  submissionDays: Array<{ label: string; count: number }>,
  maxDayCount: number,
): DashboardSummaryMetrics {
  const totalAsk = activeProducts.reduce((sum, product) => {
    const ask = parseFloat(product.variants?.[0]?.price ?? '0') || 0;
    return ask > 0 ? sum + ask : sum;
  }, 0);

  const submissionWindowTotal = submissionDays.reduce((sum, day) => sum + day.count, 0);
  const submissionAverage = submissionDays.length ? submissionWindowTotal / submissionDays.length : 0;
  const activeSubmissionDays = submissionDays.filter((day) => day.count > 0).length;
  const peakSubmissionDay = submissionDays.reduce<{ label: string; count: number } | null>((peak, day) => (!peak || day.count > peak.count ? day : peak), null);
  const peakSubmissionShare = submissionWindowTotal > 0 && peakSubmissionDay ? Math.round((peakSubmissionDay.count / submissionWindowTotal) * 100) : 0;

  return {
    totalAsk,
    submissionWindowTotal,
    submissionAverage,
    activeSubmissionDays,
    peakSubmissionDay,
    peakSubmissionShare,
    chartGuideValues: [maxDayCount, Math.max(1, Math.round(maxDayCount / 2))],
  };
}

export function buildEbayWorkflowCards({
  accessiblePages,
  approvalApproved,
  approvalError,
  approvalUnavailableReason,
  approvalLoading,
  approvalPending,
  approvalTotal,
  ebayAuthenticated,
  ebayDraftCount,
  ebayError,
  ebayUnavailableReason,
  ebayLoading,
  ebayPublishedCount,
  ebayRestoringSession,
  ebayTotal,
}: Pick<
  DashboardWorkflowSource,
  | 'accessiblePages'
  | 'approvalApproved'
  | 'approvalError'
  | 'approvalUnavailableReason'
  | 'approvalLoading'
  | 'approvalPending'
  | 'approvalTotal'
  | 'ebayAuthenticated'
  | 'ebayDraftCount'
  | 'ebayError'
  | 'ebayUnavailableReason'
  | 'ebayLoading'
  | 'ebayPublishedCount'
  | 'ebayRestoringSession'
  | 'ebayTotal'
>): WorkflowCard[] {
  const cards: WorkflowCard[] = [];

  if (accessiblePages.includes('ebay')) {
    cards.push({
      id: 'ebay',
      title: 'eBay Snapshot',
      eyebrow: ebayUnavailableReason ? 'Runtime config required' : ebayLoading ? 'Syncing seller inventory' : ebayAuthenticated ? 'Seller account connected' : ebayRestoringSession ? 'Restoring seller session' : 'Connection required',
      detail: ebayUnavailableReason ?? ebayError ?? (ebayAuthenticated ? 'Review live offers, draft coverage, and connection status on the read-only eBay page.' : 'Authorize the seller account on the eBay page so approved Listings records can publish later.'),
      stats: ebayAuthenticated ? [`${ebayPublishedCount} live offer${ebayPublishedCount === 1 ? '' : 's'}`, `${ebayDraftCount} draft${ebayDraftCount === 1 ? '' : 's'}`, `${ebayTotal} tracked SKU${ebayTotal === 1 ? '' : 's'}`] : ['OAuth setup', 'Inventory sync', 'Draft publish'],
      unavailableReason: ebayUnavailableReason ?? null,
    });
  }

  if (accessiblePages.includes('listings')) {
    cards.push({
      id: 'listings',
      title: 'eBay Listing Review',
      eyebrow: approvalUnavailableReason ? 'Runtime config required' : approvalLoading ? 'Refreshing queue' : approvalError ? 'Queue needs attention' : `${approvalPending} awaiting review`,
      detail: approvalUnavailableReason ?? approvalError ?? 'Open Listings to review pending eBay-ready records, validate mapped listing fields, and approve items for publishing.',
      stats: approvalLoading ? ['Loading queue…'] : [`${approvalTotal} total record${approvalTotal === 1 ? '' : 's'}`, `${approvalPending} pending`, `${approvalApproved} approved`],
      unavailableReason: approvalUnavailableReason ?? null,
    });
  }

  return cards;
}

export function buildShopifyWorkflowCards({
  accessiblePages,
  shopifyLoading,
  shopifyProductsCount,
  shopifyActiveCount,
  shopifyDraftCount,
  shopifyArchivedCount,
  shopifyApprovalLoading,
  shopifyApprovalUnavailableReason,
  shopifyApprovalTotal,
  shopifyApprovalApproved,
  shopifyApprovalPending,
}: Pick<
  DashboardWorkflowSource,
  | 'accessiblePages'
  | 'shopifyLoading'
  | 'shopifyProductsCount'
  | 'shopifyActiveCount'
  | 'shopifyDraftCount'
  | 'shopifyArchivedCount'
  | 'shopifyApprovalLoading'
  | 'shopifyApprovalUnavailableReason'
  | 'shopifyApprovalTotal'
  | 'shopifyApprovalApproved'
  | 'shopifyApprovalPending'
>): WorkflowCard[] {
  const cards: WorkflowCard[] = [];

  if (accessiblePages.includes('shopify')) {
    cards.push({
      id: 'shopify',
      title: 'Shopify Snapshot',
      eyebrow: shopifyLoading ? 'Syncing Shopify products' : `${shopifyProductsCount} listing${shopifyProductsCount === 1 ? '' : 's'} tracked`,
      detail: 'Review Shopify product counts, status mix, and store-side publishing state on the read-only Shopify page.',
      stats: shopifyLoading
        ? ['Loading Shopify data…']
        : [`${shopifyActiveCount} active`, `${shopifyDraftCount} draft`, `${shopifyArchivedCount} archived`],
    });
  }

  if (accessiblePages.includes('listings')) {
    cards.push({
      id: 'listings',
      title: 'Shopify Listing Review',
      eyebrow: shopifyApprovalUnavailableReason ? 'Runtime config required' : shopifyApprovalLoading ? 'Syncing listings review' : `${shopifyApprovalPending} awaiting review`,
      detail: shopifyApprovalUnavailableReason ?? 'Open Listings to review pending Shopify-ready records, validate mapped fields, and approve records for publishing.',
      stats: shopifyApprovalLoading
        ? ['Loading queue…']
        : [`${shopifyApprovalTotal} total`, `${shopifyApprovalPending} pending`, `${shopifyApprovalApproved} approved`],
      unavailableReason: shopifyApprovalUnavailableReason ?? null,
    });
  }

  return cards;
}

export function buildMarketWorkflowCards({
  accessiblePages,
  marketCurrentSlug,
  marketError,
  marketListingCount,
  marketLoading,
}: Pick<DashboardWorkflowSource, 'accessiblePages' | 'marketCurrentSlug' | 'marketError' | 'marketListingCount' | 'marketLoading'>): WorkflowCard[] {
  if (!accessiblePages.includes('market')) return [];

  return [{
    id: 'market',
    title: 'Market Pricing Research',
    eyebrow: marketCurrentSlug ? `Tracking ${marketCurrentSlug}` : 'No active lookup',
    detail: marketError ? marketError : marketCurrentSlug ? 'Use the saved HiFiShark lookup to compare asking prices and validate current market demand.' : 'Run a model search to capture current comps before pricing inventory.',
    stats: marketLoading ? ['Searching HiFiShark…'] : marketCurrentSlug ? [`${marketListingCount} result${marketListingCount === 1 ? '' : 's'}`, 'Price comps', 'Research linkouts'] : ['Model slug search', 'Recent comps', 'Pricing check'],
  }];
}

export function buildUtilityWorkflowCards({
  accessiblePages,
  aiProvider,
}: Pick<DashboardWorkflowSource, 'accessiblePages' | 'aiProvider'>): WorkflowCard[] {
  const cards: WorkflowCard[] = [];

  if (accessiblePages.includes('imagelab')) {
    cards.push({
      id: 'imagelab',
      title: 'Image Lab',
      eyebrow: aiProvider === 'none'
        ? 'AI identification offline'
        : aiProvider === 'github'
          ? 'GitHub Models ready'
          : aiProvider === 'openai'
            ? 'OpenAI ready'
            : 'Lambda AI ready',
      detail: 'Batch-identify equipment from photos, optimize exports, and prep listing-ready image assets.',
      stats: [aiProvider === 'none' ? 'Manual image processing' : 'Equipment identification', 'Resize + watermark', 'Clipboard-ready copy'],
    });
  }

  return cards;
}

export function buildDashboardSections({
  accessiblePages,
  ebayCards,
  marketCards,
  utilityCards,
  showExpandedSections,
}: {
  accessiblePages: DashboardWorkflowSource['accessiblePages'];
  ebayCards: WorkflowCard[];
  marketCards: WorkflowCard[];
  utilityCards: WorkflowCard[];
  showExpandedSections: boolean;
}): DashboardSection[] {
  const sections: DashboardSection[] = [{ id: 'overview', label: 'Overview' }];

  if (!showExpandedSections) {
    return sections;
  }

  if (accessiblePages.includes('inventory')) {
    sections.push({ id: 'inventory', label: 'Inventory' });
  }
  if (accessiblePages.includes('jotform')) {
    sections.push({ id: 'inquiries', label: 'JotForm' });
  }
  if (accessiblePages.includes('shopify') || accessiblePages.includes('listings')) {
    sections.push({ id: 'pipeline', label: 'Shopify' });
  }

  if (ebayCards.length > 0) sections.push({ id: 'ebay-workflows', label: 'eBay' });
  
  const combinedUtilityCards = [...marketCards, ...utilityCards];
  if (combinedUtilityCards.length > 0) sections.push({ id: 'utility-workflows', label: 'Utilities' });

  return sections;
}

