import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppTabContent } from '@/app/AppTabContent';
import type { AppTabContentProps } from '@/app/appTabContentTypes';
import type { RuntimeFeatureMap } from '@/config/runtimeCapabilities';

const { mockUseDeferredValue } = vi.hoisted(() => ({
  mockUseDeferredValue: vi.fn(<T,>(value: T) => value),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useDeferredValue: mockUseDeferredValue,
  };
});

vi.mock('@/app/appTabContentMappers', () => ({
  buildAirtableTabViewModel: vi.fn(() => ({})),
  buildApprovalTabViewModel: vi.fn(() => ({})),
  buildDashboardTabViewModel: vi.fn(() => ({})),
  buildEbayTabViewModel: vi.fn(() => ({})),
  buildJotformTabViewModel: vi.fn(() => ({})),
  buildMarketTabViewModel: vi.fn(() => ({})),
  buildShopifyTabViewModel: vi.fn(() => ({})),
  buildUsersTabViewModel: vi.fn(() => ({})),
}));

vi.mock('@/components/DashboardTab', () => ({
  DashboardTab: () => <div>Dashboard content</div>,
}));

vi.mock('@/components/UserManagementTab', () => ({
  UserManagementTab: () => <div>User management content</div>,
}));

vi.mock('@/components/EbayTab', () => ({
  EbayTab: () => <div>eBay content</div>,
}));

vi.mock('@/components/approval/EbayListingApprovalTab', () => ({
  EbayListingApprovalTab: () => <div>eBay approval content</div>,
}));

vi.mock('@/components/approval/ShopifyListingApprovalTab', () => ({
  ShopifyListingApprovalTab: () => <div>Shopify approval content</div>,
}));

vi.mock('@/components/approval/CombinedListingsApprovalTab', () => ({
  CombinedListingsApprovalTab: () => <div>Combined listings content</div>,
}));

vi.mock('@/components/SettingsTab', () => ({
  SettingsTab: () => <div>Settings content</div>,
}));

vi.mock('@/components/NotificationsTab', () => ({
  NotificationsTab: () => <div>Notifications content</div>,
}));

vi.mock('@/components/tabs/ShopifyTab', () => ({
  ShopifyTab: () => <div>Shopify content</div>,
}));

vi.mock('@/components/tabs/JotformTab', () => ({
  JotformTab: () => <div>JotForm content</div>,
}));

function buildRuntimeFeatures(overrides: Partial<RuntimeFeatureMap> = {}): RuntimeFeatureMap {
  return {
    jotform: { available: true, message: null, missingEnvNames: [] },
    ebay: { available: true, message: null, missingEnvNames: [] },
    approvalEbay: { available: true, message: null, missingEnvNames: [] },
    approvalShopify: { available: true, message: null, missingEnvNames: [] },
    approvalCombined: { available: true, message: null, missingEnvNames: [] },
    ...overrides,
  };
}

function buildProps(overrides: Partial<AppTabContentProps> = {}): AppTabContentProps {
  return {
    activeTab: 'dashboard',
    incomingGearRecordId: null,
    testingRecordId: null,
    photosRecordId: null,
    inventoryRecordId: null,
    listingsRecordId: null,
    approvalRecordId: null,
    shopifyApprovalRecordId: null,
    userRecordId: null,
    navigateToInventoryRecord: vi.fn(),
    navigateToInventoryList: vi.fn(),
    navigateToIncomingGearForm: vi.fn(),
    navigateToTestingForm: vi.fn(),
    navigateToPhotosForm: vi.fn(),
    navigateToListingsRecord: vi.fn(),
    navigateToListingsList: vi.fn(),
    navigateToApprovalRecord: vi.fn(),
    navigateToApprovalList: vi.fn(),
    navigateToShopifyApprovalRecord: vi.fn(),
    navigateToShopifyApprovalList: vi.fn(),
    navigateToUserRecord: vi.fn(),
    navigateToUsersList: vi.fn(),
    navigateToTab: vi.fn(),
    runtimeFeatures: buildRuntimeFeatures(),
    metrics: {} as AppTabContentProps['metrics'],
    accessiblePages: ['dashboard'],
    aiProvider: 'none',
    usersCount: 0,
    adminCount: 0,
    nonEmptyListings: [],
    displayValue: (value) => String(value ?? ''),
    hasValue: (value) => value !== null && value !== undefined && String(value).trim().length > 0,
    recordTitle: () => '',
    atLoading: false,
    atError: null,
    products: [],
    storeDomain: '',
    spLoading: false,
    spError: null,
    jfSubmissions: [],
    jfLoading: false,
    jfPolling: false,
    jfError: null,
    jfRefetch: vi.fn(),
    jfLastUpdated: null,
    jfFreshCount: 0,
    jfClearFresh: vi.fn(),
    totalNewSubmissions: 0,
    approvalLoading: false,
    approvalError: null,
    approvalTotal: 0,
    approvalApproved: 0,
    approvalPending: 0,
    shopifyApprovalLoading: false,
    shopifyApprovalError: null,
    shopifyApprovalTotal: 0,
    shopifyApprovalApproved: 0,
    shopifyApprovalPending: 0,
    ebayAuthenticated: false,
    ebayRestoringSession: false,
    ebayLoading: false,
    ebayError: null,
    ebayRuntimeConfig: null,
    ebayInventoryItems: [],
    ebayOffers: [],
    ebayRecentListings: [],
    ebayTotal: 0,
    ebayPublishedCount: 0,
    ebayDraftCount: 0,
    ebayRefetch: vi.fn(),
    sharkLoading: false,
    sharkError: null,
    sharkListings: [],
    sharkSearch: vi.fn(),
    currentSlug: '',
    ...overrides,
  };
}

