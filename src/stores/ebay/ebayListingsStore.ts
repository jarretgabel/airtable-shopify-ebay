import { create } from 'zustand';
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
  setEnabled: (enabled: boolean) => void;
  bootstrap: (enabledOverride?: boolean) => Promise<void>;
  refetch: () => Promise<void>;
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
  setEnabled: (enabled) => {
    set({ enabled });
    if (!enabled) {
      set({ restoringSession: false, loading: false, initializing: false });
    }
  },
  bootstrap: async (enabledOverride) => {
    if (get().initializing) {
      return;
    }

    const enabled = enabledOverride ?? get().enabled;
    if (!enabled) {
      set({ restoringSession: false, loading: false });
      return;
    }

    set({ initializing: true });
    set({ restoringSession: true, loading: true, error: null });
    try {
      const snapshot = await getEbayDashboardSnapshot();
      set({ authenticated: true });
      applyListingSnapshot(set, snapshot);
    } catch (err) {
      handleAuthFailure(set, (err as Error).message);
    } finally {
      set({ loading: false, restoringSession: false, initializing: false });
    }
  },
  refetch: async () => {
    if (!get().enabled) return;

    set({ loading: true, error: null });
    try {
      const snapshot = await getEbayDashboardSnapshot();
      set({ authenticated: true });
      applyListingSnapshot(set, snapshot);
    } catch (err) {
      handleAuthFailure(set, (err as Error).message);
    } finally {
      set({ loading: false });
    }
  },
}));