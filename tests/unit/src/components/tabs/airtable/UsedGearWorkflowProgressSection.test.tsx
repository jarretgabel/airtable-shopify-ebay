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

  it('shows inline sort options in the header by default', async () => {
    loadWorkflowProgressQueueMock.mockResolvedValue([]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Processing And Stage Queue');
    expect(screen.getByLabelText(/Sort used gear progress queue/i)).toBeInTheDocument();
  });

  it('labels single workflow progress records without group wording', async () => {
    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-single',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          'Arrival Date': '2026-05-06',
          SKU: 'PROG-SINGLE',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Processing And Stage Queue');

    expect(screen.getAllByText('Single workflow item').length).toBeGreaterThan(0);
    expect(screen.getByText('Single item')).toBeInTheDocument();
    expect(screen.getByText(/Visible Sets:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Item Link' })).toBeInTheDocument();
    expect(screen.getByText(/Intake Date:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/May 6, 2026/i).length).toBeGreaterThan(0);
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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Processing And Stage Queue');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy (Group|Item) Link/i }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/inventory?workflowProgressGroup=submission%3Asubmission-a#used-gear-progress-queue`);
    });
  });

  it('opens stage review from the compact progress card', async () => {
    const onOpenOperationalRecord = vi.fn();

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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Processing And Stage Queue');

    fireEvent.click(screen.getByRole('button', { name: 'Open Stage Review' }));

    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-progress-a');
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
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Processing And Stage Queue')).toBeInTheDocument();
    expect(screen.getAllByText('PROG-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROG-2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROG-3').length).toBeGreaterThan(0);
  });

  it('opens listings approval from the compact progress card when publish-ready', async () => {
    const onOpenListingsRecord = vi.fn();

    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-a',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-1',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Approved for Publish',
          'Approved For Publish At': '2026-05-08T04:00:00.000Z',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={onOpenListingsRecord}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open Listings Approval' }));

    expect(onOpenListingsRecord).toHaveBeenCalledWith('rec-progress-a');
  });

  it('opens the testing form directly from the dedicated testing queue', async () => {
    const onOpenTestingForm = vi.fn();

    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-testing',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-TST-1',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Testing and Photography In Progress',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        queueMode="testing"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={onOpenTestingForm}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open Testing' }));

    expect(onOpenTestingForm).toHaveBeenCalledWith('rec-progress-testing');
    expect(screen.queryByRole('button', { name: 'Open Operational Record' })).not.toBeInTheDocument();
  });

  it('opens the photos form directly from the dedicated photography queue', async () => {
    const onOpenPhotosForm = vi.fn();

    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-photo',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-PHT-1',
          Make: 'Pioneer',
          Model: 'SX-1250',
          'Workflow Status': 'Testing and Photography In Progress',
          'Testing Signed By': 'Taylor Reviewer',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        queueMode="photography"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={onOpenPhotosForm}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open Photos' }));

    expect(onOpenPhotosForm).toHaveBeenCalledWith('rec-progress-photo');
    expect(screen.queryByRole('button', { name: 'Open Operational Record' })).not.toBeInTheDocument();
  });
});