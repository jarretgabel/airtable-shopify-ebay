import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearPendingReviewSection } from '@/components/tabs/airtable/UsedGearPendingReviewSection';

const { loadPendingReviewQueueMock, acceptPendingReviewRecordMock, acceptPendingReviewGroupMock, clipboardWriteTextMock } = vi.hoisted(() => ({
  loadPendingReviewQueueMock: vi.fn(),
  acceptPendingReviewRecordMock: vi.fn(),
  acceptPendingReviewGroupMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadPendingReviewQueue: loadPendingReviewQueueMock,
    acceptPendingReviewRecord: acceptPendingReviewRecordMock,
    acceptPendingReviewGroup: acceptPendingReviewGroupMock,
    markPendingReviewUnqualified: vi.fn(),
    markPendingReviewGroupUnqualified: vi.fn(),
  };
});

describe('UsedGearPendingReviewSection', () => {
  beforeEach(() => {
    acceptPendingReviewRecordMock.mockReset();
    acceptPendingReviewGroupMock.mockReset();
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
        onOpenIncomingGearForm={vi.fn()}
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
        onOpenIncomingGearForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        collapsedGroupIds={[]}
        onCollapsedGroupIdsChange={onCollapsedGroupIdsChange}
      />,
    );

    await screen.findByText('Pending Review Queue');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse All Groups' }));

    expect(onCollapsedGroupIdsChange).toHaveBeenCalledWith(['pickup:pickup-a', 'pickup:pickup-b']);
  });

  it('requires qualification notes before enabling accept into lot 2', async () => {
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
        onOpenIncomingGearForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    const acceptButton = await screen.findByRole('button', { name: 'Accept Into Lot 2' });
    expect(acceptButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Qualification Notes Required For Lot 2'), {
      target: { value: 'Offer approved and pickup scheduled.' },
    });

    expect(screen.getByRole('button', { name: 'Accept Into Lot 2' })).toBeEnabled();
  });

  it('accepts an entire grouped submission with one shared decision', async () => {
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
    acceptPendingReviewGroupMock.mockResolvedValue([]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenIncomingGearForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Apply the same intake decision to the full group')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Shared Qualification Notes'), {
      target: { value: 'Customer approved the full stereo pair for pickup.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Accept Entire Group' }));

    await waitFor(() => {
      expect(acceptPendingReviewGroupMock).toHaveBeenCalledWith(expect.objectContaining({
        submissionGroupId: 'SUB-42',
        records: [
          expect.objectContaining({ recordId: 'rec-pending-a' }),
          expect.objectContaining({ recordId: 'rec-pending-b' }),
        ],
      }), 'Taylor Reviewer');
    });
  });
});