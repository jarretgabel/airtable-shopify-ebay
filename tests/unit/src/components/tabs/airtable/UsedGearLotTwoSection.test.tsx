import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearLotTwoSection } from '@/components/tabs/airtable/UsedGearLotTwoSection';

const { loadLotTwoQueueMock } = vi.hoisted(() => ({
  loadLotTwoQueueMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadLotTwoQueue: loadLotTwoQueueMock,
  };
});

describe('UsedGearLotTwoSection', () => {
  beforeEach(() => {
    loadLotTwoQueueMock.mockReset();
    window.history.replaceState({}, '', '/parking-lot-2');
  });

  it('supports externally-controlled search state for shareable queue urls', async () => {
    const onSearchTermChange = vi.fn();

    loadLotTwoQueueMock.mockResolvedValue([
      {
        id: 'rec-lot-two',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'LOT2-1',
          Make: 'Luxman',
          Model: 'L-507',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
    ]);

    render(
      <UsedGearLotTwoSection
        onOpenReviewRecord={vi.fn()}
        searchTerm="luxman"
        onSearchTermChange={onSearchTermChange}
      />,
    );

    const input = await screen.findByRole('textbox', { name: 'Search Parking Lot 2' });
    expect(input).toHaveValue('luxman');

    fireEvent.change(input, { target: { value: 'mcintosh' } });

    expect(onSearchTermChange).toHaveBeenCalledWith('mcintosh');
  });

  it('shows inline sort options in the header', async () => {
    loadLotTwoQueueMock.mockResolvedValue([]);

    render(
      <UsedGearLotTwoSection
        onOpenReviewRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');
    expect(screen.getByLabelText(/Sort Parking Lot 2 queue/i)).toBeInTheDocument();
  });

  it('filters lot two rows by shared source or status fields', async () => {
    loadLotTwoQueueMock.mockResolvedValue([
      {
        id: 'rec-lot-two-source',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'LOT2-SOURCE',
          Make: 'Luxman',
          Model: 'L-507',
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
      {
        id: 'rec-lot-two-other',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'LOT2-OTHER',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
        },
      },
    ]);

    render(
      <UsedGearLotTwoSection
        onOpenReviewRecord={vi.fn()}
        searchTerm="manual entry"
      />,
    );

    await screen.findByText('Parking Lot 2');

    expect(screen.getAllByText('LOT2-SOURCE').length).toBeGreaterThan(0);
    expect(screen.queryByText('LOT2-OTHER')).not.toBeInTheDocument();
  });

  it('truncates long workflow statuses inside the fixed status column', async () => {
    loadLotTwoQueueMock.mockResolvedValue([
      {
        id: 'rec-lot-two-long-status',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'LOT2-LONG',
          Make: 'Luxman',
          Model: 'L-507',
          'Workflow Status': 'Accepted - Arrived, Awaiting Missing Item',
        },
      },
    ]);

    render(
      <UsedGearLotTwoSection
        onOpenReviewRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    expect(screen.getByText('Arrived, Awaiting Missing Item')).toHaveAttribute('title', 'Arrived, Awaiting Missing Item');
  });

  it('removes redundant status suffixes from the item column while keeping the status chip specific', async () => {
    loadLotTwoQueueMock.mockResolvedValue([
      {
        id: 'rec-lot-two-item-status',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'LOT2-ITEM',
          Make: 'Luxman',
          Model: 'L-507 Awaiting Arrival',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
    ]);

    render(
      <UsedGearLotTwoSection
        onOpenReviewRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    expect(screen.getByText('Luxman · L-507')).toBeInTheDocument();
    expect(screen.queryByText('Luxman · L-507 Awaiting Arrival')).not.toBeInTheDocument();
    expect(screen.getByText('Awaiting Arrival')).toBeInTheDocument();
    expect(screen.queryByText('Accepted - Awaiting Arrival')).not.toBeInTheDocument();
  });

  it('opens the dedicated Lot 2 review page from queue cards', async () => {
    const onOpenReviewRecord = vi.fn();

    loadLotTwoQueueMock.mockResolvedValue([
      {
        id: 'rec-lot-two',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'LOT2-1',
          Make: 'Luxman',
          Model: 'L-507',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
    ]);

    render(
      <UsedGearLotTwoSection
        onOpenReviewRecord={onOpenReviewRecord}
      />,
    );

    await screen.findByText('Parking Lot 2');

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Review' })[0]!);

    expect(onOpenReviewRecord).toHaveBeenCalledWith('rec-lot-two');
    expect(screen.queryByText(/Qualification Notes:/i)).not.toBeInTheDocument();
  });

  it('opens the dedicated Parking Lot 2 handoff surface from grouped queue cards', async () => {
    const onOpenGroupReview = vi.fn();

    loadLotTwoQueueMock.mockResolvedValue([
      {
        id: 'rec-lot-two-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          'Pick Up ID': 'pickup-100',
          SKU: 'LOT2-A',
          Make: 'Luxman',
          Model: 'L-507',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
      {
        id: 'rec-lot-two-b',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          'Pick Up ID': 'pickup-100',
          SKU: 'LOT2-B',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
        },
      },
    ]);

    render(
      <UsedGearLotTwoSection
        onOpenGroupReview={onOpenGroupReview}
        onOpenReviewRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    fireEvent.click(screen.getByRole('button', { name: /Open pickup set handoff pickup-100/i }));

    expect(onOpenGroupReview).toHaveBeenCalledWith('pickup-100');
  });

  it('labels ungrouped records as single items', async () => {
    loadLotTwoQueueMock.mockResolvedValue([
      {
        id: 'rec-lot-two-single',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          'Arrival Date': '2026-05-06',
          SKU: 'LOT2-SINGLE',
          Make: 'Luxman',
          Model: 'L-507',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
    ]);

    render(
      <UsedGearLotTwoSection
        onOpenReviewRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    expect(screen.queryByText('Single intake item')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Group/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: /Batch/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: /Item Actions/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: /Status/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('Awaiting Arrival')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/May 6, 2026/i).length).toBeGreaterThan(0);
  });
});