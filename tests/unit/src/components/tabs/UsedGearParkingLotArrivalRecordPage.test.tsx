import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { within } from '@testing-library/react';
import { UsedGearParkingLotArrivalRecordPage } from '@/components/tabs/UsedGearParkingLotArrivalRecordPage';

const {
  completeProcessingStageMock,
  loadUsedGearOperationalRecordContextMock,
  markPendingReviewUnqualifiedMock,
  navigateMock,
  saveParkingLotArrivalReviewRecordMock,
} = vi.hoisted(() => ({
  completeProcessingStageMock: vi.fn(),
  loadUsedGearOperationalRecordContextMock: vi.fn(),
  markPendingReviewUnqualifiedMock: vi.fn(),
  navigateMock: vi.fn(),
  saveParkingLotArrivalReviewRecordMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ search: '?reviewMode=test' }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/services/usedGearQueue', () => ({
  completeProcessingStage: completeProcessingStageMock,
  loadUsedGearOperationalRecordContext: loadUsedGearOperationalRecordContextMock,
  markPendingReviewUnqualified: markPendingReviewUnqualifiedMock,
  saveParkingLotArrivalReviewRecord: saveParkingLotArrivalReviewRecordMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? ''),
}));

describe('UsedGearParkingLotArrivalRecordPage', () => {
  beforeEach(() => {
    completeProcessingStageMock.mockReset();
    loadUsedGearOperationalRecordContextMock.mockReset();
    markPendingReviewUnqualifiedMock.mockReset();
    navigateMock.mockReset();
    saveParkingLotArrivalReviewRecordMock.mockReset();

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec-lot-two-1',
        createdTime: '2026-05-09T00:00:00.000Z',
        fields: {
          SKU: '',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Arrival Date': '',
          'Qualification Notes': 'Carry forward note',
          'Submission Group ID': 'group-1',
        },
      },
      group: {
        id: 'group-1',
        label: 'group-1',
        description: 'Submission group',
        records: [
          { id: 'rec-lot-two-1', createdTime: '2026-05-09T00:00:00.000Z', fields: { SKU: '' } },
          { id: 'rec-lot-two-2', createdTime: '2026-05-09T00:00:00.000Z', fields: { SKU: 'SKU-2' } },
        ],
      },
    });

    saveParkingLotArrivalReviewRecordMock.mockImplementation(async (recordId: string, values: { arrivalDate: string; sku: string }) => ({
      id: recordId,
      createdTime: '2026-05-09T00:00:00.000Z',
      fields: {
        SKU: values.sku,
        Make: 'McIntosh',
        Model: 'C28',
        'Workflow Source': 'JotForm',
        'Workflow Status': 'Accepted - Awaiting Arrival',
        'Arrival Date': values.arrivalDate,
        'Qualification Notes': 'Carry forward note',
      },
    }));
  });

  it('opens the grouped review and intake actions from the Parking Lot arrival-stage review page', async () => {
    const onOpenManualIntake = vi.fn();

    render(
      <UsedGearParkingLotArrivalRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-lot-two-1"
        onOpenManualIntake={onOpenManualIntake}
      />,
    );

    expect(await screen.findByText('Update The Handoff Fields')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Parking Lot' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Parking Lot arrival-stage sections' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Route To Trash' })).toBeInTheDocument();
    expect(screen.queryByText('Current Context')).not.toBeInTheDocument();

    const snapshotHeading = screen.getByText('Intake Snapshot');
    const reviewHeading = screen.getByText('Parking Lot Review');
    expect(snapshotHeading.compareDocumentPosition(reviewHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open Group Review' }));
    expect(navigateMock).toHaveBeenCalledWith('/parking-lot/arrival/group/group-1?reviewMode=test');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Intake' }));
    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-lot-two-1');
  });

  it('saves the minimal Parking Lot review fields', async () => {
    render(
      <UsedGearParkingLotArrivalRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-lot-two-1"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByText('Update The Handoff Fields');
    fireEvent.change(screen.getByLabelText('Arrival Date'), { target: { value: '2026-05-12' } });
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-LOT2-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Review' }));

    await waitFor(() => {
      expect(saveParkingLotArrivalReviewRecordMock).toHaveBeenCalledWith('rec-lot-two-1', {
        arrivalDate: '2026-05-12',
        sku: 'SKU-LOT2-1',
      });
    });

    expect(await screen.findByText('Saved Parking Lot review fields.')).toBeInTheDocument();
  });

  it('routes the row into trash from the Parking Lot arrival-stage review page', async () => {
    markPendingReviewUnqualifiedMock.mockResolvedValue(undefined);

    render(
      <UsedGearParkingLotArrivalRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-lot-two-1"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByText('Route To Trash');
    fireEvent.change(screen.getByRole('textbox', { name: 'Unqualified Reason' }), {
      target: { value: 'Cabinet damage makes the item unsuitable for resale.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send To Trash' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send To Trash' }));

    await waitFor(() => {
      expect(markPendingReviewUnqualifiedMock).toHaveBeenCalledWith('rec-lot-two-1', 'Cabinet damage makes the item unsuitable for resale.');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/trash-review',
      search: '?reviewMode=test',
      hash: '#used-gear-trash',
    });
  });

  it('completes processing after the required handoff fields are present', async () => {
    completeProcessingStageMock.mockResolvedValue({
      id: 'rec-lot-two-1',
      createdTime: '2026-05-09T00:00:00.000Z',
      fields: {
        SKU: 'SKU-LOT2-1',
        'Workflow Status': 'Testing In Progress',
      },
    });

    render(
      <UsedGearParkingLotArrivalRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-lot-two-1"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByText('Update The Handoff Fields');
    fireEvent.change(screen.getByLabelText('Arrival Date'), { target: { value: '2026-05-12' } });
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-LOT2-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move to Testing' }));

    await waitFor(() => {
      expect(saveParkingLotArrivalReviewRecordMock).toHaveBeenCalledWith('rec-lot-two-1', {
        arrivalDate: '2026-05-12',
        sku: 'SKU-LOT2-1',
      });
      expect(completeProcessingStageMock).toHaveBeenCalledWith('rec-lot-two-1', 'Taylor Reviewer');
    });

    expect(navigateMock).toHaveBeenCalledWith('/testing/rec-lot-two-1');
  });
});