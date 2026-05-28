import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParkingLotOneTab } from '@/components/tabs/ParkingLotOneTab';

const { loadParkingLotQueueMock } = vi.hoisted(() => ({
  loadParkingLotQueueMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadParkingLotQueue: loadParkingLotQueueMock,
  };
});

function LocationState() {
  const location = useLocation();
  return <div data-testid="location-state">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

describe('ParkingLotOneTab', () => {
  beforeEach(() => {
    loadParkingLotQueueMock.mockReset();
    loadParkingLotQueueMock.mockResolvedValue([
      {
        id: 'rec-jotform',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'WF-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Pending Review',
          'Workflow Source': 'JotForm',
        },
      },
      {
        id: 'rec-manual',
        createdTime: '2026-05-08T00:00:00.000Z',
        fields: {
          SKU: 'WF-2',
          Make: 'Pioneer',
          Model: 'SX-1250',
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Workflow Source': 'Manual Entry',
        },
      },
    ]);
  });

  it('stores the intake source filter in route state', async () => {
    render(
      <MemoryRouter initialEntries={['/parking-lot-1']}>
        <ParkingLotOneTab currentUserName="Taylor Reviewer" />
        <LocationState />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(loadParkingLotQueueMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Filter Parking Lot by source'), { target: { value: 'JotForm' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/parking-lot-1?workflowParkingLotSource=JotForm#used-gear-parking-lot');
    });

    expect(screen.getByText('McIntosh · MC240')).toBeInTheDocument();
    expect(screen.queryByText('Pioneer · SX-1250')).not.toBeInTheDocument();
  });
});