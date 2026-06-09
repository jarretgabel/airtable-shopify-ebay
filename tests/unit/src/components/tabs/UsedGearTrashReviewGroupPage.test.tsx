import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearTrashReviewGroupPage } from '@/components/tabs/UsedGearTrashReviewGroupPage';

const {
  hasUsedGearPendingReviewPricingPathMock,
  loadTrashGroupMock,
  navigateMock,
  permanentlyDeleteTrashRecordMock,
  requalifyTrashRecordMock,
  restoreTrashRecordMock,
} = vi.hoisted(() => ({
  hasUsedGearPendingReviewPricingPathMock: vi.fn(),
  loadTrashGroupMock: vi.fn(),
  navigateMock: vi.fn(),
  permanentlyDeleteTrashRecordMock: vi.fn(),
  requalifyTrashRecordMock: vi.fn(),
  restoreTrashRecordMock: vi.fn(),
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
  hasUsedGearPendingReviewPricingPath: hasUsedGearPendingReviewPricingPathMock,
  loadTrashGroup: loadTrashGroupMock,
  permanentlyDeleteTrashRecord: permanentlyDeleteTrashRecordMock,
  requalifyTrashRecord: requalifyTrashRecordMock,
  restoreTrashRecord: restoreTrashRecordMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? 'N/A'),
}));

describe('UsedGearTrashReviewGroupPage', () => {
  beforeEach(() => {
    hasUsedGearPendingReviewPricingPathMock.mockReset();
    loadTrashGroupMock.mockReset();
    navigateMock.mockReset();
    permanentlyDeleteTrashRecordMock.mockReset();
    requalifyTrashRecordMock.mockReset();
    restoreTrashRecordMock.mockReset();

    hasUsedGearPendingReviewPricingPathMock.mockReturnValue(true);
    loadTrashGroupMock.mockResolvedValue({
      id: 'trash-set-a',
      key: 'trash-set-a',
      label: 'trash-set-a',
      description: 'Pickup group',
      records: [
        {
          id: 'rec-trash-1',
          createdTime: '2026-05-09T00:00:00.000Z',
          fields: {
            SKU: 'SKU-TRASH-1',
            Make: 'Pioneer',
            Model: 'SX-780',
            'Workflow Status': 'Unqualified',
            'Trash Status': 'Active Trash',
            'Qualification Notes': 'Recovered after visual inspection.',
            'Unqualified Reason': 'Cabinet damage beyond resale standards.',
            'Offer Amount': 150,
            'Confirmed Grand Total': 150,
          },
        },
        {
          id: 'rec-trash-2',
          createdTime: '2026-05-10T00:00:00.000Z',
          fields: {
            SKU: 'SKU-TRASH-2',
            Make: 'Pioneer',
            Model: 'CT-F9191',
            'Workflow Status': 'Unqualified',
            'Trash Status': 'Active Trash',
            'Qualification Notes': 'Recovered after visual inspection.',
            'Unqualified Reason': 'Matching set item also failed intake inspection.',
            'Offer Amount': 95,
            'Confirmed Grand Total': 95,
          },
        },
      ],
    });
  });

  it('restores every row in the grouped trash review page back to parking lot', async () => {
    restoreTrashRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearTrashReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="trash-set-a"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Restore To Parking Lot' });
    fireEvent.click(screen.getByRole('button', { name: 'Restore To Parking Lot' }));

    await waitFor(() => {
      expect(restoreTrashRecordMock).toHaveBeenCalledWith('rec-trash-1');
      expect(restoreTrashRecordMock).toHaveBeenCalledWith('rec-trash-2');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/parking-lot',
      search: '?reviewMode=test',
      hash: '#used-gear-parking-lot',
    });
  });

  it('re-qualifies every row in the grouped trash review page into parking lot arrival-stage work', async () => {
    requalifyTrashRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearTrashReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="trash-set-a"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Re-qualify Into Parking Lot' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Parking Lot Status' }), {
      target: { value: 'Accepted - Arrived, Awaiting Missing Item' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Qualification Notes' }), {
      target: { value: 'Recovered after shared bench inspection.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Re-qualify Into Parking Lot' }));

    await waitFor(() => {
      expect(requalifyTrashRecordMock).toHaveBeenCalledWith('rec-trash-1', 'Taylor Reviewer', {
        acceptedStatus: 'Accepted - Arrived, Awaiting Missing Item',
        qualificationNotes: 'Recovered after shared bench inspection.',
      });
      expect(requalifyTrashRecordMock).toHaveBeenCalledWith('rec-trash-2', 'Taylor Reviewer', {
        acceptedStatus: 'Accepted - Arrived, Awaiting Missing Item',
        qualificationNotes: 'Recovered after shared bench inspection.',
      });
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/parking-lot',
      search: '?reviewMode=test',
      hash: '#used-gear-parking-lot',
    });
  });

  it('deletes every row from the grouped trash review page', async () => {
    permanentlyDeleteTrashRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearTrashReviewGroupPage
        currentUserName="Taylor Reviewer"
        groupId="trash-set-a"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByText('Delete From Workflow');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Group Permanently' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Permanently' }));

    await waitFor(() => {
      expect(permanentlyDeleteTrashRecordMock).toHaveBeenCalledWith('rec-trash-1');
      expect(permanentlyDeleteTrashRecordMock).toHaveBeenCalledWith('rec-trash-2');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/trash-review',
      search: '?reviewMode=test',
      hash: '#used-gear-trash',
    });
  });
});