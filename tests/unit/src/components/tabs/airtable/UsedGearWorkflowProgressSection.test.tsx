import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowProgressSection } from '@/components/tabs/airtable/UsedGearWorkflowProgressSection';

async function openWorkflowProgressTools() {
  const toggle = screen.queryByRole('button', { name: 'Show Filters And Tools' });
  if (toggle) {
    fireEvent.click(toggle);
  }
}

const { loadWorkflowProgressQueueMock, clipboardWriteTextMock } = vi.hoisted(() => ({
  loadWorkflowProgressQueueMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadWorkflowProgressQueue: loadWorkflowProgressQueueMock,
    completeProcessingStage: vi.fn(),
    completeTestingStage: vi.fn(),
    completePhotographyStage: vi.fn(),
  };
});

describe('UsedGearWorkflowProgressSection', () => {
  beforeEach(() => {
    clipboardWriteTextMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextMock,
      },
    });
    window.history.replaceState({}, '', '/inventory');
  });

  it('copies the processing and stage queue link for sharing', async () => {
    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-1',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Processing And Stage Queue');

    await act(async () => {
      await openWorkflowProgressTools();
      fireEvent.click(await screen.findByRole('button', { name: 'Copy Queue Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/inventory#used-gear-progress-queue`);
    });
  });

  it('copies a group-focused progress link', async () => {
    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-1',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Submission Group ID': 'submission-a',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Processing And Stage Queue');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Group Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/inventory?workflowProgressGroup=submission%3Asubmission-a#used-gear-progress-queue`);
    });
  });

  it('opens stage review from the compact progress card', async () => {
    const onOpenWorkflowRecord = vi.fn();

    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-1',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Submission Group ID': 'submission-a',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Processing And Stage Queue');

    fireEvent.click(screen.getByRole('button', { name: 'Open Stage Review' }));

    expect(onOpenWorkflowRecord).toHaveBeenCalledWith('rec-progress-a');
  });

  it('ignores the legacy owner filter prop and keeps the full progress queue visible', async () => {
    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-1',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Testing and Photography In Progress',
          'Workflow Owner': 'Taylor Reviewer',
        },
      },
      {
        id: 'rec-progress-b',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-2',
          Make: 'McIntosh',
          Model: 'MC275',
          'Workflow Status': 'Testing and Photography In Progress',
        },
      },
      {
        id: 'rec-progress-c',
        createdTime: '2026-05-05T00:00:00.000Z',
        fields: {
          SKU: 'PROG-3',
          Make: 'Pioneer',
          Model: 'SX-1250',
          'Workflow Status': 'Testing and Photography In Progress',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Processing And Stage Queue')).toBeInTheDocument();
    expect(screen.getAllByText('PROG-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROG-2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROG-3').length).toBeGreaterThan(0);
  });

  it('routes the last-touched action to listings approval for pre-listing handoff', async () => {
    const onOpenListingsRecord = vi.fn();

    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-1',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Awaiting Pre-Listing Review',
          'Awaiting Pre-Listing Review At': '2026-05-08T04:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenListingsRecord={onOpenListingsRecord}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /last touched: moved to pre-listing review/i }));

    expect(onOpenListingsRecord).toHaveBeenCalledWith('rec-progress-a');
  });
});