import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearParkingLotArrivalGroupPage } from '@/components/tabs/UsedGearParkingLotArrivalGroupPage';

const { completeProcessingStageMock, loadParkingLotArrivalGroupMock, markPendingReviewUnqualifiedMock, saveParkingLotArrivalReviewRecordMock } = vi.hoisted(() => ({
  completeProcessingStageMock: vi.fn(),
  loadParkingLotArrivalGroupMock: vi.fn(),
  markPendingReviewUnqualifiedMock: vi.fn(),
  saveParkingLotArrivalReviewRecordMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  completeProcessingStage: completeProcessingStageMock,
  loadParkingLotArrivalGroup: loadParkingLotArrivalGroupMock,
  markPendingReviewUnqualified: markPendingReviewUnqualifiedMock,
  saveParkingLotArrivalReviewRecord: saveParkingLotArrivalReviewRecordMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? 'N/A'),
}));

vi.mock('@/services/usedGearOperationalRouting', () => ({
  buildUsedGearManualIntakePath: (recordId: string) => `/intake/${recordId}`,
  shouldShowOperationalAction: () => true,
}));

describe('UsedGearParkingLotArrivalGroupPage', () => {
  beforeEach(() => {
    completeProcessingStageMock.mockReset();
    loadParkingLotArrivalGroupMock.mockReset();
    markPendingReviewUnqualifiedMock.mockReset();
    saveParkingLotArrivalReviewRecordMock.mockReset();
    loadParkingLotArrivalGroupMock.mockResolvedValue({
      id: 'pickup-100',
      key: 'pickup-100',
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
            'Arrival Date': '',
            SKU: '',
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
    saveParkingLotArrivalReviewRecordMock.mockImplementation(async (recordId: string, values: { arrivalDate: string; sku: string }) => ({
      id: recordId,
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Arrival Date': values.arrivalDate,
        SKU: values.sku,
        Make: recordId === 'rec-lot-two-1' ? 'McIntosh' : 'Marantz',
        Model: recordId === 'rec-lot-two-1' ? 'C28' : '8B',
        'Workflow Source': 'JotForm',
        'Workflow Status': recordId === 'rec-lot-two-1' ? 'Accepted - Arrived, Awaiting SKU' : 'Accepted - Arrived, Awaiting Missing Item',
        'Submission Group ID': 'SUB-42',
        'Pick Up ID': 'PICKUP-100',
      },
    }));
    completeProcessingStageMock.mockResolvedValue({
      id: 'rec-lot-two-1',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        SKU: 'LOT2-1',
        'Workflow Status': 'Testing In Progress',
      },
    });
    markPendingReviewUnqualifiedMock.mockResolvedValue(undefined);
  });

  it('shows batch handoff controls and keeps row actions wired', async () => {
    const onOpenManualIntake = vi.fn();

    render(
      <UsedGearParkingLotArrivalGroupPage
        currentUserName="Taylor Reviewer"
        groupId="pickup-100"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={vi.fn()}
        onOpenManualIntake={onOpenManualIntake}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Group Review' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Parking Lot arrival-stage group sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Group Review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trash' })).toBeInTheDocument();
    expect(screen.queryByText('Group Handoff')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared Context')).not.toBeInTheDocument();
    expect(screen.getAllByText('PICKUP-100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Arrival Date').length).toBeGreaterThan(0);
    expect(screen.queryByText('Intake Date')).not.toBeInTheDocument();
    expect(screen.getByText(/Marantz/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Parking Lot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete Ready Items' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Workflow Record' })).not.toBeInTheDocument();
    expect(screen.queryByText('Arrival Date and SKU are required before this item can leave Parking Lot.')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Intake' })[0]!);

    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-lot-two-1');
    expect(screen.getByText('Arrival Date and SKU are required before each remaining item can leave Parking Lot.')).toBeInTheDocument();
  });

  it('saves grouped Parking Lot handoff fields for the batch', async () => {
    render(
      <UsedGearParkingLotArrivalGroupPage
        currentUserName="Taylor Reviewer"
        groupId="pickup-100"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={vi.fn()}
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Group Review' });

    fireEvent.change(screen.getAllByLabelText('Arrival Date')[1]!, { target: { value: '2026-05-08' } });
    fireEvent.change(screen.getAllByLabelText('SKU')[1]!, { target: { value: 'LOT2-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Review' }));

    await waitFor(() => {
      expect(saveParkingLotArrivalReviewRecordMock).toHaveBeenCalledWith('rec-lot-two-1', {
        arrivalDate: '2026-05-07',
        sku: 'LOT2-1',
      });
      expect(saveParkingLotArrivalReviewRecordMock).toHaveBeenCalledWith('rec-lot-two-2', {
        arrivalDate: '2026-05-08',
        sku: 'LOT2-2',
      });
    });

    expect(await screen.findByText('Saved Parking Lot review fields for this batch.')).toBeInTheDocument();
  });

  it('moves ready items out of Parking Lot in one batch action', async () => {
    render(
      <UsedGearParkingLotArrivalGroupPage
        currentUserName="Taylor Reviewer"
        groupId="pickup-100"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={vi.fn()}
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Group Review' });
    fireEvent.click(screen.getByRole('button', { name: 'Complete Ready Items' }));

    await waitFor(() => {
      expect(saveParkingLotArrivalReviewRecordMock).toHaveBeenCalledWith('rec-lot-two-1', {
        arrivalDate: '2026-05-07',
        sku: 'LOT2-1',
      });
      expect(completeProcessingStageMock).toHaveBeenCalledWith('rec-lot-two-1', 'Taylor Reviewer');
    });

    expect(completeProcessingStageMock).not.toHaveBeenCalledWith('rec-lot-two-2', 'Taylor Reviewer');
  });

  it('routes the full Parking Lot batch into trash review', async () => {
    const onOpenTrashReview = vi.fn();

    render(
      <UsedGearParkingLotArrivalGroupPage
        currentUserName="Taylor Reviewer"
        groupId="pickup-100"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={onOpenTrashReview}
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Route To Trash' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Unqualified Reason' }), {
      target: { value: 'The entire pickup needs to stop in Parking Lot because the handoff failed validation.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send To Trash' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send To Trash' }));

    await waitFor(() => {
      expect(markPendingReviewUnqualifiedMock).toHaveBeenCalledWith('rec-lot-two-1', 'The entire pickup needs to stop in Parking Lot because the handoff failed validation.');
      expect(markPendingReviewUnqualifiedMock).toHaveBeenCalledWith('rec-lot-two-2', 'The entire pickup needs to stop in Parking Lot because the handoff failed validation.');
    });

    expect(onOpenTrashReview).toHaveBeenCalled();
  });
});