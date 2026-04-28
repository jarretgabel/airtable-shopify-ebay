import { useState, useEffect, useCallback, useRef } from 'react';
import type { JotFormForm, JotFormSubmission } from '@/types/jotform';
import { getForms, getFormSubmissions } from '@/services/app-api/jotform';

export function useJotForms() {
  const [forms, setForms] = useState<JotFormForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getForms();
      setForms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { forms, loading, error, refetch: fetch };
}

export function useJotFormSubmissions(formId: string | null) {
  const [submissions, setSubmissions] = useState<JotFormSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFormSubmissions(id, 100);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (formId) fetch(formId);
    else setSubmissions([]);
  }, [formId, fetch]);

  const refetch = useCallback(() => {
    if (formId) fetch(formId);
  }, [formId, fetch]);

  return { submissions, loading, error, refetch };
}

/**
 * Polls a specific JotForm form for new submissions at a fixed interval.
 * Detects submissions that arrive after the initial page load by comparing
 * submission IDs (JotForm IDs are numerically ordered — newer = higher).
 *
 * @param formId        The JotForm form ID to watch.
 * @param pollIntervalMs  How often to poll in ms (default: 60 seconds).
 */
export function useJotFormInquiries(formId: string, pollIntervalMs = 60_000) {
  const [submissions, setSubmissions] = useState<JotFormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [freshCount, setFreshCount] = useState(0);

  // The ID of the most-recent submission seen on the last fetch.
  // JotForm IDs are 64-bit integers; newer submissions have higher values.
  const lastSeenIdRef = useRef<string | null>(null);

  const doFetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setPolling(true);
    setError(null);
    try {
      const data = await getFormSubmissions(formId, 100);
      const list = Array.isArray(data) ? data : [];

      // Count submissions whose ID is larger than the last one we saw.
      if (lastSeenIdRef.current !== null && list.length > 0) {
        try {
          const prevBig = BigInt(lastSeenIdRef.current);
          const fresh = list.filter(s => {
            try { return BigInt(s.id) > prevBig; } catch { return false; }
          }).length;
          if (fresh > 0) setFreshCount(prev => prev + fresh);
        } catch { /* ignore BigInt parse errors */ }
      }

      if (list.length > 0) {
        lastSeenIdRef.current = list[0].id;
      }

      setSubmissions(list);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!silent) setLoading(false);
      else setPolling(false);
    }
  }, [formId]);

  // Initial load
  useEffect(() => { doFetch(false); }, [doFetch]);

  // Background polling
  useEffect(() => {
    const id = setInterval(() => doFetch(true), pollIntervalMs);
    return () => clearInterval(id);
  }, [doFetch, pollIntervalMs]);

  return {
    submissions,
    loading,
    polling,
    error,
    refetch: () => doFetch(false),
    lastUpdated,
    freshCount,
    clearFresh: () => setFreshCount(0),
  };
}
