import { create } from 'zustand';
import { TAB_DATA_TTLS, shouldReuseTabData } from '@/app/tabDataCache';
import { checkOptionalEnv } from '@/config/runtimeEnv';
import { getRecordsSummaryFromResolvedSource } from '@/services/app-api/airtable';

interface ShopifyApprovalSummaryStoreState {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  total: number;
  approved: number;
  pending: number;
  lastLoadedAt: number | null;
  setEnabled: (enabled: boolean) => void;
  refetch: (force?: boolean) => Promise<void>;
}

export const useShopifyApprovalSummaryStore = create<ShopifyApprovalSummaryStoreState>((set, get) => ({
  enabled: true,
  loading: true,
  error: null,
  total: 0,
  approved: 0,
  pending: 0,
  lastLoadedAt: null,
  setEnabled: (enabled) => {
    set({ enabled });
    if (!enabled) {
      set({
        loading: false,
      });
    }
  },
  refetch: async (force = true) => {
    if (!get().enabled) {
      set({ loading: false });
      return;
    }

    if (!force && shouldReuseTabData(get().lastLoadedAt, TAB_DATA_TTLS.shopifyApprovalSummary, get().error === null)) {
      set({ loading: false });
      return;
    }

    const tableReference = checkOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF');
    const tableName = checkOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME');
    if (!tableReference && !tableName) {
      set({
        loading: false,
        error: 'Missing VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF or VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME',
        total: 0,
        approved: 0,
        pending: 0,
      });
      return;
    }

    try {
      set({ loading: true, error: null });
      const summary = await getRecordsSummaryFromResolvedSource(tableReference, tableName);

      set({
        total: summary.total,
        approved: summary.approved,
        pending: summary.pending,
        lastLoadedAt: Date.now(),
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load Shopify approval queue' });
    } finally {
      set({ loading: false });
    }
  },
}));
