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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        searchTerm="manual entry"
      />,
    );

    await screen.findByText('Parking Lot 2');

    expect(screen.getByText('LOT2-SOURCE')).toBeInTheDocument();
    expect(screen.queryByText('LOT2-OTHER')).not.toBeInTheDocument();
  });

  it('opens downstream workflow forms from queue cards', async () => {
    const onOpenTestingForm = vi.fn();

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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={onOpenTestingForm}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    fireEvent.click(screen.getByRole('button', { name: 'Open Testing' }));

    expect(onOpenTestingForm).toHaveBeenCalledWith('rec-lot-two');
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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    fireEvent.click(screen.getByRole('button', { name: 'Open Set Handoff' }));

    expect(onOpenGroupReview).toHaveBeenCalledWith('pickup:pickup-100');
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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    expect(screen.getByText('Single intake item')).toBeInTheDocument();
    expect(screen.getByText(/Intake Date:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/May 6, 2026/i).length).toBeGreaterThan(0);
  });
});