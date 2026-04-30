import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardTab } from '@/components/DashboardTab';
import type { DashboardTabViewModel } from '@/app/appTabViewModels';

vi.mock('@/components/dashboard/DashboardSectionNav', () => ({
  DashboardSectionNav: () => <div>Section nav</div>,
}));

vi.mock('@/components/dashboard/DashboardOverviewInsightsSection', () => ({
  DashboardOverviewSection: () => <div>Overview section</div>,
  DashboardInsightsSection: () => <div>Insights section</div>,
}));

vi.mock('@/components/dashboard/DashboardAirtableSection', () => ({
  DashboardAirtableSection: ({ errorMessage }: { errorMessage?: string | null }) => <div>Airtable section:{errorMessage ?? 'ok'}</div>,
}));

vi.mock('@/components/dashboard/DashboardEbaySection', () => ({
  DashboardEbaySection: () => <div>eBay section</div>,
}));

vi.mock('@/components/dashboard/DashboardShopifySection', () => ({
  DashboardShopifySection: () => <div>Shopify section</div>,
}));

vi.mock('@/components/dashboard/DashboardJotformSection', () => ({
  DashboardJotformSection: () => <div>JotForm section</div>,
}));

vi.mock('@/components/dashboard/DashboardWorkflowSections', () => ({
  DashboardWorkflowSection: () => <div>Workflow section</div>,
}));

vi.mock('@/components/dashboard/DashboardActionsSection', () => ({
  DashboardActionsSection: () => <div>Actions section</div>,
}));

vi.mock('@/components/dashboard/useDashboardSectionTracking', () => ({
  useDashboardSectionTracking: () => ({
    activeSectionId: 'overview',
    scrollToSection: vi.fn(),
  }),
}));

function buildViewModel(): DashboardTabViewModel {
  return {
    loading: {
      airtable: false,
      shopify: false,
      jotform: false,
      approval: false,
      ebay: false,
      market: false,
    },
    data: {
      nonEmptyListings: [],
      products: [],
      jfSubmissions: [],
      thisWeekSubs: [],
      recentSubs: [],
      draftProducts: [],
      activeProducts: [],
      archivedProducts: [],
      submissionDays: [],
      topBrands: [],
      now: Date.now(),
      insights: [],
      componentTypeSummary: [],
      airtableBrandSummary: [],
      airtableDistributorSummary: [],
      airtableTypeTable: [],
    },
    kpis: {
      totalNewSubmissions: 0,
      acquisitionCost: 0,
      inventoryValue: 0,
      avgAskPrice: 0,
      sellThroughPct: null,
      grossMarginPct: null,
      submissionsTrend: { direction: 'flat', text: 'Flat' },
      dealsTrend: { direction: 'flat', text: 'Flat' },
      acquisitionTrend: { direction: 'flat', text: 'Flat' },
      inventoryTrend: { direction: 'flat', text: 'Flat' },
      salesTrend: { direction: 'flat', text: 'Flat' },
      marginTrend: { direction: 'flat', text: 'Flat' },
      maxDayCount: 0,
      airtableInventoryValue: 0,
      uniqueAirtableBrands: 0,
      uniqueAirtableTypes: 0,
      maxComponentTypeCount: 0,
      maxAirtableBrandCount: 0,
    },
    workflow: {
      accessiblePages: ['dashboard'],
      approvalError: null,
      approvalTotal: 0,
      approvalApproved: 0,
      approvalPending: 0,
      shopifyApprovalLoading: false,
      shopifyApprovalError: null,
      shopifyApprovalTotal: 0,
      shopifyApprovalApproved: 0,
      shopifyApprovalPending: 0,
      aiProvider: 'none',
      ebayAuthenticated: false,
      ebayRestoringSession: false,
      ebayError: null,
      ebayTotal: 0,
      ebayPublishedCount: 0,
      ebayDraftCount: 0,
      marketError: null,
      marketCurrentSlug: '',
      marketListingCount: 0,
      userCount: 0,
      adminCount: 0,
    },
    status: {
      sources: [
        { key: 'airtable', label: 'Inventory', error: 'Inventory fetch failed', hasData: true },
        { key: 'shopify', label: 'Shopify', error: null, hasData: true },
      ],
    },
    actions: {
      onSelectTab: vi.fn(),
    },
  };
}

describe('DashboardTab', () => {
  it('shows the partial-data notice and passes source errors through to sections', () => {
    render(<DashboardTab viewModel={buildViewModel()} />);

    expect(screen.getByText('Partial dashboard data')).toBeInTheDocument();
    expect(screen.getByText('Section nav')).toBeInTheDocument();
    expect(screen.getByText('Overview section')).toBeInTheDocument();
    expect(screen.getByText('Airtable section:Inventory fetch failed')).toBeInTheDocument();
    expect(screen.getByText('Shopify section')).toBeInTheDocument();
  });
});