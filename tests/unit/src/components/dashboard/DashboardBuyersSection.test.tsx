import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardBuyersSection } from '@/components/dashboard/DashboardBuyersSection';

const summary = {
  totals: { buyers: 1, items: 1, revenue: 8500 },
  buyers: [{ key: 'a@x.com', name: 'Ann Lee', email: 'a@x.com', phone: null, shipTo: null, itemCount: 1, totalSpent: 8500, lastPurchase: '2026-10-04', items: [] }],
};

describe('DashboardBuyersSection', () => {
  it('lists buyers', async () => {
    render(<DashboardBuyersSection loadBuyers={vi.fn().mockResolvedValue(summary)} />);
    expect(await screen.findByText('Ann Lee')).toBeTruthy();
    expect(screen.getByText('$8,500', { selector: 'td' })).toBeTruthy();
  });

  it('hides itself on error unless warnings are on', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const { container } = render(<DashboardBuyersSection loadBuyers={failing} />);
    await vi.waitFor(() => expect(failing).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
