import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardReportsSection } from '@/components/dashboard/DashboardReportsSection';

const reports = {
  inventoryByStatus: [{ status: 'Shipped', count: 12 }],
  timeInStage: [{ status: 'Testing', avgDays: 3.5, stints: 4 }],
  shippedByBrand: [{ brand: 'McIntosh', count: 2, totalCost: 1500 }],
};

describe('DashboardReportsSection', () => {
  it('renders the three reports', async () => {
    render(<DashboardReportsSection loadReports={vi.fn().mockResolvedValue(reports)} />);
    await waitFor(() => expect(screen.getByText('Inventory by status')).toBeTruthy());
    expect(screen.getByText('Shipped')).toBeTruthy();
    expect(screen.getByText('3.5')).toBeTruthy();
    expect(screen.getByText('$1,500')).toBeTruthy();
  });

  it('stays hidden on error unless warnings are enabled', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const { container } = render(<DashboardReportsSection loadReports={failing} />);
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});
