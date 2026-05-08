import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowPostPublishSection } from '@/components/tabs/airtable/UsedGearWorkflowPostPublishSection';

const { loadWorkflowPostPublishQueueMock, clipboardWriteTextMock } = vi.hoisted(() => ({
  loadWorkflowPostPublishQueueMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

const {
  markWorkflowListingStaleMock,
  markWorkflowRelistedMock,
  markWorkflowSoldReadyToShipMock,
  markWorkflowShippedMock,
  saveWorkflowStaleRecoveryMock,
} = vi.hoisted(() => ({
  markWorkflowListingStaleMock: vi.fn(),
  markWorkflowRelistedMock: vi.fn(),
  markWorkflowSoldReadyToShipMock: vi.fn(),
  markWorkflowShippedMock: vi.fn(),
  saveWorkflowStaleRecoveryMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadWorkflowPostPublishQueue: loadWorkflowPostPublishQueueMock,
    markWorkflowListingStale: markWorkflowListingStaleMock,
    markWorkflowRelisted: markWorkflowRelistedMock,
    markWorkflowSoldReadyToShip: markWorkflowSoldReadyToShipMock,
    markWorkflowShipped: markWorkflowShippedMock,
    saveWorkflowStaleRecovery: saveWorkflowStaleRecoveryMock,
  };
});

describe('UsedGearWorkflowPostPublishSection', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    clipboardWriteTextMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextMock,
      },
    });
    markWorkflowListingStaleMock.mockReset();
    markWorkflowRelistedMock.mockReset();
    markWorkflowSoldReadyToShipMock.mockReset();
    markWorkflowShippedMock.mockReset();
    saveWorkflowStaleRecoveryMock.mockReset();
    window.history.replaceState({}, '', '/inventory');
  });

  it('shows only the focused bucket when opened from a dashboard deep link', async () => {
    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-active',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'ACT-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2099-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'rec-sold',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'SOLD-1',
          Make: 'Marantz',
          Model: '2270',
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearWorkflowPostPublishSection
        focusedBucket="sold-ready"
        onFocusedBucketChange={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Sold Ready To Ship')).toBeInTheDocument();
    expect(screen.getByText('Dashboard shortcut opened the post-publish queue filtered to the selected lifecycle bucket.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Active Listings' })).not.toBeInTheDocument();
  });

  it('emits bucket changes when operators switch post-publish filters manually', async () => {
    const onFocusedBucketChange = vi.fn();

    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-active',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'ACT-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2099-01-01T00:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearWorkflowPostPublishSection
        focusedBucket={null}
        onFocusedBucketChange={onFocusedBucketChange}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Active Listings' });

    fireEvent.click(screen.getByRole('button', { name: 'Stale Listings' }));
    expect(onFocusedBucketChange).toHaveBeenCalledWith('stale-listing');

    fireEvent.click(screen.getByRole('button', { name: 'All Buckets' }));
    expect(onFocusedBucketChange).toHaveBeenCalledWith('all');
  });

  it('copies the current filtered queue link for sharing', async () => {
    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-sold',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'SOLD-1',
          Make: 'Marantz',
          Model: '2270',
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
        },
      },
    ]);
    window.history.replaceState({}, '', '/inventory?workflowPostPublishBucket=sold-ready');

    render(
      <UsedGearWorkflowPostPublishSection
        focusedBucket="sold-ready"
        onFocusedBucketChange={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Sold Ready To Ship');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Filtered Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/inventory?workflowPostPublishBucket=sold-ready#used-gear-post-publish`);
    });
  });

  it('emits collapse-all bucket keys for the visible post-publish sections', async () => {
    const onCollapsedSectionKeysChange = vi.fn();

    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-active',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'ACT-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2099-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'rec-sold',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'SOLD-1',
          Make: 'Marantz',
          Model: '2270',
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearWorkflowPostPublishSection
        focusedBucket={null}
        onFocusedBucketChange={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
        collapsedSectionKeys={[]}
        onCollapsedSectionKeysChange={onCollapsedSectionKeysChange}
      />,
    );

    await screen.findByRole('heading', { name: 'Active Listings' });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse All Buckets' }));

    expect(onCollapsedSectionKeysChange).toHaveBeenCalledWith(['active-listing', 'shipped', 'sold-ready', 'stale-listing']);
  });

  it('filters post-publish sections down to shipped history when history-only is selected', async () => {
    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-active',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'ACT-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2099-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'rec-shipped',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'SHIP-1',
          Make: 'Marantz',
          Model: '2270',
          'Workflow Status': 'Shipped',
          'Shipped At': '2026-05-06T00:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearWorkflowPostPublishSection
        historyFilter="history-only"
        onHistoryFilterChange={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Shipped History' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Active Listings' })).not.toBeInTheDocument();
  });

  it('saves stale recovery details and supports relisting stale rows', async () => {
    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-stale',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'STALE-1',
          Make: 'McIntosh',
          Model: 'MC275',
          'Workflow Status': 'Stale Listing, Shopify',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-20T00:00:00.000Z',
        },
      },
    ]);
    saveWorkflowStaleRecoveryMock.mockResolvedValue({
      id: 'rec-stale',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        SKU: 'STALE-1',
        Make: 'McIntosh',
        Model: 'MC275',
        'Workflow Status': 'Stale Listing, Shopify',
        'Stale Recovery Status': 'Price Refresh',
        'Stale Recovery Notes': 'Refresh price and image order.',
      },
    });
    markWorkflowRelistedMock.mockResolvedValue({
      id: 'rec-stale',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        SKU: 'STALE-1',
        Make: 'McIntosh',
        Model: 'MC275',
        'Workflow Status': 'Listed, Shopify',
        'Relisted At': '2026-05-07T12:00:00.000Z',
      },
    });

    render(
      <UsedGearWorkflowPostPublishSection
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('STALE-1');

    fireEvent.change(screen.getByRole('combobox', { name: 'Stale recovery status' }), { target: { value: 'Price Refresh' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Stale recovery notes' }), { target: { value: 'Refresh price and image order.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Recovery' }));

    await waitFor(() => {
      expect(saveWorkflowStaleRecoveryMock).toHaveBeenCalledWith('rec-stale', {
        staleRecoveryStatus: 'Price Refresh',
        staleRecoveryNotes: 'Refresh price and image order.',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mark Relisted' }));

    await waitFor(() => {
      expect(markWorkflowRelistedMock).toHaveBeenCalledWith('rec-stale');
    });
  });
});