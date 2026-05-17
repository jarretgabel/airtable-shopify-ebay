import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowProgressSection } from '@/components/tabs/airtable/UsedGearWorkflowProgressSection';

const { loadWorkflowProgressQueueMock } = vi.hoisted(() => ({
  loadWorkflowProgressQueueMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadWorkflowProgressQueue: loadWorkflowProgressQueueMock,
  };
});

describe('UsedGearWorkflowProgressSection', () => {
  beforeEach(() => {
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

    await screen.findByText('Processing And Holding Queue');
    expect(screen.getByLabelText(/Sort used gear processing and holding queue/i)).toBeInTheDocument();
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

    await screen.findByText('Processing And Holding Queue');

    expect(screen.queryByText('Single workflow item')).not.toBeInTheDocument();
    expect(screen.queryByText('Single item')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Group/i }).length).toBeGreaterThan(0);
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

    await screen.findByText('Processing And Holding Queue');

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Stage Review' })[0]!);

    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-progress-a');
  });

  it('keeps the full progress queue visible without owner-scoped filtering', async () => {
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

    expect(await screen.findByText('Processing And Holding Queue')).toBeInTheDocument();
    expect(screen.getAllByText('PROG-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROG-2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROG-3').length).toBeGreaterThan(0);
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
          'Workflow Next Team': 'Testing',
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

    fireEvent.click((await screen.findAllByRole('button', { name: 'Open Testing' }))[0]!);

    expect(onOpenTestingForm).toHaveBeenCalledWith('rec-progress-testing');
    expect(screen.queryByRole('button', { name: 'Open Operational Record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Status/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Next Team: Testing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Price Ready:/i)).not.toBeInTheDocument();
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
          'Workflow Next Team': 'Photography',
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

    fireEvent.click((await screen.findAllByRole('button', { name: 'Open Photos' }))[0]!);

    expect(onOpenPhotosForm).toHaveBeenCalledWith('rec-progress-photo');
    expect(screen.queryByRole('button', { name: 'Open Operational Record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Status/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Next Team: Photography/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Price Ready:/i)).not.toBeInTheDocument();
  });
});