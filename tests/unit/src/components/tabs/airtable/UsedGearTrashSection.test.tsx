import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearTrashSection } from '@/components/tabs/airtable/UsedGearTrashSection';

const { loadTrashQueueMock } = vi.hoisted(() => ({
  loadTrashQueueMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadTrashQueue: loadTrashQueueMock,
  };
});

describe('UsedGearTrashSection', () => {
  beforeEach(() => {
    loadTrashQueueMock.mockReset();
    window.history.replaceState({}, '', '/trash-review');
  });

  it('supports externally-controlled search state for shareable trash urls', async () => {
    const onSearchTermChange = vi.fn();

    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-1',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
        },
      },
    ]);

    render(
      <UsedGearTrashSection
        onOpenReviewRecord={vi.fn()}
        onOpenGroupReview={vi.fn()}
        searchTerm="pioneer"
        onSearchTermChange={onSearchTermChange}
      />,
    );

    const input = await screen.findByRole('textbox', { name: 'Search workflow trash' });
    expect(input).toHaveValue('pioneer');

    fireEvent.change(input, { target: { value: 'luxman' } });

    expect(onSearchTermChange).toHaveBeenCalledWith('luxman');
  });

  it('shows inline sort options in the header', async () => {
    loadTrashQueueMock.mockResolvedValue([]);

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenGroupReview={vi.fn()} />);

    await screen.findByText('Trash Review');
    expect(screen.getByLabelText(/Sort trash review queue/i)).toBeInTheDocument();
  });

  it('filters trash rows by shared source or status fields and trash reason', async () => {
    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash-reason',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-REASON',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Unqualified',
          'Unqualified Reason': 'Missing transformer cover',
          'Trash Status': 'Active Trash',
        },
      },
      {
        id: 'rec-trash-other',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-OTHER',
          Make: 'Luxman',
          Model: 'L-507',
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Unqualified',
          'Unqualified Reason': 'Broken dial glass',
          'Trash Status': 'Active Trash',
        },
      },
    ]);

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenGroupReview={vi.fn()} searchTerm="transformer cover" />);

    await screen.findByText('Trash Review');

    expect(screen.getAllByText('TRASH-REASON').length).toBeGreaterThan(0);
    expect(screen.queryByText('TRASH-OTHER')).not.toBeInTheDocument();
  });

  it('opens the dedicated trash review page from a compact queue card', async () => {
    const onOpenReviewRecord = vi.fn();

    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-1',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
          'Offer Amount': 100,
          'Qualification Notes': 'Customer clarified the power issue.',
        },
      },
    ]);

    render(<UsedGearTrashSection onOpenReviewRecord={onOpenReviewRecord} onOpenGroupReview={vi.fn()} />);

    await screen.findByText('Trash Review');

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Review' })[0]!);

    expect(onOpenReviewRecord).toHaveBeenCalledWith('rec-trash');
    expect(screen.queryByText(/^Unqualified$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Qualification Notes:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pricing Gate:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Offer Amount:/i)).not.toBeInTheDocument();
  });

  it('opens the dedicated grouped trash review page for multi-item trash groups', async () => {
    const onOpenGroupReview = vi.fn();

    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-A',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
          'Submission Group ID': 'trash-set-a',
        },
      },
      {
        id: 'rec-trash-b',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-B',
          Make: 'Pioneer',
          Model: 'CT-F9191',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
          'Submission Group ID': 'trash-set-a',
        },
      },
    ]);

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenGroupReview={onOpenGroupReview} />);

    await screen.findByText('Trash Review');
    fireEvent.click(screen.getByRole('button', { name: 'Open Group Review' }));

    expect(onOpenGroupReview).toHaveBeenCalledWith('trash-set-a');
  });

  it('labels ungrouped trash records as single items', async () => {
    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash-single',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          'Arrival Date': '2026-05-06',
          SKU: 'TRASH-SINGLE',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
        },
      },
    ]);

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenGroupReview={vi.fn()} />);

    await screen.findByText('Trash Review');

    expect(screen.queryByText('Single intake item')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Group/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/May 6, 2026/i).length).toBeGreaterThan(0);
  });

  it('hides the duplicate operational action when review already targets the same trash route', async () => {
    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash-single',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-SINGLE',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
        },
      },
    ]);

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenGroupReview={vi.fn()} />);

    await screen.findAllByText('TRASH-SINGLE');

    expect(screen.queryByRole('button', { name: 'Open Operational Record' })).not.toBeInTheDocument();
  });
});