import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { EbayInventoryItem, EbayOffer } from '@/services/ebay';
import type { EbayPublishedListing } from '@/hooks/ebayListingsHelpers';
import { useEbayListingsStore } from '@/stores/ebay/ebayListingsStore';

export type { EbayPublishedListing } from '@/hooks/ebayListingsHelpers';

export interface EbayListingsState {
  authenticated: boolean;
  restoringSession: boolean;
  loading: boolean;
  error: string | null;
  inventoryItems: EbayInventoryItem[];
  offers: EbayOffer[];
  recentListings: EbayPublishedListing[];
  total: number;
  refetch: () => void;
  disconnect: () => void;
}

export function useEbayListings(enabled = true): EbayListingsState {
  const selector = useShallow((state: ReturnType<typeof useEbayListingsStore.getState>) => ({
    authenticated: state.authenticated,
    restoringSession: state.restoringSession,
    loading: state.loading,
    error: state.error,
    inventoryItems: state.inventoryItems,
    offers: state.offers,
    recentListings: state.recentListings,
    total: state.total,
    setEnabled: state.setEnabled,
    bootstrap: state.bootstrap,
    refetch: state.refetch,
    disconnect: state.disconnect,
  }));

  const {
    authenticated,
    restoringSession,
    loading,
    error,
    inventoryItems,
    offers,
    recentListings,
    total,
    setEnabled,
    bootstrap,
    refetch,
    disconnect,
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
    inventoryItems,
    offers,
    recentListings,
    total,
    refetch,
    disconnect,
  };
}
