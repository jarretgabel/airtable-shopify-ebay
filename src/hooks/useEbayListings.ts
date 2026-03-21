import { useState, useEffect, useCallback } from 'react';
import {
  hasValidSession,
  getValidUserToken,
  exchangeCodeForToken,
  saveUserToken,
  clearUserToken,
  type EbayInventoryItem,
  type EbayOffer,
} from '@/services/ebay';
import {
  isEbayAuthError,
  loadEbayListingsSnapshot,
  type EbayPublishedListing,
} from '@/hooks/ebayListingsHelpers';

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
  const hasEnvRefreshToken = Boolean(import.meta.env.VITE_EBAY_REFRESH_TOKEN);
  const oauthParams = new URLSearchParams(window.location.search);
  const hasOAuthCallback = oauthParams.get('state') === 'ebay_oauth' && Boolean(oauthParams.get('code'));
  const [authenticated, setAuthenticated] = useState(() => hasValidSession());
  const [restoringSession, setRestoringSession] = useState(() => hasValidSession() || hasEnvRefreshToken || hasOAuthCallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<EbayInventoryItem[]>([]);
  const [offers, setOffers] = useState<EbayOffer[]>([]);
  const [recentListings, setRecentListings] = useState<EbayPublishedListing[]>([]);
  const [total, setTotal] = useState(0);

  function clearListingData() {
    setInventoryItems([]);
    setOffers([]);
    setRecentListings([]);
    setTotal(0);
  }

  function applyListingSnapshot(snapshot: Awaited<ReturnType<typeof loadEbayListingsSnapshot>>) {
    setInventoryItems(snapshot.inventoryItems);
    setOffers(snapshot.offers);
    setRecentListings(snapshot.recentListings);
    setTotal(snapshot.total);

    if (snapshot.warning) {
      setError(snapshot.warning);
    }
  }

  function handleAuthFailure(message: string) {
    clearUserToken();
    setAuthenticated(false);
    clearListingData();
    setError(message);
  }

  // Handle OAuth callback — detect ?code= in URL on page load
  useEffect(() => {
    if (!enabled) return;

    if (hasValidSession()) {
      setAuthenticated(true);
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state === 'ebay_oauth') {
      // Strip the code from the URL immediately
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);

      setRestoringSession(true);
      setLoading(true);
      setError(null);
      exchangeCodeForToken(code)
        .then(token => {
          saveUserToken(token);
          setAuthenticated(true);
        })
        .catch(err => {
          setAuthenticated(false);
          setError(`OAuth error: ${(err as Error).message}`);
        })
        .finally(() => {
          setLoading(false);
          setRestoringSession(false);
        });
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (hasOAuthCallback) return;
    if (!hasValidSession() && !hasEnvRefreshToken) return;

    setRestoringSession(true);
    setLoading(true);
    setError(null);

    getValidUserToken()
      .then(() => {
        setAuthenticated(true);

        return loadEbayListingsSnapshot().then(applyListingSnapshot);
      })
      .catch(err => {
        if (isEbayAuthError(err)) {
          handleAuthFailure(err.message);
          return;
        }

        setError((err as Error).message);
      })
      .finally(() => {
        setLoading(false);
        setRestoringSession(false);
      });
  }, [enabled, hasEnvRefreshToken]);

  const fetchListings = useCallback(async () => {
    if (!enabled) return;
    if (!hasValidSession()) return;
    setLoading(true);
    setError(null);
    try {
      applyListingSnapshot(await loadEbayListingsSnapshot());
    } catch (err) {
      if (isEbayAuthError(err)) {
        handleAuthFailure(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Auto-fetch when authenticated
  useEffect(() => {
    if (!enabled) return;
    if (authenticated) fetchListings();
  }, [authenticated, enabled, fetchListings]);

  const disconnect = useCallback(() => {
    if (!enabled) return;
    clearUserToken();
    setAuthenticated(false);
    clearListingData();
    setError(null);
  }, [enabled]);

  return {
    authenticated,
    restoringSession,
    loading,
    error,
    inventoryItems,
    offers,
    recentListings,
    total,
    refetch: fetchListings,
    disconnect,
  };
}
