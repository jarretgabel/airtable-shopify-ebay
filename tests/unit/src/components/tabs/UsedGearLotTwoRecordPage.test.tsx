import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { within } from '@testing-library/react';
import { UsedGearLotTwoRecordPage } from '@/components/tabs/UsedGearLotTwoRecordPage';

const {
  completeProcessingStageMock,
  loadUsedGearOperationalRecordContextMock,
  markPendingReviewUnqualifiedMock,
  navigateMock,
  saveLotTwoReviewRecordMock,
} = vi.hoisted(() => ({
  completeProcessingStageMock: vi.fn(),
  loadUsedGearOperationalRecordContextMock: vi.fn(),
  markPendingReviewUnqualifiedMock: vi.fn(),
  navigateMock: vi.fn(),
  saveLotTwoReviewRecordMock: vi.fn(),
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
  saveLotTwoReviewRecord: saveLotTwoReviewRecordMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? ''),
}));

describe('UsedGearLotTwoRecordPage', () => {
  beforeEach(() => {
    completeProcessingStageMock.mockReset();
    loadUsedGearOperationalRecordContextMock.mockReset();
    markPendingReviewUnqualifiedMock.mockReset();
    navigateMock.mockReset();
    saveLotTwoReviewRecordMock.mockReset();

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

    saveLotTwoReviewRecordMock.mockImplementation(async (recordId: string, values: { arrivalDate: string; sku: string }) => ({
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

  it('opens the grouped review and intake actions from the Lot 2 review page', async () => {
    const onOpenManualIntake = vi.fn();

    render(
      <UsedGearLotTwoRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-lot-two-1"
        onOpenManualIntake={onOpenManualIntake}
      />,
    );

    expect(await screen.findByText('Update The Handoff Fields')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Parking Lot 2' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Parking Lot 2 sections' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Route To Trash' })).toBeInTheDocument();
    expect(screen.queryByText('Current Context')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Group Review' }));
    expect(navigateMock).toHaveBeenCalledWith('/parking-lot-2/group/group-1?reviewMode=test');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Intake' }));
    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-lot-two-1');
  });

  it('saves the minimal Lot 2 review fields', async () => {
    render(
      <UsedGearLotTwoRecordPage
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
      expect(saveLotTwoReviewRecordMock).toHaveBeenCalledWith('rec-lot-two-1', {
        arrivalDate: '2026-05-12',
        sku: 'SKU-LOT2-1',
      });
    });

    expect(await screen.findByText('Saved Parking Lot 2 review fields.')).toBeInTheDocument();
  });

  it('routes the row into trash from the Lot 2 review page', async () => {
    markPendingReviewUnqualifiedMock.mockResolvedValue(undefined);

    render(
      <UsedGearLotTwoRecordPage
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
        'Workflow Status': 'Testing and Photography In Progress',
      },
    });

    render(
      <UsedGearLotTwoRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec-lot-two-1"
        onOpenManualIntake={vi.fn()}
      />,
    );

    await screen.findByText('Update The Handoff Fields');
    fireEvent.change(screen.getByLabelText('Arrival Date'), { target: { value: '2026-05-12' } });
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-LOT2-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete Processing' }));

    await waitFor(() => {
      expect(saveLotTwoReviewRecordMock).toHaveBeenCalledWith('rec-lot-two-1', {
        arrivalDate: '2026-05-12',
        sku: 'SKU-LOT2-1',
      });
      expect(completeProcessingStageMock).toHaveBeenCalledWith('rec-lot-two-1', 'Taylor Reviewer');
    });

    expect(navigateMock).toHaveBeenCalledWith('/testing/rec-lot-two-1');
  });
});