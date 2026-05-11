import { describe, expect, it } from 'vitest';
import { getDashboardDegradedSources, hasDashboardPartialData } from '@/components/dashboard/dashboardSourceHealth';
import type { DashboardSourceStatus } from '@/components/dashboard/dashboardTabTypes';

function buildSources(overrides: Partial<DashboardSourceStatus>[] = []): DashboardSourceStatus[] {
  const defaults: DashboardSourceStatus[] = [
    { key: 'airtable', label: 'Inventory', error: null, hasData: true },
    { key: 'shopify', label: 'Shopify', error: null, hasData: true },
    { key: 'jotform', label: 'JotForm', error: null, hasData: true },
  ];

  return defaults.map((source, index) => ({ ...source, ...(overrides[index] ?? {}) }));
}

describe('dashboardSourceHealth', () => {
  it('returns only degraded sources', () => {
    const sources = buildSources([
      { error: 'Inventory fetch failed' },
      {},
      { error: 'JotForm timed out' },
    ]);

    expect(getDashboardDegradedSources(sources).map((source) => source.key)).toEqual(['airtable', 'jotform']);
  });

  it('treats a mix of stale and healthy data as partial-data mode', () => {
    const sources = buildSources([
      { error: 'Inventory fetch failed', hasData: true },
      { error: null, hasData: true },
      { error: null, hasData: false },
    ]);

    expect(hasDashboardPartialData(sources)).toBe(true);
  });

  it('does not mark the dashboard as partial when everything failed or everything is healthy', () => {
    expect(hasDashboardPartialData(buildSources())).toBe(false);
    expect(hasDashboardPartialData(buildSources([
      { error: 'Inventory fetch failed', hasData: false },
      { error: 'Shopify fetch failed', hasData: false },
      { error: null, hasData: false },
    ]))).toBe(false);
  });
});