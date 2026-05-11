import { describe, expect, it, vi } from 'vitest';
import { TAB_DATA_TTLS, isTabDataStale, shouldReuseTabData } from '@/app/tabDataCache';

describe('tabDataCache', () => {
  it('treats missing timestamps as stale', () => {
    expect(isTabDataStale(null, TAB_DATA_TTLS.airtableListings)).toBe(true);
    expect(shouldReuseTabData(null, TAB_DATA_TTLS.airtableListings)).toBe(false);
  });

  it('reuses recent cached data within the TTL window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));

    const loadedAt = Date.now() - 30_000;

    expect(isTabDataStale(loadedAt, TAB_DATA_TTLS.airtableListings)).toBe(false);
    expect(shouldReuseTabData(loadedAt, TAB_DATA_TTLS.airtableListings, true)).toBe(true);

    vi.useRealTimers();
  });

  it('forces a refresh when cached data is too old or not recoverable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:05:00.000Z'));

    const staleLoadedAt = Date.now() - (TAB_DATA_TTLS.approvalQueue + 1_000);

    expect(isTabDataStale(staleLoadedAt, TAB_DATA_TTLS.approvalQueue)).toBe(true);
    expect(shouldReuseTabData(staleLoadedAt, TAB_DATA_TTLS.approvalQueue, true)).toBe(false);
    expect(shouldReuseTabData(Date.now(), TAB_DATA_TTLS.approvalQueue, false)).toBe(false);

    vi.useRealTimers();
  });
});