import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowRecordPage } from '@/components/tabs/UsedGearWorkflowRecordPage';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/auth/authStore';

const { loadUsedGearWorkflowRecordContextMock, completePreListingReviewStageMock, completeProcessingStageMock } = vi.hoisted(() => ({
  loadUsedGearWorkflowRecordContextMock: vi.fn(),
  completePreListingReviewStageMock: vi.fn(),
  completeProcessingStageMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  completePreListingReviewStage: completePreListingReviewStageMock,
  completePhotographyStage: vi.fn(),
  completeProcessingStage: completeProcessingStageMock,
  completeTestingStage: vi.fn(),
  loadUsedGearWorkflowRecordContext: loadUsedGearWorkflowRecordContextMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? '—'),
}));

vi.mock('@/services/usedGearWorkflow', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearWorkflow')>('@/services/usedGearWorkflow');
  return {
    ...actual,
    getUsedGearWorkflowStatus: (fields: Record<string, unknown>) => String(fields['Workflow Status'] ?? ''),
  };
});

describe('UsedGearWorkflowRecordPage', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
    useAuthStore.setState({
      users: [
        {
          id: 'user-1',
          name: 'Taylor Reviewer',
          email: 'taylor@example.com',
          role: 'admin',
          allowedPages: [],
          notificationPreferences: {
            infoEnabled: true,
            successEnabled: true,
            warningEnabled: true,
            errorEnabled: true,
            autoDismissMs: 5000,
            workflowEvents: {
              pendingReview: false,
              processing: false,
              testing: true,
              photography: true,
              preListingReview: true,
              approvedForPublish: false,
            },
          },
        },
      ],
      currentUserId: 'user-1',
    });
    loadUsedGearWorkflowRecordContextMock.mockReset();
    completePreListingReviewStageMock.mockReset();
    completeProcessingStageMock.mockReset();
  });

  it('shows a blocking readiness notice when no listing price exists', async () => {
    const onOpenInventoryEditor = vi.fn();

    loadUsedGearWorkflowRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          SKU: 'SKU-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Awaiting Pre-Listing Review',
          'Inventory Notes': 'Ready except for price.',
        },
      },
      group: null,
    });

    render(
      <UsedGearWorkflowRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec1"
        onBackToDirectory={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenListingsRecord={vi.fn()}
        onOpenInventoryEditor={onOpenInventoryEditor}
      />,
    );

    expect(await screen.findByText('Reviewer And Pricing Gate')).toBeInTheDocument();
    expect(screen.getByText('Missing price')).toBeInTheDocument();
    expect(screen.getByText('Capture a listing price before approving the row for publish.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Price Editor' }));
    expect(onOpenInventoryEditor).toHaveBeenCalledWith('rec1');
    expect(screen.getByRole('button', { name: 'Approve For Publish' })).toBeDisabled();
  });

  it('requires reviewer confirmations before approving for publish', async () => {
    completePreListingReviewStageMock.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: {
        SKU: 'SKU-1',
        Make: 'McIntosh',
        Model: 'C28',
        'Workflow Status': 'Approved for Publish',
        Price: '2499.00',
      },
    });
    loadUsedGearWorkflowRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          SKU: 'SKU-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Awaiting Pre-Listing Review',
          Price: '2499.00',
          'Inventory Notes': 'Freshly serviced.',
        },
      },
      group: null,
    });

    render(
      <UsedGearWorkflowRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec1"
        onBackToDirectory={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenListingsRecord={vi.fn()}
        onOpenInventoryEditor={vi.fn()}
      />,
    );

    const button = await screen.findByRole('button', { name: 'Approve For Publish' });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Pricing confirmed/i }));
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Content reviewed/i }));
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => {
      expect(completePreListingReviewStageMock).toHaveBeenCalledWith('rec1', 'Taylor Reviewer');
    });
  });

  it('adds a workflow-record notification action after processing completion', async () => {
    const onOpenWorkflowRecord = vi.fn();

    loadUsedGearWorkflowRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          SKU: 'SKU-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
      group: null,
    });
    completeProcessingStageMock.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: {
        SKU: 'SKU-1',
        Make: 'McIntosh',
        Model: 'C28',
        'Workflow Status': 'Testing and Photography In Progress',
      },
    });

    render(
      <UsedGearWorkflowRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec1"
        onBackToDirectory={vi.fn()}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenListingsRecord={vi.fn()}
        onOpenInventoryEditor={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Complete Processing' }));

    await waitFor(() => {
      const notification = useNotificationStore.getState().notifications[0];
      expect(notification?.actionLabel).toBe('Open Workflow Record');
      expect(notification?.title).toBe('Processing complete: testing and photography next');
      notification?.onAction?.();
    });

    expect(onOpenWorkflowRecord).toHaveBeenCalledWith('rec1');
  });

  it('renders a compact workflow timeline with completed and pending stages', async () => {
    loadUsedGearWorkflowRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          SKU: 'SKU-1',
          Make: 'McIntosh',
          Model: 'C28',
          'Workflow Status': 'Testing and Photography In Progress',
          'Accepted At': '2026-05-08T01:00:00.000Z',
          'Accepted By': 'Taylor Reviewer',
          'Processing Signed At': '2026-05-08T02:00:00.000Z',
          'Processing Signed By': 'Jordan Processor',
        },
      },
      group: null,
    });

    render(
      <UsedGearWorkflowRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec1"
        onBackToDirectory={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenListingsRecord={vi.fn()}
        onOpenInventoryEditor={vi.fn()}
      />,
    );

    expect(await screen.findByText('Workflow Timeline')).toBeInTheDocument();
    expect(screen.getByText('Intake Accepted')).toBeInTheDocument();
    expect(screen.getByText('Processing Completed')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  it('shows sibling rows when the workflow record belongs to a grouped submission', async () => {
    loadUsedGearWorkflowRecordContextMock.mockResolvedValue({
      record: {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          SKU: 'SKU-1',
          Make: 'McIntosh',
          Model: 'MC240',
          'Workflow Status': 'Accepted - Awaiting Arrival',
        },
      },
      group: {
        id: 'submission:SUB-42',
        key: 'submission:SUB-42',
        label: 'SUB-42',
        description: 'Submission group',
        records: [
          {
            id: 'rec1',
            createdTime: 'now',
            fields: {
              SKU: 'SKU-1',
              Make: 'McIntosh',
              Model: 'MC240',
              'Workflow Status': 'Accepted - Awaiting Arrival',
            },
          },
          {
            id: 'rec2',
            createdTime: 'now',
            fields: {
              SKU: 'SKU-2',
              Make: 'McIntosh',
              Model: 'C28',
              'Workflow Status': 'Pending Review',
              'Offer Amount': 400,
            },
          },
        ],
      },
    });

    render(
      <UsedGearWorkflowRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec1"
        onBackToDirectory={vi.fn()}
        onOpenWorkflowRecord={vi.fn()}
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenListingsRecord={vi.fn()}
        onOpenInventoryEditor={vi.fn()}
      />,
    );

    expect(await screen.findByText('Grouped Submission Context')).toBeInTheDocument();
    expect(screen.getByText('Siblings with offers: 1')).toBeInTheDocument();
    expect(screen.getByText('SKU-2')).toBeInTheDocument();
  });
});