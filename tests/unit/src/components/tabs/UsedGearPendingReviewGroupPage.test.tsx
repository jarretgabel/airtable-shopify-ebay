import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearPendingReviewGroupPage } from '@/components/tabs/UsedGearPendingReviewGroupPage';

const {
  acceptPendingReviewGroupMock,
  loadParkingLotArrivalGroupMock,
  loadPendingReviewGroupMock,
  markPendingReviewGroupUnqualifiedMock,
  navigateMock,
  savePendingReviewGroupReviewMock,
} = vi.hoisted(() => ({
  acceptPendingReviewGroupMock: vi.fn(),
  loadParkingLotArrivalGroupMock: vi.fn(),
  loadPendingReviewGroupMock: vi.fn(),
  markPendingReviewGroupUnqualifiedMock: vi.fn(),
  navigateMock: vi.fn(),
  savePendingReviewGroupReviewMock: vi.fn(),
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
  acceptPendingReviewGroup: acceptPendingReviewGroupMock,
  loadParkingLotArrivalGroup: loadParkingLotArrivalGroupMock,
  loadPendingReviewGroup: loadPendingReviewGroupMock,
  markPendingReviewGroupUnqualified: markPendingReviewGroupUnqualifiedMock,
  savePendingReviewGroupReview: savePendingReviewGroupReviewMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? 'N/A'),
}));

