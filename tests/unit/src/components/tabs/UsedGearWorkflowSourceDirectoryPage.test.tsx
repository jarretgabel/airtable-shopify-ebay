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

  it('shows only intake-stage rows without SKUs for the selected manual source', async () => {
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
        id: 'rec-manual-arrived-sku',
        createdTime: '2026-05-03T12:00:00.000Z',
        fields: {
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
          SKU: 'MAN-100',
          'Item Title': 'Manual Arrived With Sku',
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
      records: Array<{ id: string; fields: Record<string, unknown> }>;
      totalCount: number;
      statusOptions: string[];
      getItemLabel: (record: { id: string; fields: Record<string, unknown> }) => string;
    };

    expect(props.totalCount).toBe(2);
    expect(props.records.map((record) => record.id)).toEqual(['rec-manual-awaiting-arrival', 'rec-manual-pending']);
    expect(props.statusOptions).toEqual(['Accepted - Awaiting Arrival', 'Pending Review']);
    expect(props.getItemLabel({
      id: 'recAbc123456789',
      fields: { Make: 'McIntosh', Model: 'MC275', 'Item Title': 'McIntosh MC275 - Abc123456789' },
    })).toBe('McIntosh MC275 - 456789');
  });

  it('shows only intake-stage rows without SKUs for the selected jotform source and preserves full stored titles', async () => {
    loadWorkflowHubDirectoryMock.mockResolvedValue([
      {
        id: 'rec-jotform-pending',
        createdTime: '2026-05-01T00:00:00.000Z',
        fields: {
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Pending Review',
          'Item Title': 'JotForm Pending',
        },
      },
      {
        id: 'rec-jotform-approved',
        createdTime: '2026-05-02T00:00:00.000Z',
        fields: {
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Approved for Publish',
          'Item Title': 'JotForm Approved',
        },
      },
      {
        id: 'rec-jotform-arrived-sku',
        createdTime: '2026-05-02T12:00:00.000Z',
        fields: {
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
          SKU: 'JF-200',
          'Item Title': 'JotForm Arrived With Sku',
        },
      },
      {
        id: 'rec-manual-pending',
        createdTime: '2026-05-03T00:00:00.000Z',
        fields: {
          'Workflow Source': 'Manual Entry',
          'Workflow Status': 'Pending Review',
          'Item Title': 'Manual Pending',
        },
      },
    ]);

    render(
      <UsedGearWorkflowSourceDirectoryPage
        title="JotForm"
        detail="JotForm directory"
        workflowSource="JotForm"
        onOpenRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Inventory directory list section')).toBeInTheDocument();

    await waitFor(() => {
      expect(inventoryDirectoryListSectionMock).toHaveBeenCalledTimes(1);
    });

    const props = inventoryDirectoryListSectionMock.mock.calls[0][0] as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
      totalCount: number;
      statusOptions: string[];
      resultLabel: string;
      getItemLabel: (record: { id: string; fields: Record<string, unknown> }) => string;
    };

    expect(props.totalCount).toBe(1);
    expect(props.records.map((record) => record.id)).toEqual(['rec-jotform-pending']);
    expect(props.statusOptions).toEqual(['Pending Review']);
    expect(props.resultLabel).toBe('workflow rows');
    expect(props.getItemLabel({
      id: 'recTv8SETONJoog2c',
      fields: { Make: 'JBL', Model: 'L100', 'Item Title': 'JBL L100 - Tv8SETONJoog2c' },
    })).toBe('JBL L100 - Tv8SETONJoog2c');
  });

  it('surfaces multi-item pickup groups as one directory row and routes them through group editing', async () => {
    const onOpenRecord = vi.fn();
    const onOpenGroup = vi.fn();

    loadWorkflowHubDirectoryMock.mockResolvedValue([
      {
        id: 'rec-group-a',
        createdTime: '2026-05-01T00:00:00.000Z',
        fields: {
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Pending Review',
          'Pick Up ID': 'PICKUP-42',
          'Item Title': 'Grouped Item One',
        },
      },
      {
        id: 'rec-group-b',
        createdTime: '2026-05-01T01:00:00.000Z',
        fields: {
          'Workflow Source': 'JotForm',
          'Workflow Status': 'Pending Review',
          'Pick Up ID': 'PICKUP-42',
          'Item Title': 'Grouped Item Two',
        },
      },
    ]);

    render(
      <UsedGearWorkflowSourceDirectoryPage
        title="JotForm"
        workflowSource="JotForm"
        onOpenRecord={onOpenRecord}
        onOpenGroup={onOpenGroup}
      />,
    );

    expect(await screen.findByText('Inventory directory list section')).toBeInTheDocument();

    await waitFor(() => {
      expect(inventoryDirectoryListSectionMock).toHaveBeenCalledTimes(1);
    });

    const props = inventoryDirectoryListSectionMock.mock.calls[0][0] as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
      totalCount: number;
      onSelectRecord: (recordId: string) => void;
      getItemLabel: (record: { id: string; fields: Record<string, unknown> }) => string;
    };

    expect(props.totalCount).toBe(1);
    expect(props.records.map((record) => record.id)).toEqual(['PICKUP-42']);
    expect(props.getItemLabel(props.records[0]!)).toBe('PICKUP-42 (2 items)');

    props.onSelectRecord('PICKUP-42');

    expect(onOpenGroup).toHaveBeenCalledWith('PICKUP-42', 'pending-review');
    expect(onOpenRecord).not.toHaveBeenCalled();
  });
});