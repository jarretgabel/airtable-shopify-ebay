import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowPostPublishSection } from '@/components/tabs/airtable/UsedGearWorkflowPostPublishSection';

const { loadWorkflowPostPublishQueueMock, clipboardWriteTextMock } = vi.hoisted(() => ({
  loadWorkflowPostPublishQueueMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadWorkflowPostPublishQueue: loadWorkflowPostPublishQueueMock,
    markWorkflowListingStale: vi.fn(),
    markWorkflowSoldReadyToShip: vi.fn(),
    markWorkflowShipped: vi.fn(),
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
});