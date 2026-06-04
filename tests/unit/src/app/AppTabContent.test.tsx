import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/components/tabs/WorkflowGuideTab', () => ({
  WorkflowGuideTab: () => <div>Workflow guide content</div>,
}));

vi.mock('@/components/tabs/WorkflowGuideEditorTab', () => ({
  WorkflowGuideEditorTab: () => <div>Workflow guide editor content</div>,
}));

vi.mock('@/components/UserManagementTab', () => ({
  UserManagementTab: () => <div>User management content</div>,
}));

vi.mock('@/components/EbayTab', () => ({
  EbayTab: () => <div>eBay content</div>,
}));

vi.mock('@/components/approval/CombinedListingsApprovalTab', () => ({
  CombinedListingsApprovalTab: () => <div>Combined listings content</div>,
}));

vi.mock('@/components/approval/EbayListingsDirectoryTab', () => ({
  EbayListingsDirectoryTab: () => <div>eBay directory content</div>,
}));

vi.mock('@/components/approval/EbaySnapshotRecordPage', () => ({
  EbaySnapshotRecordPage: () => <div>eBay snapshot record page</div>,
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

vi.mock('@/components/approval/ShopifyListingsDirectoryTab', () => ({
  ShopifyListingsDirectoryTab: () => <div>Shopify directory content</div>,
}));

vi.mock('@/components/approval/ShopifySnapshotRecordPage', () => ({
  ShopifySnapshotRecordPage: () => <div>Shopify snapshot record page</div>,
}));

vi.mock('@/components/approval/ListingApprovalSoldReadyRecordPage', () => ({
  ListingApprovalSoldReadyRecordPage: () => <div>Sold-ready record page</div>,
}));

vi.mock('@/components/tabs/JotformTab', () => ({
  JotformTab: () => <div>JotForm content</div>,
}));

vi.mock('@/components/tabs/InventoryPriceEditorPage', () => ({
  InventoryPriceEditorPage: ({ recordId }: { recordId: string }) => <div>Inventory price editor {recordId}</div>,
}));

vi.mock('@/components/tabs/UsedGearParkingLotArrivalGroupPage', () => ({
  UsedGearParkingLotArrivalGroupPage: ({ groupId }: { groupId: string }) => <div>Parking Lot arrival handoff {groupId}</div>,
}));

vi.mock('@/components/tabs/UsedGearTrashReviewGroupPage', () => ({
  UsedGearTrashReviewGroupPage: ({ groupId }: { groupId: string }) => <div>Trash review group {groupId}</div>,
}));

vi.mock('@/components/tabs/UsedGearParkingLotArrivalRecordPage', () => ({
  UsedGearParkingLotArrivalRecordPage: ({ recordId }: { recordId: string }) => <div>Parking Lot arrival review {recordId}</div>,
}));

vi.mock('@/components/tabs/UsedGearManualIntakePage', () => ({
  UsedGearManualIntakePage: () => <div>Manual intake page</div>,
}));

vi.mock('@/components/tabs/UsedGearWorkflowSourceDirectoryPage', () => ({
  UsedGearWorkflowSourceDirectoryPage: ({
    title,
    secondaryActionLabel,
    onSecondaryAction,
  }: {
    title: string;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
  }) => <div>
    <div>{title} directory page</div>
    {secondaryActionLabel && onSecondaryAction ? <button type="button" onClick={onSecondaryAction}>{secondaryActionLabel}</button> : null}
  </div>,
}));

vi.mock('@/components/tabs/TestingFormTab', () => ({
  TestingFormTab: ({ recordId }: { recordId: string }) => <div>Testing form {recordId}</div>,
}));

vi.mock('@/components/tabs/PhotosFormTab', () => ({
  PhotosFormTab: ({ recordId }: { recordId: string }) => <div>Photos form {recordId}</div>,
}));

vi.mock('@/components/tabs/UsedGearWorkflowQueueTab', () => ({
  UsedGearWorkflowQueueTab: ({ queueMode }: { queueMode: string }) => <div>{queueMode} queue content</div>,
}));

vi.mock('@/components/tabs/ArchiveQueueTab', () => ({
  ArchiveQueueTab: () => <div>Archive queue content</div>,
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
    manualIntakeMode: false,
    jotformReviewGroupId: null,
    jotformReviewRecordId: null,
    jotformDirectoryRecordId: null,
    parkingLotArrivalGroupId: null,
    parkingLotArrivalRecordId: null,
    trashReviewGroupId: null,
    trashReviewRecordId: null,
    manualIntakeRecordId: null,
    testingRecordId: null,
    photosRecordId: null,
    inventoryRecordId: null,
    inventoryPriceEditorRecordId: null,
    listingsRecordId: null,
    soldReadyListingsRecordId: null,
    shopifyListingsRecordId: null,
    ebayListingsRecordId: null,
    userRecordId: null,
    navigateToInventoryRecord: vi.fn(),
    navigateToInventoryPriceEditor: vi.fn(),
    navigateToUsedGearOperationalRecord: vi.fn(),
    navigateToInventoryList: vi.fn(),
    navigateToInventoryWorkflowView: vi.fn(),
    navigateToInventoryPostPublishBucket: vi.fn(),
    navigateToPath: vi.fn(),
    navigateToManualIntake: vi.fn(),
    navigateToCreateIntakeItem: vi.fn(),
    navigateToManualIntakeForm: vi.fn(),
    navigateToTestingForm: vi.fn(),
    navigateToPhotosForm: vi.fn(),
    navigateToListingsRecord: vi.fn(),
    navigateToSoldReadyListingRecord: vi.fn(),
    navigateToListingsList: vi.fn(),
    navigateToShopifyRecord: vi.fn(),
    navigateToShopifyList: vi.fn(),
    navigateToEbayRecord: vi.fn(),
    navigateToEbayList: vi.fn(),
    navigateToUserRecord: vi.fn(),
    navigateToUsersList: vi.fn(),
    navigateToTab: vi.fn(),
    navigateToParkingLotPendingReviewGroup: vi.fn(),
    runtimeFeatures: buildRuntimeFeatures(),
    metrics: {} as AppTabContentProps['metrics'],
    accessiblePages: ['dashboard'],
    currentUserRole: 'admin',
    currentUserName: 'Taylor Reviewer',
    aiProvider: 'none',
    usersCount: 0,
    adminCount: 0,
    nonEmptyListings: [],
    displayValue: (value) => String(value ?? ''),
    hasValue: (value) => value !== null && value !== undefined && String(value).trim().length > 0,
    recordTitle: () => '',
    airtableRefetch: vi.fn(async () => {}),
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
    workflowDashboardTargets: {
      loading: false,
      error: null,
      pendingReviewOldestGroup: { id: null, label: null },
      progressOldestGroup: { id: null, label: null },
      refetch: vi.fn(),
    },
    workflowAnalytics: {
      loading: false,
      error: null,
      totalCount: 0,
      pendingReviewCount: 0,
      trashCount: 0,
      progressCount: 0,
      postPublishCount: 0,
      statusCounts: {
        'Pending Review': 0,
        'Unqualified': 0,
        'Accepted - Awaiting Arrival': 0,
        'Accepted - Arrived, Awaiting SKU': 0,
        'Accepted - Arrived, Awaiting Missing Item': 0,
        'Testing In Progress': 0,
        'Photography In Progress': 0,
        'Awaiting Pre-Listing Review': 0,
        'Approved for Publish': 0,
        'Listed, Shopify': 0,
        'Listed, eBay': 0,
        'Stale Listing, Shopify': 0,
        'Stale Listing, eBay': 0,
        'Sold - Ready to Ship': 0,
        'Shipped': 0,
      },
      marketplace: {
        shopifyLiveCount: 0,
        shopifyStaleCount: 0,
        ebayLiveCount: 0,
        ebayStaleCount: 0,
        soldReadyCount: 0,
        shippedCount: 0,
      },
      ownership: {
        pendingReviewMineCount: 0,
        pendingReviewUnassignedCount: 0,
        progressMineCount: 0,
        progressUnassignedCount: 0,
      },
      postSale: {
        exceptionCount: 0,
        unresolvedExceptionCount: 0,
        resolvedExceptionCount: 0,
        cancelledCount: 0,
        refundedCount: 0,
        returnedCount: 0,
        partialRefundCount: 0,
        returnReceivedCount: 0,
        refundExposure: 0,
        missingDispositionCount: 0,
      },
      age: {
        pendingReviewAlertCount: 0,
        oldestPendingReviewAgeDays: null,
        progressAlertCount: 0,
        oldestProgressAgeDays: null,
        activeNearStaleCount: 0,
        staleFollowUpCount: 0,
        oldestListedAgeDays: null,
        oldestStaleAgeDays: null,
      },
      lifecycle: {
        averageDaysToSell: null,
        averageDaysToShip: null,
        soldReadyAwaitingShipmentCount: 0,
        oldestSoldReadyAgeDays: null,
      },
      refetch: vi.fn(),
    },
    workflowPostPublishLoading: false,
    workflowPostPublishError: null,
    workflowActiveListingCount: 0,
    workflowStaleListingCount: 0,
    workflowStaleListingMineCount: 0,
    workflowStaleListingUnassignedCount: 0,
    workflowSoldReadyCount: 0,
    workflowSoldReadyMineCount: 0,
    workflowSoldReadyUnassignedCount: 0,
    workflowShippedCount: 0,
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
      manualIntakeMode: false,
      jotformReviewGroupId: null,
      jotformReviewRecordId: null,
      parkingLotArrivalGroupId: null,
      parkingLotArrivalRecordId: null,
      trashReviewGroupId: null,
      trashReviewRecordId: null,
      manualIntakeRecordId: null,
      testingRecordId: null,
      photosRecordId: null,
      inventoryRecordId: null,
      inventoryPriceEditorRecordId: null,
      listingsRecordId: null,
      shopifyListingsRecordId: null,
      ebayListingsRecordId: null,
      userRecordId: null,
    };

    const { rerender } = render(<AppTabContent {...initialProps} />);

    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('Shopify directory content')).not.toBeInTheDocument();

    mockUseDeferredValue.mockImplementation(() => pendingDeferredRouteState);

    rerender(<AppTabContent {...buildProps({ activeTab: 'shopify' })} />);

    expect(screen.getByText('Loading Shopify...')).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('Shopify directory content')).not.toBeInTheDocument();

    mockUseDeferredValue.mockImplementation((value) => value);

    rerender(<AppTabContent {...buildProps({ activeTab: 'shopify' })} />);

    await waitFor(() => {
      expect(screen.getByText('Shopify directory content')).toBeInTheDocument();
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

  it('routes the workflow guide tab to the reference page', async () => {
    render(<AppTabContent {...buildProps({ activeTab: 'workflow-guide', accessiblePages: ['dashboard', 'workflow-guide'] })} />);

    expect(await screen.findByText('Workflow guide content')).toBeInTheDocument();
  });

  it('routes the workflow guide editor tab to the isolated editor page', async () => {
    render(<AppTabContent {...buildProps({ activeTab: 'workflow-guide-editor', accessiblePages: ['dashboard', 'workflow-guide', 'workflow-guide-editor'] })} />);

    expect(await screen.findByText('Workflow guide editor content')).toBeInTheDocument();
  });

  it('renders isolated Shopify and eBay snapshot detail pages for service-specific deep links', async () => {
    const { rerender } = render(
      <AppTabContent
        {...buildProps({
          activeTab: 'shopify',
          shopifyListingsRecordId: '12345',
        })}
      />,
    );

    expect(await screen.findByText('Shopify snapshot record page')).toBeInTheDocument();
    expect(screen.queryByText('Shopify directory content')).not.toBeInTheDocument();

    rerender(
      <AppTabContent
        {...buildProps({
          activeTab: 'ebay',
          ebayListingsRecordId: 'sku-123',
        })}
      />,
    );

    expect(await screen.findByText('eBay snapshot record page')).toBeInTheDocument();
    expect(screen.queryByText('eBay directory content')).not.toBeInTheDocument();
  });

  it('renders degraded-mode guidance instead of feature tabs when runtime config is missing', async () => {
    const { rerender } = render(
      <AppTabContent
        {...buildProps({
          activeTab: 'jotform-audit',
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

    expect(await screen.findByText('JotForm Audit unavailable')).toBeInTheDocument();
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

    expect(await screen.findByText('eBay directory content')).toBeInTheDocument();

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

  it('shows a JotForm page action that opens JotForm Feed', async () => {
    const navigateToTab = vi.fn();

    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'jotform',
          navigateToTab,
        })}
      />,
    );

    expect(await screen.findByText('JotForm directory page')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'JotForm Feed' }));

    expect(navigateToTab).toHaveBeenCalledWith('jotform-audit');
  });

  it('renders the dedicated inventory price editor for inventory price routes', async () => {
    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'inventory',
          inventoryPriceEditorRecordId: 'rec-price-1',
        })}
      />,
    );

    expect(await screen.findByText('Inventory price editor rec-price-1')).toBeInTheDocument();
  });

  it('renders the dedicated Parking Lot arrival handoff page for grouped arrival routes', async () => {
    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'parking-lot',
          parkingLotArrivalGroupId: 'set-1',
        })}
      />,
    );

    expect(await screen.findByText('Parking Lot arrival handoff set-1')).toBeInTheDocument();
  });

  it('renders the dedicated Parking Lot arrival review page for record routes', async () => {
    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'parking-lot',
          parkingLotArrivalRecordId: 'rec-lot-two-1',
        })}
      />,
    );

    expect(await screen.findByText('Parking Lot arrival review rec-lot-two-1')).toBeInTheDocument();
  });

  it('renders the dedicated Trash Review group page for grouped trash routes', async () => {
    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'trash-review',
          trashReviewGroupId: 'trash-set-a',
        })}
      />,
    );

    expect(await screen.findByText('Trash review group trash-set-a')).toBeInTheDocument();
  });

  it('renders the dedicated Archive page for completed shipped items', async () => {
    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'archive',
        })}
      />,
    );

    expect(await screen.findByText('Archive queue content')).toBeInTheDocument();
  });

  it('renders the manual-intake directory for the manual-intake route', async () => {
    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'manual-intake',
          manualIntakeMode: true,
        })}
      />,
    );

    expect(await screen.findByText('Manual Intake directory page')).toBeInTheDocument();
  });

  it('falls back to the testing queue when no testing record id is present', async () => {
    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'testing',
          testingRecordId: null,
        })}
      />,
    );

    expect(await screen.findByText('testing queue content')).toBeInTheDocument();
  });

  it('falls back to the photography queue when no photos record id is present', async () => {
    render(
      <AppTabContent
        {...buildProps({
          activeTab: 'photos',
          photosRecordId: null,
        })}
      />,
    );

    expect(await screen.findByText('photography queue content')).toBeInTheDocument();
  });
});