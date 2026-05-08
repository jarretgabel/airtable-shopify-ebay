import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowRecordPage } from '@/components/tabs/UsedGearWorkflowRecordPage';

const { loadUsedGearWorkflowRecordMock, completePreListingReviewStageMock } = vi.hoisted(() => ({
  loadUsedGearWorkflowRecordMock: vi.fn(),
  completePreListingReviewStageMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  completePreListingReviewStage: completePreListingReviewStageMock,
  completePhotographyStage: vi.fn(),
  completeProcessingStage: vi.fn(),
  completeTestingStage: vi.fn(),
  loadUsedGearWorkflowRecord: loadUsedGearWorkflowRecordMock,
}));

vi.mock('@/services/inventoryDirectory', () => ({
  displayInventoryValue: (value: unknown) => String(value ?? '—'),
}));

vi.mock('@/services/usedGearWorkflow', () => ({
  getUsedGearWorkflowStatus: (fields: Record<string, unknown>) => String(fields['Workflow Status'] ?? ''),
}));

describe('UsedGearWorkflowRecordPage', () => {
  beforeEach(() => {
    loadUsedGearWorkflowRecordMock.mockReset();
    completePreListingReviewStageMock.mockReset();
  });

  it('shows a blocking readiness notice when no listing price exists', async () => {
    loadUsedGearWorkflowRecordMock.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: {
        SKU: 'SKU-1',
        Make: 'McIntosh',
        Model: 'C28',
        'Workflow Status': 'Awaiting Pre-Listing Review',
        'Inventory Notes': 'Ready except for price.',
      },
    });

    render(
      <UsedGearWorkflowRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec1"
        onBackToDirectory={vi.fn()}
        onOpenIncomingGearForm={vi.fn()}
        onOpenTestingForm={vi.fn()}
        onOpenPhotosForm={vi.fn()}
        onOpenListingsRecord={vi.fn()}
        onOpenInventoryEditor={vi.fn()}
      />,
    );

    expect(await screen.findByText('Reviewer And Pricing Gate')).toBeInTheDocument();
    expect(screen.getByText('Missing price')).toBeInTheDocument();
    expect(screen.getByText('Capture a listing price before approving the row for publish.')).toBeInTheDocument();
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
    loadUsedGearWorkflowRecordMock.mockResolvedValue({
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
    });

    render(
      <UsedGearWorkflowRecordPage
        currentUserName="Taylor Reviewer"
        recordId="rec1"
        onBackToDirectory={vi.fn()}
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
});