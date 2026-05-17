import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearPendingReviewSection } from '@/components/tabs/airtable/UsedGearPendingReviewSection';

const { loadPendingReviewQueueMock } = vi.hoisted(() => ({
  loadPendingReviewQueueMock: vi.fn(),
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
    window.history.replaceState({}, '', '/inventory');
  });

  it('shows inline sort options in the header by default', async () => {
    loadPendingReviewQueueMock.mockResolvedValue([]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenReviewRecord={vi.fn()}
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
      />,
    );

    await screen.findByText('Pending Review Queue');

    expect(screen.queryByText('Single intake item')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Group/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: /Batch/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: /Item Actions/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
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
      />,
    );

    fireEvent.click((await screen.findAllByRole('button', { name: /Open( Item)? Review/ }))[0]!);

    expect(onOpenReviewRecord).toHaveBeenCalledWith('rec-pending');
    expect(screen.queryByText(/^Pending Review$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Qualification Notes:/i)).not.toBeInTheDocument();
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
      />,
    );

    expect(await screen.findByRole('button', { name: /Open submission set SUB-42/i })).toBeInTheDocument();
    expect(screen.queryByText('Grouped intake review has moved off the queue cards.')).not.toBeInTheDocument();
    expect(screen.queryByText('SUB-42')).not.toBeInTheDocument();
  });

  it('keeps the full pending-review queue visible without owner-scoped filtering', async () => {
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
      />,
    );

    expect(await screen.findByText('Pending Review Queue')).toBeInTheDocument();
    expect(screen.getAllByText('PEND-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PEND-2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PEND-3').length).toBeGreaterThan(0);
  });

  it('filters pending review rows by shared source or status fields', async () => {
    loadPendingReviewQueueMock.mockResolvedValue([
      {
        id: 'rec-pending-source',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-SOURCE',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Pending Review',
        },
      },
      {
        id: 'rec-pending-other',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PEND-OTHER',
          Make: 'Luxman',
          Model: 'L-507',
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Pending Review',
        },
      },
    ]);

    render(
      <UsedGearPendingReviewSection
        currentUserName="Taylor Reviewer"
        onOpenReviewRecord={vi.fn()}
        searchTerm="manual entry"
      />,
    );

    await screen.findByText('Pending Review Queue');

    expect(screen.getAllByText('PEND-SOURCE').length).toBeGreaterThan(0);
    expect(screen.queryByText('PEND-OTHER')).not.toBeInTheDocument();
  });

  it('does not show a duplicate operational action on pending-review queue rows', async () => {
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
      />,
    );

    await screen.findAllByText('PEND-1');
    expect(screen.queryByRole('button', { name: 'Open Operational Record' })).not.toBeInTheDocument();
  });
});