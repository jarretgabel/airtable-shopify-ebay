import { useCallback, useEffect, useState } from 'react';
import { TAB_DATA_TTLS, shouldReuseTabData } from '@/app/tabDataCache';
import { getCombinedReadyForPublishingCount } from '@/components/approval/combinedListingsReadyForPublishing';
import {
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalEbayConstants';
import {
  SHOPIFY_PRICE_FIELD_CANDIDATES,
  SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES,
  SHOPIFY_TITLE_FIELD_CANDIDATES,
} from '@/components/approval/listingApprovalShopifyConstants';
import { getConfiguredRecords } from '@/services/app-api/airtable';

const READY_COUNT_MAX_RECORDS = 150;

const READY_COUNT_FIELDS = Array.from(new Set([
  'Workflow Status',
  ...SHOPIFY_TITLE_FIELD_CANDIDATES,
  ...SHOPIFY_PRICE_FIELD_CANDIDATES,
  ...SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES,
  ...EBAY_TITLE_FIELD_CANDIDATES,
  ...EBAY_PRICE_FIELD_CANDIDATES,
]));

interface CombinedListingsReadyForPublishingCountState {
  loading: boolean;
  error: string | null;
  count: number;
  refetch: () => Promise<void>;
}

export function useCombinedListingsReadyForPublishingCount(enabled = true): CombinedListingsReadyForPublishingCountState {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const fetchCount = useCallback(async (force = true) => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (!force && shouldReuseTabData(lastLoadedAt, TAB_DATA_TTLS.approvalQueue, error === null && lastLoadedAt !== null)) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const records = await getConfiguredRecords('approval-combined', {
        subset: 'ready-for-publishing',
        fields: READY_COUNT_FIELDS,
        maxRecords: READY_COUNT_MAX_RECORDS,
      });
      setCount(getCombinedReadyForPublishingCount(records));
      setLastLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load combined listings ready count');
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, error, lastLoadedAt]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void fetchCount(false);
  }, [enabled, fetchCount]);

  return {
    loading,
    error,
    count,
    refetch: () => fetchCount(true),
  };
}