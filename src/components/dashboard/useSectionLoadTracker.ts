import { useCallback, useRef, useState } from 'react';

/** Tracks which independently-loading sections have finished so a page can show one loader. */
export function useSectionLoadTracker(keys: string[]) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const callbacks = useRef<Record<string, (value: boolean) => void>>({});

  const reporter = useCallback((key: string) => {
    if (!callbacks.current[key]) {
      callbacks.current[key] = (value: boolean) => {
        setLoaded((current) => (current[key] === value ? current : { ...current, [key]: value }));
      };
    }
    return callbacks.current[key];
  }, []);

  const allLoaded = keys.every((key) => loaded[key]);
  return { allLoaded, reporter };
}
