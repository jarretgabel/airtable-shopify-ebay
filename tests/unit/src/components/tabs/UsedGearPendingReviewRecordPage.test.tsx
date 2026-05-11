import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearPendingReviewRecordPage } from '@/components/tabs/UsedGearPendingReviewRecordPage';

const {
  acceptPendingReviewRecordMock,
  hasUsedGearPendingReviewPricingPathMock,
  loadUsedGearWorkflowRecordContextMock,
  markPendingReviewUnqualifiedMock,
  navigateMock,
} = vi.hoisted(() => ({
  acceptPendingReviewRecordMock: vi.fn(),
  hasUsedGearPendingReviewPricingPathMock: vi.fn(),
  loadUsedGearWorkflowRecordContextMock: vi.fn(),
  markPendingReviewUnqualifiedMock: vi.fn(),
  navigateMock: vi.fn(),
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
  acceptPendingReviewRecord: acceptPendingReviewRecordMock,
  hasUsedGearPendingReviewPricingPath: hasUsedGearPendingReviewPricingPathMock,
  loadUsedGearWorkflowRecordContext: loadUsedGearWorkflowRecordContextMock,
  markPendingReviewUnqualified: markPendingReviewUnqualifiedMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? 'N/A'),
}));

describe('UsedGearPendingReviewRecordPage', () => {
  beforeEach(() => {
    acceptPendingReviewRecordMock.mockReset();
    hasUsedGearPendingReviewPricingPathMock.mockReset();
    loadUsedGearWorkflowRecordContextMock.mockReset();
    markPendingReviewUnqualifiedMock.mockReset();
    navigateMock.mockReset();

    hasUsedGearPendingReviewPricingPathMock.mockReturnValue(true);
    loadUsedGearWorkflowRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec-pending-1',
        createdTime: '2026-05-09T00:00:00.000Z',
        fields: {
          SKU: 'SKU-PENDING-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Pending Review',
          'Qualification Notes': 'Carry forward note',
          'Submission Group ID': 'group-1',
          'Offer Amount': 100,
          'Confirmed Grand Total': 100,
        },
      },
      group: {
        id: 'submission:group-1',
        label: 'group-1',
        description: 'Submission group',
        records: [
          {
            id: 'rec-pending-1',
            createdTime: '2026-05-09T00:00:00.000Z',
            fields: { SKU: 'SKU-PENDING-1' },
          },
          {
            id: 'rec-pending-2',
            createdTime: '2026-05-09T00:00:00.000Z',
            fields: { SKU: 'SKU-PENDING-2' },
          },
        ],
      },
    });
  });

  it('opens linked group and workflow actions from the isolated review page', async () => {
    const onOpenIncomingGearForm = vi.fn();
    const onOpenWorkflowRecord = vi.fn();

    render(
      <UsedGearPendingReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-pending-1"
        onOpenIncomingGearForm={onOpenIncomingGearForm}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
      />,
    );

    expect(await screen.findByText('Qualify Into Lot 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Group Review' }));
    expect(navigateMock).toHaveBeenCalledWith('/parking-lot-1/review/submission%3Agroup-1?reviewMode=test');

    fireEvent.click(screen.getByRole('button', { name: 'Open Incoming Gear' }));
    expect(onOpenIncomingGearForm).toHaveBeenCalledWith('rec-pending-1');

    fireEvent.click(screen.getByRole('button', { name: 'Open Workflow Record' }));
    expect(onOpenWorkflowRecord).toHaveBeenCalledWith('rec-pending-1');
  });

  it('accepts the row into lot 2 and returns to the queue', async () => {
    acceptPendingReviewRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearPendingReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-pending-1"
        onOpenIncomingGearForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    await screen.findByText('Qualify Into Lot 2');
    fireEvent.click(screen.getByRole('button', { name: 'Accept Into Lot 2' }));

    await waitFor(() => {
      expect(acceptPendingReviewRecordMock).toHaveBeenCalledWith('rec-pending-1', 'Taylor Reviewer', {
        acceptedStatus: 'Accepted - Awaiting Arrival',
        qualificationNotes: 'Carry forward note',
      });
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/parking-lot-1',
      search: '?reviewMode=test',
      hash: '#used-gear-pending-review',
    });
  });

  it('routes the row into trash from the isolated review page', async () => {
    markPendingReviewUnqualifiedMock.mockResolvedValue(undefined);

    render(
      <UsedGearPendingReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-pending-1"
        onOpenIncomingGearForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
      />,
    );

    await screen.findByText('Route To Trash');
    fireEvent.change(screen.getByRole('textbox', { name: 'Unqualified Reason' }), {
      target: { value: 'Speaker damage under grille.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send To Trash' }));

    await waitFor(() => {
      expect(markPendingReviewUnqualifiedMock).toHaveBeenCalledWith('rec-pending-1', 'Speaker damage under grille.');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/trash-review',
      search: '?reviewMode=test',
      hash: '#used-gear-trash',
    });
  });
});