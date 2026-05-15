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

  it('shows inline sort options in the header by default', async () => {
    loadPendingReviewQueueMock.mockResolvedValue([]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenReviewRecord={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    await screen.findByText('Pending Review Queue');
    expect(screen.getByLabelText(/Sort pending review queue/i)).toBeInTheDocument();
  });

  it('labels single pending-review records without group wording', async () => {
    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending-single',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          'Arrival Date': '2026-05-06',
          SKU: 'PEND-SINGLE',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
          'Offer Amount': 500,
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

    expect(screen.getByText('Single intake item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Item Link' })).toBeInTheDocument();
    expect(screen.getByText(/Intake Date:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/May 6, 2026/i).length).toBeGreaterThan(0);
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

    expect(await screen.findByRole('button', { name: 'Open Group Review' })).toBeInTheDocument();
    expect(screen.queryByText('Grouped intake review has moved off the queue cards.')).not.toBeInTheDocument();
    expect(screen.queryByText('SUB-42')).not.toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('button', { name: /Copy (Group|Item) Link/i }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/inventory?workflowPendingReviewGroup=pickup%3Apickup-a#used-gear-pending-review`);
    });
  });

  it('ignores the legacy owner filter prop and keeps the full queue visible', async () => {
    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
          'Workflow Owner': 'Taylor Reviewer',
          'Offer Amount': 500,
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
          'Offer Amount': 400,
        },
      },
      {
        id: 'rec-pending-c',
        createdTime: '2026-05-05T00:00:00.000Z',
        fields: {
          SKU: 'PEND-3',
          Make: 'Sansui',
          Model: 'AU-717',
          'Workflow Status': 'Pending Review',
          'Offer Amount': 450,
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

    expect(await screen.findByText('Pending Review Queue')).toBeInTheDocument();
    expect(screen.getAllByText('PEND-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PEND-2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PEND-3').length).toBeGreaterThan(0);
  });

  it('opens workflow detail from the compact queue card', async () => {
    const onOpenWorkflowRecord = vi.fn();

    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
          'Workflow Owner': 'Taylor Reviewer',
          'Workflow Owner Assigned At': '2026-05-08T03:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenReviewRecord={vi.fn()}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Workflow Detail' }));

    expect(onOpenWorkflowRecord).toHaveBeenCalledWith('rec-pending');
  });
});