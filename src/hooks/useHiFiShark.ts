import { useState, useCallback } from 'react';
import { scrapeHiFiShark } from '@/services/hifishark';
import type { HiFiSharkListing } from '@/types/hifishark';

interface UseHiFiSharkResult {
  listings: HiFiSharkListing[];
  loading: boolean;
  error: Error | null;
  search: (slug: string) => void;
  currentSlug: string;
}

export function useHiFiShark(): UseHiFiSharkResult {
  const [listings, setListings] = useState<HiFiSharkListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentSlug, setCurrentSlug] = useState('');

  const search = useCallback(async (slug: string) => {
    const normalized = slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!normalized) return;
    setCurrentSlug(normalized);
    setLoading(true);
    setError(null);
    setListings([]);
    try {
      const results = await scrapeHiFiShark(normalized);
      setListings(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  return { listings, loading, error, search, currentSlug };
}
