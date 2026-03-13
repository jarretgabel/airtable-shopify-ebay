import { useState, useEffect, useCallback } from 'react';
import {
  hasValidSession,
  getValidUserToken,
  getInventoryItems,
  getOffers,
  getOffersForInventorySkus,
  isValidEbaySku,
  exchangeCodeForToken,
  saveUserToken,
  clearUserToken,
  type EbayInventoryItem,
  type EbayOffer,
  type EbayOfferPage,
} from '@/services/ebay';

export interface EbayPublishedListing {
  item: EbayInventoryItem;
  offer: EbayOffer;
}

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

const MAX_VISIBLE_LISTINGS = 20;

function statusRank(status?: EbayOffer['status']): number {
  if (status === 'UNPUBLISHED') return 0;
  if (status === 'PUBLISHED') return 1;
  return 2;
}

function offerRecencyRank(offer: EbayOffer): number {
  const numericId = Number(offer.listingId ?? offer.offerId ?? 0);
  return Number.isFinite(numericId) ? numericId : 0;
}

function buildPublishedListings(items: EbayInventoryItem[], offers: EbayOffer[]): EbayPublishedListing[] {
  const itemBySku = new Map(items.map(item => [item.sku, item]));

  return offers
    .filter(offer => offer.status === 'PUBLISHED')
    .map(offer => {
      const item = itemBySku.get(offer.sku);
      return item ? { item, offer } : null;
    })
    .filter((listing): listing is EbayPublishedListing => listing !== null)
    .sort((a, b) => offerRecencyRank(b.offer) - offerRecencyRank(a.offer))
    .slice(0, MAX_VISIBLE_LISTINGS);
}

export function useEbayListings(): EbayListingsState {
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

  // Handle OAuth callback — detect ?code= in URL on page load
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (hasOAuthCallback) return;
    if (!hasValidSession() && !hasEnvRefreshToken) return;

    setRestoringSession(true);
    setLoading(true);
    setError(null);

    getValidUserToken()
      .then(() => {
        setAuthenticated(true);

        return getInventoryItems(100).then(async itemsPage => {
          let offersPage: EbayOfferPage = { offers: [] as EbayOffer[], total: 0 };
          let offersWarning: string | null = null;

          try {
            offersPage = await getOffers(undefined, 100);
          } catch {
            offersPage = await getOffersForInventorySkus(itemsPage.inventoryItems.map(item => item.sku));
            offersWarning = 'Loaded inventory. Some eBay offer details were skipped because at least one legacy SKU is invalid.';
          }

          const offerBySku = new Map(offersPage.offers.map(o => [o.sku, o]));
          const sorted = [...itemsPage.inventoryItems].sort(
            (a, b) => statusRank(offerBySku.get(a.sku)?.status) - statusRank(offerBySku.get(b.sku)?.status)
          );
          const visibleItems = sorted.filter(item => isValidEbaySku(item.sku));

          setInventoryItems(visibleItems.slice(0, MAX_VISIBLE_LISTINGS));
          setOffers(offersPage.offers);
          setRecentListings(buildPublishedListings(visibleItems, offersPage.offers));
          setTotal(visibleItems.length);

          if (offersWarning) {
            setError(offersWarning);
          }
        });
      })
      .catch(err => {
        const e = err as Error & { code?: string };
        if (e.code === 'auth_required' || e.code === 'invalid_grant') {
          clearUserToken();
          setAuthenticated(false);
        }
        setError(e.message);
      })
      .finally(() => {
        setLoading(false);
        setRestoringSession(false);
      });
  }, [hasEnvRefreshToken]);

  const fetchListings = useCallback(async () => {
    if (!hasValidSession()) return;
    setLoading(true);
    setError(null);
    try {
      const itemsPage = await getInventoryItems(100);
      let offersPage: EbayOfferPage = { offers: [] as EbayOffer[], total: 0 };
      let offersWarning: string | null = null;

      try {
        offersPage = await getOffers(undefined, 100);
      } catch {
        offersPage = await getOffersForInventorySkus(itemsPage.inventoryItems.map(item => item.sku));
        offersWarning = 'Loaded inventory. Some eBay offer details were skipped because at least one legacy SKU is invalid.';
      }

      const offerBySku = new Map(offersPage.offers.map(o => [o.sku, o]));
      const sorted = [...itemsPage.inventoryItems].sort(
        (a, b) => statusRank(offerBySku.get(a.sku)?.status) - statusRank(offerBySku.get(b.sku)?.status)
      );
      const visibleItems = sorted.filter(item => isValidEbaySku(item.sku));

      setInventoryItems(visibleItems.slice(0, MAX_VISIBLE_LISTINGS));
      setOffers(offersPage.offers);
      setRecentListings(buildPublishedListings(visibleItems, offersPage.offers));
      setTotal(visibleItems.length);

      if (offersWarning) {
        setError(offersWarning);
      }
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'auth_required' || e.code === 'invalid_grant') {
        // Token is bad — wipe state and show connect screen
        clearUserToken();
        setAuthenticated(false);
        setInventoryItems([]);
        setOffers([]);
        setRecentListings([]);
        setTotal(0);
        setError(e.message);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch when authenticated
  useEffect(() => {
    if (authenticated) fetchListings();
  }, [authenticated, fetchListings]);

  const disconnect = useCallback(() => {
    clearUserToken();
    setAuthenticated(false);
    setInventoryItems([]);
    setOffers([]);
    setRecentListings([]);
    setTotal(0);
    setError(null);
  }, []);

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
