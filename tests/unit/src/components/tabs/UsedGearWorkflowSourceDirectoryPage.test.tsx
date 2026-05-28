import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearWorkflowSourceDirectoryPage } from '@/components/tabs/UsedGearWorkflowSourceDirectoryPage';

const { loadWorkflowHubDirectoryMock, inventoryDirectoryListSectionMock } = vi.hoisted(() => ({
  loadWorkflowHubDirectoryMock: vi.fn(),
  inventoryDirectoryListSectionMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadWorkflowHubDirectory: loadWorkflowHubDirectoryMock,
  };
});

vi.mock('@/components/tabs/airtable/InventoryDirectoryListSection', () => ({
  InventoryDirectoryListSection: (props: unknown) => {
    inventoryDirectoryListSectionMock(props);
    return <div>Inventory directory list section</div>;
  },
}));

describe('UsedGearWorkflowSourceDirectoryPage', () => {
  beforeEach(() => {
    loadWorkflowHubDirectoryMock.mockReset();
    inventoryDirectoryListSectionMock.mockReset();
  });

  it('limits source directories to intake-stage rows for the selected source', async () => {
    loadWorkflowHubDirectoryMock.mockResolvedValue([
      {
        id: 'rec-manual-pending',
        createdTime: '2026-05-01T00:00:00.000Z',
        fields: {
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Pending Review',
          'Item Title': 'Manual Pending',
        },
      },
      {
        id: 'rec-manual-awaiting-arrival',
        createdTime: '2026-05-02T00:00:00.000Z',
        fields: {
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Accepted - Awaiting Arrival',
          'Item Title': 'Manual Awaiting Arrival',
        },
      },
      {
        id: 'rec-manual-testing',
        createdTime: '2026-05-03T00:00:00.000Z',
        fields: {
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Testing In Progress',
          'Item Title': 'Manual Testing',
        },
      },
      {
        id: 'rec-jotform-pending',
        createdTime: '2026-05-04T00:00:00.000Z',
        fields: {
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Pending Review',
          'Item Title': 'JotForm Pending',
        },
      },
    ]);

    render(
      <UsedGearWorkflowSourceDirectoryPage
        title="Manual Intake"
        detail="Manual intake directory"
        workflowSource="Manual Entry"
        onOpenRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Inventory directory list section')).toBeInTheDocument();

    await waitFor(() => {
      expect(inventoryDirectoryListSectionMock).toHaveBeenCalledTimes(1);
    });

    const props = inventoryDirectoryListSectionMock.mock.calls[0][0] as {
      records: Array<{ id: string }>;
      totalCount: number;
      statusOptions: string[];
    };

    expect(props.totalCount).toBe(2);
    expect(props.records.map((record) => record.id)).toEqual(['rec-manual-awaiting-arrival', 'rec-manual-pending']);
    expect(props.statusOptions).toEqual(['Accepted - Awaiting Arrival', 'Pending Review']);
  });
});