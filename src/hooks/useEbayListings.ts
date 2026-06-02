import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { EbayInventoryItem, EbayOffer, EbayPublishedListing, EbayRuntimeConfig } from '@/services/ebay/types';
import { useEbayListingsStore } from '@/stores/ebay/ebayListingsStore';

export type { EbayPublishedListing } from '@/services/ebay/types';

const EBAY_POLL_INTERVAL_MS = 60_000;

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
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setEnabled(enabled);
    void bootstrap(enabled, false);
  }, [enabled, setEnabled, bootstrap]);

  useEffect(() => {
    if (!enabled) {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const tick = () => {
      void refetch(true);
    };

    pollTimerRef.current = window.setInterval(tick, EBAY_POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, refetch]);

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
    refetch: () => { void refetch(true); },
  };
}
