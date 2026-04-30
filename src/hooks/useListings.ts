import { useCallback, useEffect, useState } from 'react';
import { TAB_DATA_TTLS, shouldReuseTabData } from '@/app/tabDataCache';
import { getListings } from '@/services/app-api/airtable';
import { AirtableRecord } from '@/types/airtable';

interface UseListingsReturn {
  listings: AirtableRecord[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useListings(tableName: string, viewId?: string, enabled = true): UseListingsReturn {
  const [listings, setListings] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const fetchListings = useCallback(async (force = true) => {
    if (!force && shouldReuseTabData(lastLoadedAt, TAB_DATA_TTLS.airtableListings, error === null)) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getListings(tableName, { view: viewId });
      setListings(data);
      setLastLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch listings'));
    } finally {
      setLoading(false);
    }
  }, [error, lastLoadedAt, tableName, viewId]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchListings(false);
  }, [enabled, fetchListings]);

  return {
    listings,
    loading,
    error,
    refetch: () => fetchListings(true),
  };
}
