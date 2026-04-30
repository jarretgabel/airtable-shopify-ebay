import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardWorkflowCardGrid } from '@/components/dashboard/DashboardWorkflowSections';

describe('DashboardWorkflowCardGrid', () => {
  it('marks unavailable workflow cards and blocks navigation for them', () => {
    const onSelect = vi.fn();

    render(
      <DashboardWorkflowCardGrid
        cards={[
          {
            id: 'ebay',
            title: 'eBay Publishing',
            eyebrow: 'Runtime config required',
            detail: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
            stats: ['OAuth setup'],
            unavailableReason: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
          },
          {
            id: 'shopify',
            title: 'Shopify Listings',
            eyebrow: '12 listings tracked',
            detail: 'Manage Shopify product statuses.',
            stats: ['7 active', '3 draft'],
          },
        ]}
        onSelect={onSelect}
      />,
    );

    const unavailableButton = screen.getByRole('button', { name: /ebay publishing/i });
    const availableButton = screen.getByRole('button', { name: /shopify listings/i });

    expect(unavailableButton).toBeDisabled();
    expect(screen.getByText('eBay unavailable')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();

    fireEvent.click(unavailableButton);
    fireEvent.click(availableButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('shopify');
  });
});