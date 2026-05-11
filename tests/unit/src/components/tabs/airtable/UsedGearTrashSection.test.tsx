import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearTrashSection } from '@/components/tabs/airtable/UsedGearTrashSection';

const {
  loadTrashQueueMock,
  clipboardWriteTextMock,
} = vi.hoisted(() => ({
  loadTrashQueueMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadTrashQueue: loadTrashQueueMock,
  };
});

describe('UsedGearTrashSection', () => {
  beforeEach(() => {
    loadTrashQueueMock.mockReset();
    clipboardWriteTextMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextMock,
      },
    });
    window.history.replaceState({}, '', '/trash-review');
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

    render(<UsedGearTrashSection onOpenReviewRecord={vi.fn()} onOpenWorkflowRecord={vi.fn()} />);

    await screen.findByText('Trash Review');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Trash Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/trash-review#used-gear-trash`);
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
        onOpenReviewRecord={vi.fn()}
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

  it('opens the dedicated trash review page from a compact queue card', async () => {
    const onOpenReviewRecord = vi.fn();

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

    render(<UsedGearTrashSection onOpenReviewRecord={onOpenReviewRecord} onOpenWorkflowRecord={vi.fn()} />);

    await screen.findByText('Trash Review');

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    expect(onOpenReviewRecord).toHaveBeenCalledWith('rec-trash');
  });
});