describe('AppTabContent', () => {
  beforeEach(() => {
    mockUseDeferredValue.mockReset();
    mockUseDeferredValue.mockImplementation((value) => value);
  });

  it('keeps the previous tab visible while a deferred tab transition is pending', async () => {
    const initialProps = buildProps();
    const pendingDeferredRouteState = {
      activeTab: 'dashboard',
      incomingGearRecordId: null,
      testingRecordId: null,
      photosRecordId: null,
      inventoryRecordId: null,
      listingsRecordId: null,
      approvalRecordId: null,
      shopifyApprovalRecordId: null,
      userRecordId: null,
    };

    const { rerender } = render(<AppTabContent {...initialProps} />);

    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('Shopify content')).not.toBeInTheDocument();

    mockUseDeferredValue.mockImplementation(() => pendingDeferredRouteState);

    rerender(<AppTabContent {...buildProps({ activeTab: 'shopify' })} />);

    expect(screen.getByText('Loading Shopify...')).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('Shopify content')).not.toBeInTheDocument();

    mockUseDeferredValue.mockImplementation((value) => value);

    rerender(<AppTabContent {...buildProps({ activeTab: 'shopify' })} />);

    await waitFor(() => {
      expect(screen.getByText('Shopify content')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading Shopify...')).not.toBeInTheDocument();
  });

  it('routes users, settings, and notifications tabs to the expected screens', async () => {
    const { rerender } = render(<AppTabContent {...buildProps({ activeTab: 'users', accessiblePages: ['dashboard', 'users', 'settings', 'notifications'] })} />);

    expect(await screen.findByText('User management content')).toBeInTheDocument();

    rerender(<AppTabContent {...buildProps({ activeTab: 'settings', accessiblePages: ['dashboard', 'users', 'settings', 'notifications'] })} />);
    expect(await screen.findByText('Settings content')).toBeInTheDocument();

    rerender(<AppTabContent {...buildProps({ activeTab: 'notifications', accessiblePages: ['dashboard', 'users', 'settings', 'notifications'] })} />);
    expect(await screen.findByText('Notifications content')).toBeInTheDocument();
  });

  it('renders degraded-mode guidance instead of feature tabs when runtime config is missing', async () => {
    const { rerender } = render(
      <AppTabContent
        {...buildProps({
          activeTab: 'jotform',
          runtimeFeatures: buildRuntimeFeatures({
            jotform: {
              available: false,
              message: 'Missing public runtime config: VITE_JOTFORM_FORM_ID. Configure a JotForm form id to enable inquiry polling and dashboard submission metrics.',
              missingEnvNames: ['VITE_JOTFORM_FORM_ID'],
            },
          }),
        })}
      />,
    );

    expect(await screen.findByText('JotForm unavailable')).toBeInTheDocument();
    expect(screen.queryByText('JotForm content')).not.toBeInTheDocument();

    rerender(
      <AppTabContent
        {...buildProps({
          activeTab: 'ebay',
          runtimeFeatures: buildRuntimeFeatures({
            ebay: {
              available: false,
              message: 'Missing public runtime config: VITE_EBAY_AUTH_HOST. Configure the eBay runtime bundle to enable the eBay dashboard and listing tools.',
              missingEnvNames: ['VITE_EBAY_AUTH_HOST'],
            },
          }),
        })}
      />,
    );

    expect(await screen.findByText('eBay unavailable')).toBeInTheDocument();
    expect(screen.queryByText('eBay content')).not.toBeInTheDocument();

    rerender(
      <AppTabContent
        {...buildProps({
          activeTab: 'approval',
          runtimeFeatures: buildRuntimeFeatures({
            approvalEbay: {
              available: false,
              message: 'Missing public runtime config: VITE_AIRTABLE_APPROVAL_TABLE_REF. Configure the eBay approval Airtable source to enable the approval queue and dashboard summary.',
              missingEnvNames: ['VITE_AIRTABLE_APPROVAL_TABLE_REF'],
            },
          }),
        })}
      />,
    );

    expect(await screen.findByText('eBay approval unavailable')).toBeInTheDocument();
    expect(screen.queryByText('eBay approval content')).not.toBeInTheDocument();

    rerender(
      <AppTabContent
        {...buildProps({
          activeTab: 'shopify-approval',
          runtimeFeatures: buildRuntimeFeatures({
            approvalShopify: {
              available: false,
              message: 'Missing public runtime config: VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF. Configure the Shopify approval Airtable source to enable the approval queue and dashboard summary.',
              missingEnvNames: ['VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF'],
            },
          }),
        })}
      />,
    );

    expect(await screen.findByText('Shopify approval unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Shopify approval content')).not.toBeInTheDocument();

    rerender(
      <AppTabContent
        {...buildProps({
          activeTab: 'listings',
          runtimeFeatures: buildRuntimeFeatures({
            approvalCombined: {
              available: false,
              message: 'Missing public runtime config: VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF. Configure the combined listings Airtable source to enable the combined approval workflow.',
              missingEnvNames: ['VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF'],
            },
          }),
        })}
      />,
    );

    expect(await screen.findByText('Combined listings unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Combined listings content')).not.toBeInTheDocument();
  });
});