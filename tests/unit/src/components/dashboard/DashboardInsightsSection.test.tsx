import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardInsightsSection } from '@/components/dashboard/DashboardOverviewInsightsSection';

describe('DashboardInsightsSection', () => {
  it('routes inventory post-publish insights through the focused bucket callback', () => {
    const onSelectTab = vi.fn();
    const onOpenInventoryPostPublishBucket = vi.fn();

    render(
      <DashboardInsightsSection
        insights={[
          {
            id: 'used-gear-sold-ready',
            title: 'Used gear shipments are queued',
            detail: '1 used-gear item is sold and ready to ship.',
            severity: 'critical',
            targetTab: 'inventory',
            inventoryPostPublishBucket: 'sold-ready',
          },
        ]}
        onSelectTab={onSelectTab}
        onOpenInventoryPostPublishBucket={onOpenInventoryPostPublishBucket}
      />,
    );

    expect(screen.getByText('Opens Sold Ready To Ship Bucket')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open inventory/i }));

    expect(onOpenInventoryPostPublishBucket).toHaveBeenCalledWith('sold-ready');
    expect(onSelectTab).not.toHaveBeenCalled();
  });
});