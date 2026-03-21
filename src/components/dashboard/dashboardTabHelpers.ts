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
  approvalLoading,
  approvalPending,
  approvalTotal,
  ebayAuthenticated,
  ebayDraftCount,
  ebayError,
  ebayLoading,
  ebayPublishedCount,
  ebayRestoringSession,
  ebayTotal,
}: Pick<
  DashboardWorkflowSource,
  | 'accessiblePages'
  | 'approvalApproved'
  | 'approvalError'
  | 'approvalLoading'
  | 'approvalPending'
  | 'approvalTotal'
  | 'ebayAuthenticated'
  | 'ebayDraftCount'
  | 'ebayError'
  | 'ebayLoading'
  | 'ebayPublishedCount'
  | 'ebayRestoringSession'
  | 'ebayTotal'
>): WorkflowCard[] {
  const cards: WorkflowCard[] = [];

  if (accessiblePages.includes('ebay')) {
    cards.push({
      id: 'ebay',
      title: 'eBay Publishing',
      eyebrow: ebayLoading ? 'Syncing seller inventory' : ebayAuthenticated ? 'Seller account connected' : ebayRestoringSession ? 'Restoring seller session' : 'Connection required',
      detail: ebayError ? ebayError : ebayAuthenticated ? 'Review live offers, manage inventory-mode drafts, and publish sample listings.' : 'Authorize the seller account before pushing inventory or offers to eBay.',
      stats: ebayAuthenticated ? [`${ebayPublishedCount} live offer${ebayPublishedCount === 1 ? '' : 's'}`, `${ebayDraftCount} draft${ebayDraftCount === 1 ? '' : 's'}`, `${ebayTotal} tracked SKU${ebayTotal === 1 ? '' : 's'}`] : ['OAuth setup', 'Inventory sync', 'Draft publish'],
    });
  }

  if (accessiblePages.includes('approval')) {
    cards.push({
      id: 'approval',
      title: 'Listing Approval Queue',
      eyebrow: approvalLoading ? 'Refreshing queue' : approvalError ? 'Queue needs attention' : `${approvalPending} awaiting review`,
      detail: approvalError ? approvalError : 'Open pending records, validate mapped listing fields, and mark approved items ready for the next step.',
      stats: approvalLoading ? ['Loading queue…'] : [`${approvalTotal} total record${approvalTotal === 1 ? '' : 's'}`, `${approvalPending} pending`, `${approvalApproved} approved`],
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
}: Pick<
  DashboardWorkflowSource,
  | 'accessiblePages'
  | 'shopifyLoading'
  | 'shopifyProductsCount'
  | 'shopifyActiveCount'
  | 'shopifyDraftCount'
  | 'shopifyArchivedCount'
>): WorkflowCard[] {
  const cards: WorkflowCard[] = [];

  if (accessiblePages.includes('shopify')) {
    cards.push({
      id: 'shopify',
      title: 'Shopify Listings',
      eyebrow: shopifyLoading ? 'Syncing Shopify products' : `${shopifyProductsCount} listing${shopifyProductsCount === 1 ? '' : 's'} tracked`,
      detail: 'Manage Shopify product statuses, clean up drafts, and monitor active vs archived listing flow.',
      stats: shopifyLoading
        ? ['Loading Shopify data…']
        : [`${shopifyActiveCount} active`, `${shopifyDraftCount} draft`, `${shopifyArchivedCount} archived`],
    });
  }

  if (accessiblePages.includes('shopify-approval')) {
    cards.push({
      id: 'shopify-approval',
      title: 'Listing Approval Queue',
      eyebrow: shopifyLoading ? 'Syncing Shopify queue' : `${shopifyDraftCount} awaiting review`,
      detail: 'Review pending Shopify listing records, validate mapped fields, and approve records for Shopify publishing workflow.',
      stats: shopifyLoading ? ['Loading Shopify data…'] : [`${shopifyDraftCount} in queue`, `${shopifyActiveCount} active`, `${shopifyArchivedCount} archived`],
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
  adminCount,
  aiProvider,
  userCount,
}: Pick<DashboardWorkflowSource, 'accessiblePages' | 'adminCount' | 'aiProvider' | 'userCount'>): WorkflowCard[] {
  const cards: WorkflowCard[] = [];

  if (accessiblePages.includes('imagelab')) {
    cards.push({
      id: 'imagelab',
      title: 'Image Lab',
      eyebrow: aiProvider === 'none' ? 'AI identification offline' : aiProvider === 'github' ? 'GitHub Models ready' : 'OpenAI ready',
      detail: 'Batch-identify equipment from photos, optimize exports, and prep listing-ready image assets.',
      stats: [aiProvider === 'none' ? 'Manual image processing' : 'Equipment identification', 'Resize + watermark', 'Clipboard-ready copy'],
    });
  }

  if (accessiblePages.includes('users')) {
    cards.push({
      id: 'users',
      title: 'User Management',
      eyebrow: `${userCount} account${userCount === 1 ? '' : 's'} in workspace`,
      detail: 'Adjust page access, reset passwords, and keep operator permissions aligned with the current workflow.',
      stats: [`${adminCount} admin${adminCount === 1 ? '' : 's'}`, `${Math.max(0, userCount - adminCount)} operator${userCount - adminCount === 1 ? '' : 's'}`, `${accessiblePages.length} page${accessiblePages.length === 1 ? '' : 's'} available to you`],
    });
  }

  return cards;
}

export function buildDashboardSections({
  ebayCards,
  marketCards,
  utilityCards,
}: {
  ebayCards: WorkflowCard[];
  marketCards: WorkflowCard[];
  utilityCards: WorkflowCard[];
}): DashboardSection[] {
  const sections: DashboardSection[] = [
    { id: 'overview', label: 'Dashboard' },
    { id: 'listing-status', label: 'Listings' },
    { id: 'insights', label: 'Insights' },
    { id: 'inventory', label: 'Airtable' },
    { id: 'pipeline', label: 'Shopify' },
    { id: 'inquiries', label: 'JotForm' },
  ];

  if (ebayCards.length > 0) sections.push({ id: 'ebay-workflows', label: 'eBay' });
  if (marketCards.length > 0) sections.push({ id: 'market-research', label: 'HiFi Shark' });
  if (utilityCards.length > 0) sections.push({ id: 'utility-workflows', label: 'Utilities' });

  return sections;
}