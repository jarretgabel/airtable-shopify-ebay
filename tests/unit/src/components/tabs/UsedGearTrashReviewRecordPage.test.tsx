import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearTrashReviewRecordPage } from '@/components/tabs/UsedGearTrashReviewRecordPage';

const {
  hasUsedGearPendingReviewPricingPathMock,
  loadUsedGearOperationalRecordContextMock,
  navigateMock,
  permanentlyDeleteTrashRecordMock,
  requalifyTrashRecordMock,
  restoreTrashRecordMock,
} = vi.hoisted(() => ({
  hasUsedGearPendingReviewPricingPathMock: vi.fn(),
  loadUsedGearOperationalRecordContextMock: vi.fn(),
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
  loadUsedGearOperationalRecordContext: loadUsedGearOperationalRecordContextMock,
  permanentlyDeleteTrashRecord: permanentlyDeleteTrashRecordMock,
  requalifyTrashRecord: requalifyTrashRecordMock,
  restoreTrashRecord: restoreTrashRecordMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? 'N/A'),
}));

describe('UsedGearTrashReviewRecordPage', () => {
  beforeEach(() => {
    hasUsedGearPendingReviewPricingPathMock.mockReset();
    loadUsedGearOperationalRecordContextMock.mockReset();
    navigateMock.mockReset();
    permanentlyDeleteTrashRecordMock.mockReset();
    requalifyTrashRecordMock.mockReset();
    restoreTrashRecordMock.mockReset();

    hasUsedGearPendingReviewPricingPathMock.mockReturnValue(true);
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec-trash-1',
        createdTime: '2026-05-09T00:00:00.000Z',
        fields: {
          SKU: 'SKU-TRASH-1',
          Make: 'Pioneer',
          Model: 'SX-780',
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
          'Qualification Notes': 'Rejected during intake review.',
          'Offer Amount': 150,
          'Confirmed Grand Total': 150,
        },
      },
      group: null,
    });
  });

  it('restores a trashed row back to parking lot 1', async () => {
    restoreTrashRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearTrashReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-trash-1"
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    await screen.findByText('Restore To Parking Lot 1');
    fireEvent.click(screen.getByRole('button', { name: 'Restore To Lot 1' }));

    await waitFor(() => {
      expect(restoreTrashRecordMock).toHaveBeenCalledWith('rec-trash-1');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/parking-lot-1',
      search: '?reviewMode=test',
      hash: '#used-gear-pending-review',
    });
  });

  it('re-qualifies a trashed row into lot 2', async () => {
    requalifyTrashRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearTrashReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-trash-1"
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Re-qualify Into Lot 2' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Lot 2 Route' }), {
      target: { value: 'Accepted - Arrived, Awaiting Missing Item' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Qualification Notes' }), {
      target: { value: 'Recovered after visual inspection.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Re-qualify Into Lot 2' }));

    await waitFor(() => {
      expect(requalifyTrashRecordMock).toHaveBeenCalledWith('rec-trash-1', 'Taylor Reviewer', {
        acceptedStatus: 'Accepted - Arrived, Awaiting Missing Item',
        qualificationNotes: 'Recovered after visual inspection.',
      });
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/parking-lot-2',
      search: '?reviewMode=test',
    });
  });

  it('permanently deletes the row from the isolated trash page', async () => {
    permanentlyDeleteTrashRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearTrashReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-trash-1"
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    await screen.findByText('Delete From Workflow');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));

    await waitFor(() => {
      expect(permanentlyDeleteTrashRecordMock).toHaveBeenCalledWith('rec-trash-1');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/trash-review',
      search: '?reviewMode=test',
      hash: '#used-gear-trash',
    });
  });
});