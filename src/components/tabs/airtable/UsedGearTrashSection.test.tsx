import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearTrashSection } from '@/components/tabs/airtable/UsedGearTrashSection';

const {
  loadTrashQueueMock,
  restoreTrashRecordMock,
  requalifyTrashRecordMock,
  permanentlyDeleteTrashRecordMock,
  clipboardWriteTextMock,
} = vi.hoisted(() => ({
  loadTrashQueueMock: vi.fn(),
  restoreTrashRecordMock: vi.fn(),
  requalifyTrashRecordMock: vi.fn(),
  permanentlyDeleteTrashRecordMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadTrashQueue: loadTrashQueueMock,
    restoreTrashRecord: restoreTrashRecordMock,
    requalifyTrashRecord: requalifyTrashRecordMock,
    permanentlyDeleteTrashRecord: permanentlyDeleteTrashRecordMock,
  };
});

describe('UsedGearTrashSection', () => {
  beforeEach(() => {
    loadTrashQueueMock.mockReset();
    restoreTrashRecordMock.mockReset();
    requalifyTrashRecordMock.mockReset();
    permanentlyDeleteTrashRecordMock.mockReset();
    clipboardWriteTextMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextMock,
      },
    });
    window.history.replaceState({}, '', '/jotform');
  });

  it('copies the trash queue link for sharing', async () => {
    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-1',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
        },
      },
    ]);

    render(<UsedGearTrashSection currentUserName="Casey" onOpenWorkflowRecord={vi.fn()} />);

    await screen.findByText('Trash Review');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Trash Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/jotform#used-gear-trash`);
    });
  });

  it('supports externally-controlled search state for shareable trash urls', async () => {
    const onSearchTermChange = vi.fn();

    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-1',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
        },
      },
    ]);

    render(
      <UsedGearTrashSection
        currentUserName="Casey"
        onOpenWorkflowRecord={vi.fn()}
        searchTerm="pioneer"
        onSearchTermChange={onSearchTermChange}
      />,
    );

    const input = await screen.findByRole('textbox', { name: 'Search workflow trash' });
    expect(input).toHaveValue('pioneer');

    fireEvent.change(input, { target: { value: 'luxman' } });

    expect(onSearchTermChange).toHaveBeenCalledWith('luxman');
  });

  it('re-qualifies a trash row into lot two and removes it from the list', async () => {
    requalifyTrashRecordMock.mockResolvedValue(undefined);
    loadTrashQueueMock.mockResolvedValue([
      {
        id: 'rec-trash',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'TRASH-1',
          Make: 'Pioneer',
          Model: 'SX-750',
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
          'Offer Amount': 100,
          'Qualification Notes': 'Customer clarified the power issue.',
        },
      },
    ]);

    render(<UsedGearTrashSection currentUserName="Casey" onOpenWorkflowRecord={vi.fn()} />);

    await screen.findByText('Trash Review');

    fireEvent.change(screen.getByRole('textbox', { name: 'Re-qualify Notes' }), {
      target: { value: 'Bench triage approved this return to workflow.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Re-qualify Into Lot 2' }));

    await waitFor(() => {
      expect(requalifyTrashRecordMock).toHaveBeenCalledWith('rec-trash', 'Casey', {
        acceptedStatus: 'Accepted - Awaiting Arrival',
        qualificationNotes: 'Bench triage approved this return to workflow.',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('TRASH-1')).not.toBeInTheDocument();
    });
  });
});