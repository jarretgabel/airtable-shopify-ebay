import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearLotTwoGroupPage } from '@/components/tabs/UsedGearLotTwoGroupPage';

const { loadLotTwoGroupMock } = vi.hoisted(() => ({
  loadLotTwoGroupMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  loadLotTwoGroup: loadLotTwoGroupMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? 'N/A'),
}));

vi.mock('@/services/usedGearOperationalRouting', () => ({
  buildUsedGearManualIntakePath: (recordId: string) => `/intake/${recordId}`,
  shouldShowOperationalAction: () => true,
}));

describe('UsedGearLotTwoGroupPage', () => {
  beforeEach(() => {
    loadLotTwoGroupMock.mockReset();
    loadLotTwoGroupMock.mockResolvedValue({
      id: 'pickup:pickup-100',
      key: 'pickup:pickup-100',
      label: 'PICKUP-100',
      description: 'Pickup group',
      records: [
        {
          id: 'rec-lot-two-1',
          createdTime: '2026-05-07T00:00:00.000Z',
          fields: {
            'Arrival Date': '2026-05-07',
            SKU: 'LOT2-1',
            Make: 'McIntosh',
            Model: 'C28',
            'Workflow Source': 'JotForm',
            'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
            'Submission Group ID': 'SUB-42',
            'Pick Up ID': 'PICKUP-100',
          },
        },
        {
          id: 'rec-lot-two-2',
          createdTime: '2026-05-08T00:00:00.000Z',
          fields: {
            'Arrival Date': '2026-05-08',
            SKU: 'LOT2-2',
            Make: 'Marantz',
            Model: '8B',
            'Workflow Source': 'Manual Entry',
            'Workflow Status': 'Accepted - Arrived, Awaiting Missing Item',
            'Submission Group ID': 'SUB-42',
            'Pick Up ID': 'PICKUP-100',
          },
        },
      ],
    });
  });

  it('shows shared handoff context and keeps row actions wired', async () => {
    const onOpenManualIntake = vi.fn();
    const onOpenOperationalRecord = vi.fn();

    render(
      <UsedGearLotTwoGroupPage
        groupId="pickup:pickup-100"
        onBackToParkingLot={vi.fn()}
        onOpenManualIntake={onOpenManualIntake}
        onOpenOperationalRecord={onOpenOperationalRecord}
      />,
    );

    expect(await screen.findByText('Set Summary')).toBeInTheDocument();
    expect(screen.getByText('Shared Context')).toBeInTheDocument();
    expect(screen.getAllByText('PICKUP-100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('LOT2-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('LOT2-2').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Back to Parking Lot 2' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Intake' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Workflow Record' })[0]!);

    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-lot-two-1');
    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-lot-two-1');
  });
});