import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearLotTwoSection } from '@/components/tabs/airtable/UsedGearLotTwoSection';

const { loadLotTwoQueueMock, loadUsedGearWorkflowRecordBySkuMock, clipboardWriteTextMock } = vi.hoisted(() => ({
  loadLotTwoQueueMock: vi.fn(),
  loadUsedGearWorkflowRecordBySkuMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadLotTwoQueue: loadLotTwoQueueMock,
    loadUsedGearWorkflowRecordBySku: loadUsedGearWorkflowRecordBySkuMock,
  };
});

describe('UsedGearLotTwoSection', () => {
  beforeEach(() => {
    loadLotTwoQueueMock.mockReset();
    loadUsedGearWorkflowRecordBySkuMock.mockReset();
    clipboardWriteTextMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextMock,
      },
    });
    window.history.replaceState({}, '', '/parking-lot-2');
  });

  it('copies the lot-two queue link for sharing', async () => {
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
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Queue Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/parking-lot-2#used-gear-lot-two`);
    });
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
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        searchTerm="luxman"
        onSearchTermChange={onSearchTermChange}
      />,
    );

    const input = await screen.findByRole('textbox', { name: 'Search Parking Lot 2' });
    expect(input).toHaveValue('luxman');

    fireEvent.change(input, { target: { value: 'mcintosh' } });

    expect(onSearchTermChange).toHaveBeenCalledWith('mcintosh');
  });

  it('activates downstream workflow forms by exact sku lookup', async () => {
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
    loadUsedGearWorkflowRecordBySkuMock.mockResolvedValue({
      id: 'rec-by-sku',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        SKU: 'SKU-LOOKUP-1',
      },
    });

    render(
      <UsedGearLotTwoSection
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={onOpenTestingForm}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    fireEvent.change(screen.getByRole('textbox', { name: 'Activate by SKU' }), {
      target: { value: 'SKU-LOOKUP-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open Testing' }));

    await waitFor(() => {
      expect(loadUsedGearWorkflowRecordBySkuMock).toHaveBeenCalledWith('SKU-LOOKUP-1');
      expect(onOpenTestingForm).toHaveBeenCalledWith('rec-by-sku');
    });
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
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    await screen.findByText('Parking Lot 2');

    expect(screen.getByText('Single intake item')).toBeInTheDocument();
    expect(screen.getByText('Visible Sets')).toBeInTheDocument();
    expect(screen.getByText('Downstream Activation')).toBeInTheDocument();
    expect(screen.getByText(/Intake Date:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/May 6, 2026/i).length).toBeGreaterThan(0);
  });
});