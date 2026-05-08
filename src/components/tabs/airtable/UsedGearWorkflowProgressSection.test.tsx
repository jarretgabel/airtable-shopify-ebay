import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowProgressSection } from '@/components/tabs/airtable/UsedGearWorkflowProgressSection';

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
      fireEvent.click(screen.getByRole('button', { name: 'Copy Queue Link' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/inventory#used-gear-progress-queue`);
    });
  });

  it('emits collapse-all group ids for the visible progress groups', async () => {
    const onCollapsedGroupIdsChange = vi.fn();

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
      {
        id: 'rec-progress-b',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-2',
          Make: 'McIntosh',
          Model: 'MC275',
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Submission Group ID': 'submission-b',
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
        collapsedGroupIds={[]}
        onCollapsedGroupIdsChange={onCollapsedGroupIdsChange}
      />,
    );

    await screen.findByText('Processing And Stage Queue');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse All Groups' }));

    expect(onCollapsedGroupIdsChange).toHaveBeenCalledWith(['submission:submission-a', 'submission:submission-b']);
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
});