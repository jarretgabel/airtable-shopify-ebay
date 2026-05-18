import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearPendingReviewGroupPage } from '@/components/tabs/UsedGearPendingReviewGroupPage';

const {
  acceptPendingReviewGroupMock,
  distributeUsedGearPendingReviewTotalMock,
  loadPendingReviewGroupMock,
  savePendingReviewGroupReviewMock,
} = vi.hoisted(() => ({
  acceptPendingReviewGroupMock: vi.fn(),
  distributeUsedGearPendingReviewTotalMock: vi.fn(),
  loadPendingReviewGroupMock: vi.fn(),
  savePendingReviewGroupReviewMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  acceptPendingReviewGroup: acceptPendingReviewGroupMock,
  distributeUsedGearPendingReviewTotal: distributeUsedGearPendingReviewTotalMock,
  loadPendingReviewGroup: loadPendingReviewGroupMock,
  savePendingReviewGroupReview: savePendingReviewGroupReviewMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? 'N/A'),
}));

describe('UsedGearPendingReviewGroupPage', () => {
  beforeEach(() => {
    acceptPendingReviewGroupMock.mockReset();
    distributeUsedGearPendingReviewTotalMock.mockReset();
    loadPendingReviewGroupMock.mockReset();
    savePendingReviewGroupReviewMock.mockReset();

    distributeUsedGearPendingReviewTotalMock.mockReturnValue([150, 150]);
    loadPendingReviewGroupMock.mockResolvedValue({
      id: 'submission:group-42',
      key: 'submission:group-42',
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
  });

  it('renders grouped records through the shared matrix and keeps row actions wired', async () => {
    const onOpenManualIntake = vi.fn();
    const onOpenOperationalRecord = vi.fn();

    render(
      <UsedGearPendingReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="submission:group-42"
        onBackToParkingLot={vi.fn()}
        onOpenManualIntake={onOpenManualIntake}
        onOpenOperationalRecord={onOpenOperationalRecord}
      />,
    );

    expect((await screen.findAllByText('SUB-42')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('GRP-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GRP-2').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Route' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Offer' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Paid' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Notes' }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Intake' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Workflow Record' })[0]!);

    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-group-1');
    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-group-1');
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
        groupId="submission:group-42"
        onBackToParkingLot={vi.fn()}
        onOpenManualIntake={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    expect((await screen.findAllByText('SUB-42')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByRole('spinbutton', { name: 'Offer Amount' })[0]!, {
      target: { value: '150.00' },
    });
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Qualification Notes' })[0]!, {
      target: { value: 'Updated group note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Review Fields' }));

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
});
