import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('restores a trashed row back to parking lot', async () => {
    restoreTrashRecordMock.mockResolvedValue(undefined);
    const onOpenManualIntake = vi.fn();

    render(
      <UsedGearTrashReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-trash-1"
        onOpenManualIntake={onOpenManualIntake}
      />,
    );

    await screen.findByRole('heading', { name: 'Restore To Parking Lot' });
    expect(screen.getByRole('button', { name: 'Back to Trash' })).toBeInTheDocument();
  const deleteHeading = screen.getByRole('heading', { name: 'Delete From Workflow' });
  const snapshotHeading = screen.getByText('Intake Snapshot');
    expect(snapshotHeading.compareDocumentPosition(deleteHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Trash Reason')).toBeNull();
    expect(screen.queryByText('Intake Notes')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Intake' }));
    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-trash-1');
    fireEvent.click(screen.getByRole('button', { name: 'Restore To Parking Lot' }));

    await waitFor(() => {
      expect(restoreTrashRecordMock).toHaveBeenCalledWith('rec-trash-1');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/parking-lot',
      search: '?reviewMode=test',
      hash: '#used-gear-parking-lot',
    });
  });

  it('re-qualifies a trashed row into the parking lot arrival-stage workflow', async () => {
    requalifyTrashRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearTrashReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-trash-1"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Re-qualify Into Parking Lot' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Parking Lot Status' }), {
      target: { value: 'Accepted - Arrived, Awaiting Missing Item' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Qualification Notes' }), {
      target: { value: 'Recovered after visual inspection.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Re-qualify Into Parking Lot' }));

    await waitFor(() => {
      expect(requalifyTrashRecordMock).toHaveBeenCalledWith('rec-trash-1', 'Taylor Reviewer', {
        acceptedStatus: 'Accepted - Arrived, Awaiting Missing Item',
        qualificationNotes: 'Recovered after visual inspection.',
      });
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/parking-lot',
      search: '?reviewMode=test',
      hash: '#used-gear-parking-lot',
    });
  });

  it('permanently deletes the row from the isolated trash page', async () => {
    permanentlyDeleteTrashRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearTrashReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-trash-1"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByText('Delete From Workflow');
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete Permanently' })[0]!);

  const dialog = await screen.findByRole('dialog');
  expect(screen.getByText('Delete trash record?')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Permanently' }));

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