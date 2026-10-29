import { describe, expect, it } from 'vitest';
import { buildDashboardSections, resolveDashboardView } from '@/components/dashboard/dashboardTabHelpers';

describe('dashboard views', () => {
  it('falls back to the first available view', () => {
    expect(resolveDashboardView('sales', ['overview'])).toBe('overview');
    expect(resolveDashboardView('sales', ['overview', 'sales'])).toBe('sales');
    expect(resolveDashboardView(null, ['overview', 'people'])).toBe('overview');
  });

  it('lists only the sections of the current view', () => {
    const sales = buildDashboardSections({
      includeOverview: false, showActionsSection: false, showInsightsSection: false,
      showFinanceSection: true, showBuyersSection: true, showReportsSection: true,
    });
    expect(sales.map((section) => section.id)).toEqual(['finance', 'buyers', 'reports']);
  });
});
