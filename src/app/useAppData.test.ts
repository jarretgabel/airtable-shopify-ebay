import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeFeatureMap } from '@/config/runtimeCapabilities';
import { useAppData } from '@/app/useAppData';

const {
  mockUseListings,
  mockUseShopifyProducts,
  mockUseHiFiShark,
  mockUseEbayListings,
  mockUseApprovalQueueSummary,
  mockUseShopifyApprovalQueueSummary,
  mockUseJotFormInquiries,
  mockUseDashboardMetrics,
  mockGetRuntimeFeatureCapabilities,
} = vi.hoisted(() => ({
  mockUseListings: vi.fn(),
  mockUseShopifyProducts: vi.fn(),
  mockUseHiFiShark: vi.fn(),
  mockUseEbayListings: vi.fn(),
  mockUseApprovalQueueSummary: vi.fn(),
  mockUseShopifyApprovalQueueSummary: vi.fn(),
  mockUseJotFormInquiries: vi.fn(),
  mockUseDashboardMetrics: vi.fn(),
  mockGetRuntimeFeatureCapabilities: vi.fn<() => RuntimeFeatureMap>(),
}));

vi.mock('@/config/runtimeEnv', () => ({
  requireEnv: vi.fn(() => 'Inventory'),
  checkOptionalEnv: vi.fn(() => ''),
}));

vi.mock('@/config/runtimeCapabilities', () => ({
  getRuntimeFeatureCapabilities: mockGetRuntimeFeatureCapabilities,
}));

vi.mock('@/hooks/useListings', () => ({
  useListings: mockUseListings,
}));

vi.mock('@/hooks/useShopifyProducts', () => ({
  useShopifyProducts: mockUseShopifyProducts,
}));

vi.mock('@/hooks/useHiFiShark', () => ({
  useHiFiShark: mockUseHiFiShark,
}));

vi.mock('@/hooks/useEbayListings', () => ({
  useEbayListings: mockUseEbayListings,
}));

vi.mock('@/hooks/useApprovalQueueSummary', () => ({
  useApprovalQueueSummary: mockUseApprovalQueueSummary,
}));

vi.mock('@/hooks/useShopifyApprovalQueueSummary', () => ({
  useShopifyApprovalQueueSummary: mockUseShopifyApprovalQueueSummary,
}));

vi.mock('@/hooks/useJotForm', () => ({
  useJotFormInquiries: mockUseJotFormInquiries,
}));

vi.mock('@/hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: mockUseDashboardMetrics,
}));

vi.mock('@/services/equipmentAI', () => ({
  getAIProvider: vi.fn(() => ({ provider: 'none' })),
}));

const unavailableFeatures: RuntimeFeatureMap = {
  jotform: {
    available: false,
    message: 'Missing public runtime config: VITE_JOTFORM_FORM_ID.',
    missingEnvNames: ['VITE_JOTFORM_FORM_ID'],
  },
  ebay: {
    available: false,
    message: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
    missingEnvNames: ['VITE_EBAY_AUTH_HOST'],
  },
  approvalEbay: {
    available: false,
    message: 'Missing public runtime config: VITE_AIRTABLE_APPROVAL_TABLE_REF.',
    missingEnvNames: ['VITE_AIRTABLE_APPROVAL_TABLE_REF'],
  },
  approvalShopify: {
    available: false,
    message: 'Missing public runtime config: VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF.',
    missingEnvNames: ['VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF'],
  },
  approvalCombined: {
    available: false,
    message: 'Missing public runtime config: VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF.',
    missingEnvNames: ['VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF'],
  },
};

describe('useAppData', () => {
  beforeEach(() => {
    mockGetRuntimeFeatureCapabilities.mockReset();
    mockGetRuntimeFeatureCapabilities.mockReturnValue(unavailableFeatures);
    mockUseListings.mockReset();
    mockUseListings.mockReturnValue({ listings: [], loading: false, error: null, refetch: vi.fn() });
    mockUseShopifyProducts.mockReset();
    mockUseShopifyProducts.mockReturnValue({ products: [], loading: false, error: null, refetch: vi.fn() });
    mockUseHiFiShark.mockReset();
    mockUseHiFiShark.mockReturnValue({ listings: [], loading: false, error: null, currentSlug: '', search: vi.fn() });
    mockUseEbayListings.mockReset();
    mockUseEbayListings.mockReturnValue({
      authenticated: false,
      restoringSession: false,
      loading: false,
      error: null,
      runtimeConfig: null,
      inventoryItems: [],
      offers: [],
      recentListings: [],
      total: 0,
      refetch: vi.fn(),
    });
    mockUseApprovalQueueSummary.mockReset();
    mockUseApprovalQueueSummary.mockReturnValue({ loading: false, error: null, total: 0, approved: 0, pending: 0, refetch: vi.fn() });
    mockUseShopifyApprovalQueueSummary.mockReset();
    mockUseShopifyApprovalQueueSummary.mockReturnValue({ loading: false, error: null, total: 0, approved: 0, pending: 0, refetch: vi.fn() });
    mockUseJotFormInquiries.mockReset();
    mockUseJotFormInquiries.mockReturnValue({ submissions: [], loading: false, polling: false, error: null, refetch: vi.fn(), lastUpdated: null, freshCount: 0, clearFresh: vi.fn() });
    mockUseDashboardMetrics.mockReset();
    mockUseDashboardMetrics.mockReturnValue({
      thisWeekSubs: [],
      recentSubs: [],
      draftProducts: [],
      activeProducts: [],
      archivedProducts: [],
      submissionDays: [],
      topBrands: [],
      now: 0,
      insights: [],
      componentTypeSummary: [],
      airtableBrandSummary: [],
      airtableDistributorSummary: [],
      airtableTypeTable: [],
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
    });
  });

  it('disables optional feature fetches when runtime config is unavailable', () => {
    const { result } = renderHook(() => useAppData({
      activeTab: 'dashboard',
      canAccessPage: () => true,
      users: [{ role: 'admin' }],
    }));

    expect(mockUseEbayListings).toHaveBeenCalledWith(false);
    expect(mockUseApprovalQueueSummary).toHaveBeenCalledWith(false);
    expect(mockUseShopifyApprovalQueueSummary).toHaveBeenCalledWith(false);
    expect(mockUseJotFormInquiries).toHaveBeenCalledWith('', 60_000, false);
    expect(result.current.runtimeFeatures).toEqual(unavailableFeatures);
  });
});