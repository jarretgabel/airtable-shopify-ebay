import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardSellersSection } from '@/components/dashboard/DashboardSellersSection';
import type { SellersSummary } from '@/services/app-api/dashboard';

const summary: SellersSummary = {
  totals: { contacts: 3, sellersWithItems: 2, repeatSellers: 1, mailingListOptIns: 1 },
  topSellers: [{ email: 'a@x.com', location: 'NYC', mailingListOptIn: true, itemCount: 2, lastItemDate: '2026-05-01' }],
};

describe('DashboardSellersSection', () => {
  it('renders totals and top sellers', async () => {
    render(<DashboardSellersSection loadSummary={vi.fn().mockResolvedValue(summary)} />);
    expect(await screen.findByText('a@x.com')).toBeTruthy();
    expect(screen.getByText('Repeat sellers')).toBeTruthy();
    expect(screen.getByText('2026-05-01')).toBeTruthy();
  });

  it('renders nothing on failure unless warnings are enabled', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('Postgres not configured'));
    const { container } = render(<DashboardSellersSection loadSummary={failing} />);
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(container.textContent).toBe('');

    render(<DashboardSellersSection showWarnings loadSummary={failing} />);
    expect(await screen.findByText('Postgres not configured')).toBeTruthy();
  });
});
