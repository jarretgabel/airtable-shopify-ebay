import { useState, useEffect } from 'react';
import airtableService from '@/services/airtable';
import { AirtableRecord } from '@/types/airtable';

interface UseListingsReturn {
  listings: AirtableRecord[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useListings(tableName: string, viewId?: string): UseListingsReturn {
  const [listings, setListings] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await airtableService.getRecords(tableName, { view: viewId });
      setListings(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch listings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [tableName, viewId]);

  return {
    listings,
    loading,
    error,
    refetch: fetchListings,
  };
}