describe('UsedGearPendingReviewGroupPage', () => {
  beforeEach(() => {
    acceptPendingReviewGroupMock.mockReset();
    loadParkingLotArrivalGroupMock.mockReset();
    loadPendingReviewGroupMock.mockReset();
    markPendingReviewGroupUnqualifiedMock.mockReset();
    navigateMock.mockReset();
    savePendingReviewGroupReviewMock.mockReset();

    loadPendingReviewGroupMock.mockResolvedValue({
      id: 'group-42',
      key: 'group-42',
      label: 'SUB-42',
      description: 'Submission group',
      records: [
        {
          id: 'rec-group-1',
          createdTime: '2026-05-07T00:00:00.000Z',
          fields: {
            'Arrival Date': '2026-05-06',
            SKU: 'GRP-1',
            Make: 'McIntosh',
            Model: 'C28',
            'Workflow Source': 'JotForm',
            'Workflow Status': 'Accepted - Awaiting Arrival',
            'Submission Group ID': 'SUB-42',
            'Confirmed Grand Total': 300,
            'Allocation Mode': 'Equal Split',
            'Allocation Notes': 'Split evenly',
            'Qualification Notes': 'Carry forward note one',
            'Offer Amount': 100,
            'Paid Amount': 90,
            'Customer Cosmetic Notes': 'Small nick on rear edge',
            'Customer Functional Notes': 'Powers on',
            'Customer Inclusion Notes': 'Includes cage',
            'Inventory Notes': 'Check knobs',
          },
        },
        {
          id: 'rec-group-2',
          createdTime: '2026-05-08T00:00:00.000Z',
          fields: {
            'Arrival Date': '2026-05-07',
            SKU: 'GRP-2',
            Make: 'Marantz',
            Model: '8B',
            'Workflow Source': 'Manual Entry',
            'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
            'Submission Group ID': 'SUB-42',
            'Confirmed Grand Total': 300,
            'Allocation Mode': 'Equal Split',
            'Allocation Notes': 'Split evenly',
            'Qualification Notes': 'Carry forward note two',
            'Offer Amount': 200,
            'Paid Amount': 180,
            'Customer Cosmetic Notes': 'Light faceplate wear',
            'Customer Functional Notes': 'Intermittent channel',
            'Customer Inclusion Notes': 'No tubes',
            'Inventory Notes': 'Bench test first',
          },
        },
      ],
    });
    loadParkingLotArrivalGroupMock.mockResolvedValue({
      id: 'group-42',
      key: 'group-42',
      label: 'SUB-42',
      description: 'Submission group',
      records: [],
    });
  });

  it('redirects stale pending-review group routes to the arrival-stage parking lot group page', async () => {
    loadPendingReviewGroupMock.mockRejectedValueOnce(new Error('Unable to load the selected pending-review group.'));

    render(
      <UsedGearPendingReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="group-42"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={vi.fn()}
        onOpenManualIntake={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        pathname: '/parking-lot/arrival/group/group-42',
        search: '?reviewMode=test',
      }, { replace: true });
    });
  });

  it('renders grouped records through the shared matrix and keeps row actions wired', async () => {
    const onOpenManualIntake = vi.fn();

    render(
      <UsedGearPendingReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="group-42"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={vi.fn()}
        onOpenManualIntake={onOpenManualIntake}
      />,
    );

    expect((await screen.findAllByText('SUB-42')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Back to Parking Lot' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Parking Lot group sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grouped Items' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grouped Items' })).toBeInTheDocument();
    expect(screen.getAllByText('GRP-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GRP-2').length).toBeGreaterThan(0);
    expect(screen.queryByText('JotForm')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual Entry')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Parking Lot Status').length).toBe(2);
    expect(screen.getAllByLabelText('Offer Amount').length).toBe(2);
    expect(screen.getAllByLabelText('Paid Amount').length).toBe(2);
    expect(screen.getAllByLabelText('Qualification Notes').length).toBe(2);
    expect(screen.getAllByText('Quick templates').length).toBe(2);
    expect(screen.getAllByRole('button', { name: 'Sellable Clean Pass' }).length).toBe(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Intake' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Grouped Intake Ready' })[0]!);

    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-group-1');
    expect(screen.getAllByRole('textbox', { name: 'Qualification Notes' })[0]).toHaveValue(
      'Carry forward note one\nGrouped intake review completed. Pricing and routing are aligned with the related submission rows, so this item can stay in the sellable workflow.',
    );
  });

  it('saves edited grouped review fields from the shared matrix controls', async () => {
    savePendingReviewGroupReviewMock.mockResolvedValue([
      {
        id: 'rec-group-1',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'GRP-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Qualification Notes': 'Updated group note',
          'Offer Amount': 150,
          'Paid Amount': 90,
        },
      },
      {
        id: 'rec-group-2',
        createdTime: '2026-05-08T00:00:00.000Z',
        fields: {
          SKU: 'GRP-2',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
          'Qualification Notes': 'Carry forward note two',
          'Offer Amount': 200,
          'Paid Amount': 180,
        },
      },
    ]);

    render(
      <UsedGearPendingReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="group-42"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={vi.fn()}
        onOpenManualIntake={vi.fn()}
      />,
    );

    expect((await screen.findAllByText('SUB-42')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByRole('spinbutton', { name: 'Offer Amount' })[0]!, {
      target: { value: '150.00' },
    });
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Qualification Notes' })[0]!, {
      target: { value: 'Updated group note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Review' }));

    await waitFor(() => {
      expect(savePendingReviewGroupReviewMock).toHaveBeenCalledWith({
        submissionGroupId: 'SUB-42',
        confirmedGrandTotal: 300,
        allocationMode: 'Equal Split',
        allocationNotes: 'Split evenly',
        records: [
          {
            recordId: 'rec-group-1',
            acceptedStatus: 'Accepted - Awaiting Arrival',
            qualificationNotes: 'Updated group note',
            offerAmount: 150,
            paidAmount: 90,
          },
          {
            recordId: 'rec-group-2',
            acceptedStatus: 'Accepted - Arrived, Awaiting SKU',
            qualificationNotes: 'Carry forward note two',
            offerAmount: 200,
            paidAmount: 180,
          },
        ],
      });
    });
  });

  it('uses arrival-stage wording for the grouped acceptance action', async () => {
    render(
      <UsedGearPendingReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="group-42"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={vi.fn()}
        onOpenManualIntake={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Accept Group With Selected Statuses' })).toBeInTheDocument();
  });

  it('routes the full grouped intake into trash review', async () => {
    const onOpenTrashReview = vi.fn();
    markPendingReviewGroupUnqualifiedMock.mockResolvedValue([]);

    render(
      <UsedGearPendingReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="group-42"
        onBackToParkingLot={vi.fn()}
        onOpenTrashReview={onOpenTrashReview}
        onOpenManualIntake={vi.fn()}
      />,
    );

    expect((await screen.findAllByText('SUB-42')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole('textbox', { name: 'Unqualified Reason' }), {
      target: { value: 'The full submission should be rejected due to condition and repair exposure.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send To Trash' }));
    fireEvent.click((await screen.findByRole('dialog')).querySelector('button[aria-label="Send To Trash"]') ?? screen.getAllByRole('button', { name: 'Send To Trash' })[1]!);

    await waitFor(() => {
      expect(markPendingReviewGroupUnqualifiedMock).toHaveBeenCalledWith(
        ['rec-group-1', 'rec-group-2'],
        'The full submission should be rejected due to condition and repair exposure.',
      );
    });

    expect(onOpenTrashReview).toHaveBeenCalledTimes(1);
  });
});
