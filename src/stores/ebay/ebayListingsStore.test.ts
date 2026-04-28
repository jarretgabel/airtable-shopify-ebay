import { getEbayDashboardSnapshot } from '@/services/app-api/ebay';
import { useEbayListingsStore } from '@/stores/ebay/ebayListingsStore';

vi.mock('@/services/app-api/ebay', () => ({
  getEbayDashboardSnapshot: vi.fn(),
}));

function createSnapshot(overrides: Partial<Awaited<ReturnType<typeof getEbayDashboardSnapshot>>> = {}) {
  return {
    inventoryItems: [{ sku: 'ABC123' }],
    offers: [{ sku: 'ABC123', offerId: 'offer-1', status: 'PUBLISHED' as const }],
    recentListings: [{ item: { sku: 'ABC123' }, offer: { sku: 'ABC123', offerId: 'offer-1', status: 'PUBLISHED' as const } }],
    total: 1,
    warning: null,
    runtimeConfig: {
      authMode: 'server' as const,
      environment: 'production' as const,
      defaultListingApiMode: 'inventory' as const,
      publishSetup: {
        locationConfig: {
          key: 'warehouse',
          name: 'Warehouse',
          country: 'US',
          postalCode: '10001',
          city: 'New York',
          stateOrProvince: 'NY',
        },
        policyConfig: {
          fulfillmentPolicyId: 'fulfillment',
          paymentPolicyId: 'payment',
          returnPolicyId: 'return',
        },
      },
      missingLocationFields: [],
      missingPolicyFields: [],
      hasRequiredPublishSetup: true,
    },
    ...overrides,
  };
}

function resetStore() {
  useEbayListingsStore.setState({
    enabled: true,
    initializing: false,
    authenticated: false,
    restoringSession: true,
    loading: false,
    error: null,
    runtimeConfig: null,
    inventoryItems: [],
    offers: [],
    recentListings: [],
    total: 0,
  });
}

describe('ebayListingsStore', () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(getEbayDashboardSnapshot).mockReset();
  });

  it('bootstraps the Lambda snapshot into store state', async () => {
    vi.mocked(getEbayDashboardSnapshot).mockResolvedValueOnce(createSnapshot());

    await useEbayListingsStore.getState().bootstrap();

    const state = useEbayListingsStore.getState();
    expect(getEbayDashboardSnapshot).toHaveBeenCalledTimes(1);
    expect(state.authenticated).toBe(true);
    expect(state.restoringSession).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.runtimeConfig?.environment).toBe('production');
    expect(state.inventoryItems).toHaveLength(1);
    expect(state.offers).toHaveLength(1);
    expect(state.recentListings).toHaveLength(1);
    expect(state.total).toBe(1);
  });

  it('surfaces snapshot warnings without failing authentication', async () => {
    vi.mocked(getEbayDashboardSnapshot).mockResolvedValueOnce(createSnapshot({ warning: 'Some offer details were skipped.' }));

    await useEbayListingsStore.getState().bootstrap();

    const state = useEbayListingsStore.getState();
    expect(state.authenticated).toBe(true);
    expect(state.error).toBe('Some offer details were skipped.');
  });

  it('clears listing data and stores the error when bootstrap fails', async () => {
    useEbayListingsStore.setState({
      authenticated: true,
      runtimeConfig: createSnapshot().runtimeConfig,
      inventoryItems: [{ sku: 'STALE' }],
      offers: [{ sku: 'STALE', offerId: 'offer-stale' }],
      recentListings: [{ item: { sku: 'STALE' }, offer: { sku: 'STALE', offerId: 'offer-stale' } }],
      total: 1,
    });
    vi.mocked(getEbayDashboardSnapshot).mockRejectedValueOnce(new Error('eBay Lambda unavailable'));

    await useEbayListingsStore.getState().bootstrap();

    const state = useEbayListingsStore.getState();
    expect(state.authenticated).toBe(false);
    expect(state.error).toBe('eBay Lambda unavailable');
    expect(state.runtimeConfig).toBeNull();
    expect(state.inventoryItems).toEqual([]);
    expect(state.offers).toEqual([]);
    expect(state.recentListings).toEqual([]);
    expect(state.total).toBe(0);
  });

  it('skips bootstrap work when disabled', async () => {
    await useEbayListingsStore.getState().bootstrap(false);

    const state = useEbayListingsStore.getState();
    expect(getEbayDashboardSnapshot).not.toHaveBeenCalled();
    expect(state.restoringSession).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.authenticated).toBe(false);
  });

  it('refetches the latest Lambda snapshot when enabled', async () => {
    vi.mocked(getEbayDashboardSnapshot)
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot({
        inventoryItems: [{ sku: 'XYZ999' }],
        offers: [{ sku: 'XYZ999', offerId: 'offer-2', status: 'UNPUBLISHED' }],
        recentListings: [],
        total: 1,
      }));

    await useEbayListingsStore.getState().bootstrap();
    await useEbayListingsStore.getState().refetch();

    const state = useEbayListingsStore.getState();
    expect(getEbayDashboardSnapshot).toHaveBeenCalledTimes(2);
    expect(state.authenticated).toBe(true);
    expect(state.inventoryItems[0]?.sku).toBe('XYZ999');
    expect(state.offers[0]?.offerId).toBe('offer-2');
    expect(state.recentListings).toEqual([]);
  });
});