import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { EbayInventoryItem, EbayOffer, EbayPublishedListing, EbayRuntimeConfig } from '@/services/ebay/types';
import { useEbayListingsStore } from '@/stores/ebay/ebayListingsStore';

export type { EbayPublishedListing } from '@/services/ebay/types';

export interface EbayListingsState {
  authenticated: boolean;
  restoringSession: boolean;
  loading: boolean;
  error: string | null;
  runtimeConfig: EbayRuntimeConfig | null;
  inventoryItems: EbayInventoryItem[];
  offers: EbayOffer[];
  recentListings: EbayPublishedListing[];
  total: number;
  refetch: () => void;
}

export function useEbayListings(enabled = true): EbayListingsState {
  const selector = useShallow((state: ReturnType<typeof useEbayListingsStore.getState>) => ({
    authenticated: state.authenticated,
    restoringSession: state.restoringSession,
    loading: state.loading,
    error: state.error,
    runtimeConfig: state.runtimeConfig,
    inventoryItems: state.inventoryItems,
    offers: state.offers,
    recentListings: state.recentListings,
    total: state.total,
    setEnabled: state.setEnabled,
    bootstrap: state.bootstrap,
    refetch: state.refetch,
  }));

  const {
    authenticated,
    restoringSession,
    loading,
    error,
    runtimeConfig,
    inventoryItems,
    offers,
    recentListings,
    total,
    setEnabled,
    bootstrap,
    refetch,
  } = useEbayListingsStore(selector);

  useEffect(() => {
    setEnabled(enabled);
    void bootstrap(enabled);
  }, [enabled, setEnabled, bootstrap]);

  return {
    authenticated,
    restoringSession,
    loading,
    error,
    runtimeConfig,
    inventoryItems,
    offers,
    recentListings,
    total,
    refetch,
  };
}
