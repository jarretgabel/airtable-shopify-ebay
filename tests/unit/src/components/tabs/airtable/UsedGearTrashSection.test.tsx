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
        onOpenOperationalRecord={vi.fn()}
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

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenOperationalRecord={vi.fn()} />);

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

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenOperationalRecord={vi.fn()} searchTerm="transformer cover" />);

    await screen.findByText('Trash Review');

    expect(screen.getByText('TRASH-REASON')).toBeInTheDocument();
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

    render(<UsedGearTrashSection onOpenReviewRecord={onOpenReviewRecord} onOpenOperationalRecord={vi.fn()} />);

    await screen.findByText('Trash Review');

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    expect(onOpenReviewRecord).toHaveBeenCalledWith('rec-trash');
    expect(screen.queryByText(/Qualification Notes:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pricing Gate:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Offer Amount:/i)).not.toBeInTheDocument();
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

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenOperationalRecord={vi.fn()} />);

    await screen.findByText('Trash Review');

    expect(screen.getByText('Single intake item')).toBeInTheDocument();
    expect(screen.getByText(/Intake Date:/i)).toBeInTheDocument();
    expect(screen.getByText(/May 6, 2026/i)).toBeInTheDocument();
  });
});