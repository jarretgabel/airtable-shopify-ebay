import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowPostPublishSection } from '@/components/tabs/airtable/UsedGearWorkflowPostPublishSection';

async function openPostPublishTools() {
  const toggle = screen.queryByRole('button', { name: 'Show Buckets' });
  if (toggle) {
    fireEvent.click(toggle);
  }
}

const { loadWorkflowPostPublishQueueMock, clipboardWriteTextMock } = vi.hoisted(() => ({
  loadWorkflowPostPublishQueueMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

const {
  markWorkflowListingStaleMock,
  markWorkflowRelistedMock,
  markWorkflowRowsShippedMock,
  markWorkflowRowsSoldReadyToShipMock,
  markWorkflowSoldReadyToShipMock,
  markWorkflowShippedMock,
  saveWorkflowStaleRecoveryMock,
} = vi.hoisted(() => ({
  markWorkflowListingStaleMock: vi.fn(),
  markWorkflowRelistedMock: vi.fn(),
  markWorkflowRowsShippedMock: vi.fn(),
  markWorkflowRowsSoldReadyToShipMock: vi.fn(),
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
    markWorkflowRowsShipped: markWorkflowRowsShippedMock,
    markWorkflowRowsSoldReadyToShip: markWorkflowRowsSoldReadyToShipMock,
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
    markWorkflowRowsShippedMock.mockReset();
    markWorkflowRowsSoldReadyToShipMock.mockReset();
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
        currentUserName="Taylor Reviewer"
        focusedBucket="sold-ready"
        onFocusedBucketChange={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
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
        currentUserName="Taylor Reviewer"
        focusedBucket={null}
        onFocusedBucketChange={onFocusedBucketChange}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Active Listings' });

    await openPostPublishTools();
    fireEvent.click(await screen.findByRole('button', { name: 'Stale Listings' }));
    expect(onFocusedBucketChange).toHaveBeenCalledWith('stale-listing');

    fireEvent.click(await screen.findByRole('button', { name: 'All Buckets' }));
    expect(onFocusedBucketChange).toHaveBeenCalledWith('all');
  });

  it('shows the sort control as an icon-triggered select in the header', async () => {
    loadWorkflowPostPublishQueueMock.mockResolvedValue([]);

    render(
      <UsedGearWorkflowPostPublishSection
        currentUserName="Taylor Reviewer"
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Post-Publish Queue');

    expect(screen.getByLabelText(/Sort used gear post-publish queue/i)).toBeInTheDocument();
  });

  it('ignores the legacy owner filter prop and keeps post-publish rows visible', async () => {
    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-active-newer',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'ACT-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2026-04-25T00:00:00.000Z',
        },
      },
      {
        id: 'rec-stale-oldest',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'STALE-1',
          Make: 'Marantz',
          Model: '2270',
          'Workflow Status': 'Stale Listing, eBay',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-20T00:00:00.000Z',
        },
      },
      {
        id: 'rec-sold-middle',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'SOLD-1',
          Make: 'Pioneer',
          Model: 'SX-1250',
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-03T00:00:00.000Z',
        },
      },
      {
        id: 'rec-shipped-oldest',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'SHIP-1',
          Make: 'Sansui',
          Model: '9090DB',
          'Workflow Status': 'Shipped',
          'Shipped At': '2026-02-15T00:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearWorkflowPostPublishSection
        currentUserName="Taylor Reviewer"
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('ACT-1')).toBeInTheDocument();
    expect(screen.getByText('STALE-1')).toBeInTheDocument();
    expect(screen.getByText('SOLD-1')).toBeInTheDocument();
  });

  it('opens the operational record from a compact stale-listing card', async () => {
    const onOpenOperationalRecord = vi.fn();

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

    render(
      <UsedGearWorkflowPostPublishSection
        currentUserName="Taylor Reviewer"
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('STALE-1');

    fireEvent.click(screen.getByRole('button', { name: 'Open Operational Record' }));

    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-stale');
  });

  it('supports sold-ready reconciliation from selected rows', async () => {
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
        id: 'rec-stale',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'STALE-1',
          Make: 'Marantz',
          Model: '2270',
          'Workflow Status': 'Stale Listing, eBay',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-20T00:00:00.000Z',
        },
      },
    ]);
    markWorkflowRowsSoldReadyToShipMock.mockResolvedValue([]);

    render(
      <UsedGearWorkflowPostPublishSection
        currentUserName="Taylor Reviewer"
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('ACT-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Select Bucket' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Selected Sold Ready' }));
    await waitFor(() => {
      expect(markWorkflowRowsSoldReadyToShipMock).toHaveBeenCalledWith(['rec-active']);
    });
  });

  it('routes the last-touched action to listings approval for listing events', async () => {
    const onOpenListingsRecord = vi.fn();

    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-active',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'ACT-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2026-05-08T05:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearWorkflowPostPublishSection
        currentUserName="Taylor Reviewer"
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={onOpenListingsRecord}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /last touched: marked listed/i }));

    expect(onOpenListingsRecord).toHaveBeenCalledWith('rec-active');
  });
});