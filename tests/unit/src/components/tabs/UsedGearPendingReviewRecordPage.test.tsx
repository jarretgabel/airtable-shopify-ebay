import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearPendingReviewRecordPage } from '@/components/tabs/UsedGearPendingReviewRecordPage';

const {
  acceptPendingReviewRecordMock,
  hasUsedGearPendingReviewPricingPathMock,
  loadUsedGearOperationalRecordContextMock,
  markPendingReviewUnqualifiedMock,
  navigateMock,
} = vi.hoisted(() => ({
  acceptPendingReviewRecordMock: vi.fn(),
  hasUsedGearPendingReviewPricingPathMock: vi.fn(),
  loadUsedGearOperationalRecordContextMock: vi.fn(),
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
  loadUsedGearOperationalRecordContext: loadUsedGearOperationalRecordContextMock,
  markPendingReviewUnqualified: markPendingReviewUnqualifiedMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? 'N/A'),
}));

describe('UsedGearPendingReviewRecordPage', () => {
  beforeEach(() => {
    acceptPendingReviewRecordMock.mockReset();
    hasUsedGearPendingReviewPricingPathMock.mockReset();
    loadUsedGearOperationalRecordContextMock.mockReset();
    markPendingReviewUnqualifiedMock.mockReset();
    navigateMock.mockReset();

    hasUsedGearPendingReviewPricingPathMock.mockReturnValue(true);
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
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

  it('opens linked group and operational actions from the isolated review page', async () => {
    const onOpenIncomingGearForm = vi.fn();
    const onOpenOperationalRecord = vi.fn();

    render(
      <UsedGearPendingReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-pending-1"
        onOpenIncomingGearForm={onOpenIncomingGearForm}
        onOpenOperationalRecord={onOpenOperationalRecord}
      />,
    );

    expect(await screen.findByText('Qualify Into Lot 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Group Review' }));
    expect(navigateMock).toHaveBeenCalledWith('/parking-lot-1/review/submission%3Agroup-1?reviewMode=test');

    fireEvent.click(screen.getByRole('button', { name: 'Show More Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Incoming Gear' }));
    expect(onOpenIncomingGearForm).toHaveBeenCalledWith('rec-pending-1');

    fireEvent.click(screen.getByRole('button', { name: 'Open Operational Record' }));
    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-pending-1');
  });

  it('accepts the row into lot 2 and returns to the queue', async () => {
    acceptPendingReviewRecordMock.mockResolvedValue(undefined);

    render(
      <UsedGearPendingReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-pending-1"
        onOpenIncomingGearForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
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
        onOpenOperationalRecord={vi.fn()}
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

  it('applies shared note templates for qualification and unqualify actions', async () => {
    render(
      <UsedGearPendingReviewRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-pending-1"
        onOpenIncomingGearForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Qualify Into Lot 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sellable Clean Pass' }));
    expect(screen.getByRole('textbox', { name: 'Qualification Notes' })).toHaveValue(
      'Carry forward note\nSellable intake confirmed. Core unit is present, pricing path is documented, and the row should continue through Lot 2.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Repair Not Economical' }));
    expect(screen.getByRole('textbox', { name: 'Unqualified Reason' })).toHaveValue(
      'Rejected at intake because the reported functional issues or required repair effort exceed the expected resale value.',
    );
  });
});