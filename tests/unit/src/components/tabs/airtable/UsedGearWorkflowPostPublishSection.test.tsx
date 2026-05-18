import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    window.history.replaceState({}, '', '/workflow-hub');
  });

  it('keeps all sections visible and announces the deep-linked lifecycle section', async () => {
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
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Sold Ready To Ship')).toBeInTheDocument();
    expect(screen.getByText('Dashboard shortcut opened the post-publish page and jumped to the selected lifecycle section.')).toBeInTheDocument();
    expect(screen.getByText('Active Listings')).toBeInTheDocument();
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

  it('keeps post-publish rows visible without owner-scoped filtering', async () => {
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
    expect(screen.getAllByRole('columnheader', { name: /Status/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('Listed, Shopify')).toBeInTheDocument();
    expect(screen.getByText('Stale Listing, eBay')).toBeInTheDocument();
  });

  it('removes the open-operational button and keeps listing approval actions for listing buckets', async () => {
    const onOpenListingsRecord = vi.fn();

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
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={onOpenListingsRecord}
      />,
    );

    await screen.findByText('STALE-1');

    expect(screen.queryByRole('button', { name: 'Open Operational Record' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Listings Approval' }));

    expect(onOpenListingsRecord).toHaveBeenCalledWith('rec-stale');
  });

  it('supports sold-ready reconciliation from row actions', async () => {
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
    markWorkflowSoldReadyToShipMock.mockResolvedValue({
      id: 'rec-active',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        SKU: 'ACT-1',
        Make: 'McIntosh',
        Model: 'C28',
        'Workflow Status': 'Sold - Ready to Ship',
        'Listed At': '2099-01-01T00:00:00.000Z',
        'Sold Ready To Ship At': '2026-05-08T06:00:00.000Z',
      },
    });

    render(
      <UsedGearWorkflowPostPublishSection
        currentUserName="Taylor Reviewer"
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('ACT-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark Sold Ready' })[0]!);
    await waitFor(() => {
      expect(markWorkflowSoldReadyToShipMock).toHaveBeenCalledWith('rec-active');
    });
  });

  it('supports shipped reconciliation from row actions', async () => {
    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-sold',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'SOLD-1',
          Make: 'Pioneer',
          Model: 'SX-1250',
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-08T05:00:00.000Z',
        },
      },
    ]);
    markWorkflowShippedMock.mockResolvedValue({
      id: 'rec-sold',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        SKU: 'SOLD-1',
        Make: 'Pioneer',
        Model: 'SX-1250',
        'Workflow Status': 'Shipped',
        'Sold Ready To Ship At': '2026-05-08T05:00:00.000Z',
        'Shipped At': '2026-05-09T07:00:00.000Z',
      },
    });

    render(
      <UsedGearWorkflowPostPublishSection
        currentUserName="Taylor Reviewer"
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Mark Shipped' }));

    await waitFor(() => {
      expect(markWorkflowShippedMock).toHaveBeenCalledWith('rec-sold');
    });
  });

  it('shows last touched as a plain timestamp without action copy', async () => {
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
        onOpenListingsRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText(/May (7|8), 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Marked listed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /last touched/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Open Operational Record/i)).not.toBeInTheDocument();
  });

  it('renders archive rows with ship date and workflow snapshot actions instead of active-work columns', async () => {
    const onOpenOperationalRecord = vi.fn();

    loadWorkflowPostPublishQueueMock.mockResolvedValue([
      {
        id: 'rec-shipped',
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
        sectionDefinitions={[{ key: 'shipped', id: 'used-gear-post-publish-shipped', title: 'Completed Shipments', description: '' }]}
        overviewSectionId="used-gear-archive"
        queueTitle="Completed Shipments"
        queueNoun="completed shipments"
        focusedBucketNotice=""
        showSectionTitles={false}
        searchPlaceholder="Search by status, SKU, model, or ship date"
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('SHIP-1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by status, SKU, model, or ship date')).toBeInTheDocument();
    expect(screen.queryByText('Completed shipments retained for quick workflow lookup.')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Days Live' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Last Touched' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ship Date' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Completed Shipments' })).toHaveLength(1);
    expect(screen.queryByText('Shipped')).not.toBeInTheDocument();
    expect(screen.getByText(/Feb\s+\d{1,2},\s+2026/)).toHaveClass('block', 'text-xs', 'text-[var(--muted)]');

    fireEvent.click(screen.getByRole('button', { name: 'Open Workflow Snapshot' }));

    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-shipped');
  });
});