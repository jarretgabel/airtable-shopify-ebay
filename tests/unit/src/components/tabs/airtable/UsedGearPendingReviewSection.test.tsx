import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearPendingReviewSection } from '@/components/tabs/airtable/UsedGearPendingReviewSection';

const { loadPendingReviewQueueMock, clipboardWriteTextMock } = vi.hoisted(() => ({
  loadPendingReviewQueueMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadPendingReviewQueue: loadPendingReviewQueueMock,
  };
});

describe('UsedGearPendingReviewSection', () => {
  beforeEach(() => {
    clipboardWriteTextMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextMock,
      },
    });
    window.history.replaceState({}, '', '/inventory');
  });

  it('copies the pending review queue link for sharing', async () => {
    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
        },
      },
    ]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenGroupReview={vi.fn()}
        onOpenReviewRecord={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    await screen.findByText('Pending Review Queue');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Queue Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/inventory#used-gear-pending-review`);
    });
  });

  it('emits collapse-all group ids for the visible pending-review groups', async () => {
    const onCollapsedGroupIdsChange = vi.fn();

    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
          'Pick Up ID': 'pickup-a',
        },
      },
      {
        id: 'rec-pending-b',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-2',
          Make: 'Marantz',
          Model: 'Model 8',
          'Workflow Status': 'Pending Review',
          'Pick Up ID': 'pickup-b',
        },
      },
    ]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenReviewRecord={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        collapsedGroupIds={[]}
        onCollapsedGroupIdsChange={onCollapsedGroupIdsChange}
      />,
    );

    await screen.findByText('Pending Review Queue');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse All Groups' }));

    expect(onCollapsedGroupIdsChange).toHaveBeenCalledWith(['pickup:pickup-a', 'pickup:pickup-b']);
  });

  it('opens the dedicated item review page from a compact queue card', async () => {
    const onOpenReviewRecord = vi.fn();

    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
          'Qualification Notes': '',
          'Offer Amount': 500,
        },
      },
    ]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenReviewRecord={onOpenReviewRecord}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open Review' }));

    expect(onOpenReviewRecord).toHaveBeenCalledWith('rec-pending');
  });

  it('shows the grouped review guidance instead of inline batch actions', async () => {
    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
          'Submission Group ID': 'SUB-42',
          'Confirmed Grand Total': 1000,
        },
      },
      {
        id: 'rec-pending-b',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-2',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Pending Review',
          'Submission Group ID': 'SUB-42',
          'Confirmed Grand Total': 1000,
        },
      },
    ]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenGroupReview={vi.fn()}
        onOpenReviewRecord={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Grouped intake review has moved off the queue cards.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Group Review' })).toBeInTheDocument();
  });

  it('copies a group-focused pending review link', async () => {
    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
          'Pick Up ID': 'pickup-a',
          'Offer Amount': 500,
        },
      },
    ]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenReviewRecord={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    await screen.findByText('Pending Review Queue');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Group Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/inventory?workflowPendingReviewGroup=pickup%3Apickup-a#used-gear-pending-review`);
    });
  });
});