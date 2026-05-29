import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParkingLotTab } from '@/components/tabs/ParkingLotTab';

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

describe('ParkingLotTab', () => {
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
      {
        id: 'rec-missing-item',
        createdTime: '2026-05-09T00:00:00.000Z',
        fields: {
          SKU: 'WF-3',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Accepted - Arrived, Awaiting Missing Item',
          'Workflow Source': 'JotForm',
        },
      },
      {
        id: 'rec-stale-accepted',
        createdTime: '2026-05-10T00:00:00.000Z',
        fields: {
          Make: 'Sansui',
          Model: 'AU-717',
          'Workflow Status': 'Pending Review',
          'Workflow Source': 'JotForm',
          'Qualification Complete': true,
          'Accepted At': '2026-05-10T10:00:00.000Z',
          'Accepted By': 'Taylor Reviewer',
          'Arrival Date': '2026-05-10',
        },
      },
    ]);
  });

  it('stores the intake source filter in route state', async () => {
    render(
      <MemoryRouter initialEntries={['/parking-lot']}>
        <ParkingLotTab currentUserName="Taylor Reviewer" />
        <LocationState />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(loadParkingLotQueueMock).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Awaiting Arrival')).toBeInTheDocument();
    expect((await screen.findAllByText('Awaiting Missing Item')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Filter Parking Lot by source'), { target: { value: 'JotForm' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/parking-lot?workflowParkingLotSource=JotForm#used-gear-parking-lot');
    });

    expect(screen.getByText('McIntosh · MC240')).toBeInTheDocument();
    expect(screen.getByText('Sansui · AU-717')).toBeInTheDocument();
    expect(screen.queryByText('Pioneer · SX-1250')).not.toBeInTheDocument();
  });

  it('routes accepted-marker records to the arrival review page', async () => {
    render(
      <MemoryRouter initialEntries={['/parking-lot']}>
        <ParkingLotTab currentUserName="Taylor Reviewer" />
        <LocationState />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(loadParkingLotQueueMock).toHaveBeenCalledTimes(1);
    });

    const row = (await screen.findByText('Sansui · AU-717')).closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLTableRowElement).getByLabelText('Open Review'));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/parking-lot/arrival/rec-stale-accepted');
    });
  });
});