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
    window.history.replaceState({}, '', '/workflow-hub');
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

    await screen.findByText('Processing And Specialist Queue');
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

    await screen.findByText('Processing And Specialist Queue');

    expect(screen.queryByText('Single workflow item')).not.toBeInTheDocument();
    expect(screen.queryByText('Single item')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Group/i }).length).toBeGreaterThan(0);
  });

  it('opens manual intake and keeps the operational record link for arrival-stage rows in the all queue', async () => {
    const onOpenManualIntake = vi.fn();
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
          'Pick Up ID': 'submission-a',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenManualIntake={onOpenManualIntake}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Processing And Specialist Queue');

    fireEvent.click(screen.getByRole('button', { name: 'Open Intake' }));

    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-progress-a');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Workflow Record' }));

    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-progress-a');
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
  });

  it('removes workflow status suffixes from item titles in the all queue', async () => {
    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-status-suffix',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-SFX-1',
          Make: 'Accuphase',
          Model: 'E-202 Awaiting SKU',
          'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
          'Arrival Date': '2026-05-06',
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

    await screen.findByText('Processing And Specialist Queue');
    expect(screen.getByText('Accuphase · E-202')).toBeInTheDocument();
    expect(screen.queryByText('Accuphase · E-202 Awaiting SKU')).not.toBeInTheDocument();
    expect(screen.getByText('May 6, 2026')).toBeInTheDocument();
  });

  it('routes all-queue testing, photography, and listing review rows to their next surfaces', async () => {
    const onOpenTestingForm = vi.fn();
    const onOpenPhotosForm = vi.fn();
    const onOpenListingsRecord = vi.fn();

    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-testing-all',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-TEST-ALL',
          Make: 'Marantz',
          Model: '8B',
          'Workflow Status': 'Testing In Progress',
          'Workflow Next Team': 'Testing',
        },
      },
      {
        id: 'rec-progress-photo-all',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-PHOTO-ALL',
          Make: 'Pioneer',
          Model: 'SX-1250',
          'Workflow Status': 'Photography In Progress',
          'Workflow Next Team': 'Photography',
          'Testing Signed By': 'Taylor Reviewer',
        },
      },
      {
        id: 'rec-progress-listings-all',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-LISTINGS-ALL',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Awaiting Pre-Listing Review',
          'Workflow Next Team': 'Listings',
        },
      },
    ]);

    render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={onOpenTestingForm}
        onOpenPhotosForm={onOpenPhotosForm}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={onOpenListingsRecord}
      />,
    );

    await screen.findByText('Processing And Specialist Queue');

    fireEvent.click(screen.getByRole('button', { name: 'Open Testing' }));
    expect(onOpenTestingForm).toHaveBeenCalledWith('rec-progress-testing-all');

    fireEvent.click(screen.getByRole('button', { name: 'Open Photos' }));
    expect(onOpenPhotosForm).toHaveBeenCalledWith('rec-progress-photo-all');

    fireEvent.click(screen.getByRole('button', { name: 'Open Listings Approval' }));
    expect(onOpenListingsRecord).toHaveBeenCalledWith('rec-progress-listings-all');
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
          'Workflow Status': 'Testing In Progress',
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
          'Workflow Status': 'Testing In Progress',
        },
      },
      {
        id: 'rec-progress-c',
        createdTime: '2026-05-05T00:00:00.000Z',
        fields: {
          SKU: 'PROG-3',
          Make: 'Pioneer',
          Model: 'SX-1250',
          'Workflow Status': 'Testing In Progress',
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

    expect(await screen.findByText('Processing And Specialist Queue')).toBeInTheDocument();
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
          'Workflow Status': 'Testing In Progress',
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
    expect(screen.queryByRole('button', { name: 'Edit Workflow Record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Status/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Group/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Next Team: Testing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Price Ready:/i)).not.toBeInTheDocument();
  });

  it('hides redundant item status text in the dedicated testing and photography queues', async () => {
    loadWorkflowProgressQueueMock.mockResolvedValue([
      {
        id: 'rec-progress-testing-pending',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-TST-2',
          Make: 'Marantz',
          Model: '7C Testing Pending',
          'Workflow Status': 'Testing In Progress',
          'Workflow Next Team': 'Testing Pending',
        },
      },
      {
        id: 'rec-progress-photo-pending',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'PROG-PHT-2',
          Make: 'Pioneer',
          Model: 'SA-9900 Photo Pending',
          'Workflow Status': 'Photography In Progress',
          'Workflow Next Team': 'Photo Pending',
          'Testing Signed By': 'Taylor Reviewer',
        },
      },
    ]);

    const { rerender } = render(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        queueMode="testing"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Testing Queue');
    expect(screen.queryByText('Testing Pending')).not.toBeInTheDocument();
    expect(screen.getByText('Marantz · 7C')).toBeInTheDocument();
    expect(screen.queryByText('Testing In Progress')).not.toBeInTheDocument();

    rerender(
      <UsedGearWorkflowProgressSection
        currentUserName="Taylor Reviewer"
        queueMode="photography"
        onOpenManualIntake={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenOperationalRecord={vi.fn()}
        onOpenListingsRecord={vi.fn()}
      />,
    );

    await screen.findByText('Photography Queue');
    expect(screen.queryByText('Photo Pending')).not.toBeInTheDocument();
    expect(screen.getByText('Pioneer · SA-9900')).toBeInTheDocument();
    expect(screen.queryByText('Photography In Progress')).not.toBeInTheDocument();
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
          'Workflow Status': 'Photography In Progress',
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
    expect(screen.queryByRole('button', { name: 'Edit Workflow Record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Status/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Group/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Next Team: Photography/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Price Ready:/i)).not.toBeInTheDocument();
  });
});