import { create } from 'zustand';
import { TAB_DATA_TTLS, shouldReuseTabData } from '@/app/tabDataCache';
import { getEbayDashboardSnapshot } from '@/services/app-api/ebay';
import type { EbayRuntimeConfig, EbayInventoryItem, EbayOffer, EbayPublishedListing } from '@/services/ebay/types';

interface EbayListingsStoreState {
  enabled: boolean;
  initializing: boolean;
  authenticated: boolean;
  restoringSession: boolean;
  loading: boolean;
  error: string | null;
  runtimeConfig: EbayRuntimeConfig | null;
  inventoryItems: EbayInventoryItem[];
  offers: EbayOffer[];
  recentListings: EbayPublishedListing[];
  total: number;
  lastLoadedAt: number | null;
  setEnabled: (enabled: boolean) => void;
  bootstrap: (enabledOverride?: boolean, force?: boolean) => Promise<void>;
  refetch: (force?: boolean) => Promise<void>;
}

function clearListingData(set: (partial: Partial<EbayListingsStoreState>) => void): void {
  set({
    runtimeConfig: null,
    inventoryItems: [],
    offers: [],
    recentListings: [],
    total: 0,
  });
}

function applyListingSnapshot(set: (partial: Partial<EbayListingsStoreState>) => void, snapshot: Awaited<ReturnType<typeof getEbayDashboardSnapshot>>): void {
  set({
    runtimeConfig: snapshot.runtimeConfig,
    inventoryItems: snapshot.inventoryItems,
    offers: snapshot.offers,
    recentListings: snapshot.recentListings,
    total: snapshot.total,
    error: snapshot.warning,
  });
}

function handleAuthFailure(set: (partial: Partial<EbayListingsStoreState>) => void, message: string): void {
  clearListingData(set);
  set({
    authenticated: false,
    error: message,
  });
}

export const useEbayListingsStore = create<EbayListingsStoreState>((set, get) => ({
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
  lastLoadedAt: null,
  setEnabled: (enabled) => {
    set({ enabled });
    if (!enabled) {
      set({ restoringSession: false, loading: false, initializing: false });
    }
  },
  bootstrap: async (enabledOverride, force = false) => {
    if (get().initializing) {
      return;
    }

    const enabled = enabledOverride ?? get().enabled;
    if (!enabled) {
      set({ restoringSession: false, loading: false });
      return;
    }

    if (!force && shouldReuseTabData(get().lastLoadedAt, TAB_DATA_TTLS.ebayDashboard, get().error === null)) {
      set({ restoringSession: false, loading: false, initializing: false });
      return;
    }

    set({ initializing: true });
    set({ restoringSession: true, loading: true, error: null });
    try {
      const snapshot = await getEbayDashboardSnapshot();
      set({ authenticated: true, lastLoadedAt: Date.now() });
      applyListingSnapshot(set, snapshot);
    } catch (err) {
      handleAuthFailure(set, (err as Error).message);
    } finally {
      set({ loading: false, restoringSession: false, initializing: false });
    }
  },
  refetch: async (force = true) => {
    if (!get().enabled) return;

    if (!force && shouldReuseTabData(get().lastLoadedAt, TAB_DATA_TTLS.ebayDashboard, get().error === null)) {
      set({ loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const snapshot = await getEbayDashboardSnapshot();
      set({ authenticated: true, lastLoadedAt: Date.now() });
      applyListingSnapshot(set, snapshot);
    } catch (err) {
      handleAuthFailure(set, (err as Error).message);
    } finally {
      set({ loading: false });
    }
  },
}));