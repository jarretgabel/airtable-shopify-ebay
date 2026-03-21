import { create } from 'zustand';
import {
  clearUserToken,
  exchangeCodeForToken,
  getValidUserToken,
  hasValidSession,
  saveUserToken,
  type EbayInventoryItem,
  type EbayOffer,
} from '@/services/ebay';
import {
  isEbayAuthError,
  loadEbayListingsSnapshot,
  type EbayPublishedListing,
  type EbayListingsSnapshot,
} from '@/hooks/ebayListingsHelpers';

const hasEnvRefreshToken = Boolean(import.meta.env.VITE_EBAY_REFRESH_TOKEN);

interface EbayListingsStoreState {
  enabled: boolean;
  initializing: boolean;
  authenticated: boolean;
  restoringSession: boolean;
  loading: boolean;
  error: string | null;
  inventoryItems: EbayInventoryItem[];
  offers: EbayOffer[];
  recentListings: EbayPublishedListing[];
  total: number;
  setEnabled: (enabled: boolean) => void;
  bootstrap: (enabledOverride?: boolean) => Promise<void>;
  refetch: () => Promise<void>;
  disconnect: () => void;
}

function readOAuthCallbackState(): { hasOAuthCallback: boolean; code: string | null } {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const hasOAuthCallback = params.get('state') === 'ebay_oauth' && Boolean(code);
  return { hasOAuthCallback, code };
}

function clearListingData(set: (partial: Partial<EbayListingsStoreState>) => void): void {
  set({
    inventoryItems: [],
    offers: [],
    recentListings: [],
    total: 0,
  });
}

function applyListingSnapshot(
  set: (partial: Partial<EbayListingsStoreState>) => void,
  snapshot: EbayListingsSnapshot,
): void {
  set({
    inventoryItems: snapshot.inventoryItems,
    offers: snapshot.offers,
    recentListings: snapshot.recentListings,
    total: snapshot.total,
    error: snapshot.warning,
  });
}

function handleAuthFailure(set: (partial: Partial<EbayListingsStoreState>) => void, message: string): void {
  clearUserToken();
  clearListingData(set);
  set({
    authenticated: false,
    error: message,
  });
}

export const useEbayListingsStore = create<EbayListingsStoreState>((set, get) => ({
  enabled: true,
  initializing: false,
  authenticated: hasValidSession(),
  restoringSession: hasValidSession() || hasEnvRefreshToken || readOAuthCallbackState().hasOAuthCallback,
  loading: false,
  error: null,
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
    if (hasValidSession()) {
      set({ authenticated: true });
    }

    const { hasOAuthCallback, code } = readOAuthCallbackState();
    if (hasOAuthCallback && code) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);

      set({ restoringSession: true, loading: true, error: null });
      try {
        const token = await exchangeCodeForToken(code);
        saveUserToken(token);
        set({ authenticated: true });
        applyListingSnapshot(set, await loadEbayListingsSnapshot());
      } catch (err) {
        set({ authenticated: false, error: `OAuth error: ${(err as Error).message}` });
      } finally {
        set({ loading: false, restoringSession: false, initializing: false });
      }
      return;
    }

    if (!hasValidSession() && !hasEnvRefreshToken) {
      set({ restoringSession: false, initializing: false });
      return;
    }

    set({ restoringSession: true, loading: true, error: null });
    try {
      await getValidUserToken();
      set({ authenticated: true });
      applyListingSnapshot(set, await loadEbayListingsSnapshot());
    } catch (err) {
      if (isEbayAuthError(err)) {
        handleAuthFailure(set, err.message);
      } else {
        set({ error: (err as Error).message });
      }
    } finally {
      set({ loading: false, restoringSession: false, initializing: false });
    }
  },
  refetch: async () => {
    if (!get().enabled) return;
    if (!hasValidSession()) return;

    set({ loading: true, error: null });
    try {
      applyListingSnapshot(set, await loadEbayListingsSnapshot());
    } catch (err) {
      if (isEbayAuthError(err)) {
        handleAuthFailure(set, err.message);
      } else {
        set({ error: (err as Error).message });
      }
    } finally {
      set({ loading: false });
    }
  },
  disconnect: () => {
    clearUserToken();
    clearListingData(set);
    set({ authenticated: false, error: null });
  },
}));