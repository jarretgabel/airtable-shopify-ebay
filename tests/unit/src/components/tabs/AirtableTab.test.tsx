import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AirtableTab } from '@/components/tabs/AirtableTab';

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

vi.mock('@/components/tabs/airtable/InventoryDirectoryListSection', () => {
  return {
    InventoryDirectoryListSection: ({
      searchTerm,
      statusFilter,
      sortMode,
      onSearchTermChange,
      onStatusFilterChange,
      onSortModeChange,
      ...rest
    }: {
      searchTerm: string;
      statusFilter: string;
      sortMode: 'intake-newest' | 'intake-oldest' | 'sku-asc' | 'sku-desc';
      onSearchTermChange: (value: string) => void;
      onStatusFilterChange: (value: string) => void;
      onSortModeChange: (value: 'intake-newest' | 'intake-oldest' | 'sku-asc' | 'sku-desc') => void;
    }) => {
      inventoryDirectoryListSectionMock({ searchTerm, statusFilter, sortMode, onSearchTermChange, onStatusFilterChange, onSortModeChange, ...rest });

      return (
        <div>
          <label>
            Directory Search
            <input
              aria-label="Directory Search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.currentTarget.value)}
            />
          </label>
          <label>
            Directory Status
            <select
              aria-label="Directory Status"
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.currentTarget.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Ready">Ready</option>
              <option value="Sold">Sold</option>
            </select>
          </label>
          <label>
            Directory Sort
            <select
              aria-label="Directory Sort"
              value={sortMode}
              onChange={(event) => onSortModeChange(event.currentTarget.value as 'intake-newest' | 'intake-oldest' | 'sku-asc' | 'sku-desc')}
            >
              <option value="intake-newest">Intake Date: Newest First</option>
              <option value="intake-oldest">Intake Date: Oldest First</option>
              <option value="sku-asc">SKU: A to Z</option>
              <option value="sku-desc">SKU: Z to A</option>
            </select>
          </label>
        </div>
      );
    },
  };
});

function LocationState() {
  const location = useLocation();
  return <div data-testid="location-state">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

describe('AirtableTab', () => {
  beforeEach(() => {
    loadWorkflowHubDirectoryMock.mockReset();
    inventoryDirectoryListSectionMock.mockReset();
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    loadWorkflowHubDirectoryMock.mockResolvedValue([
        {
          id: 'rec-1',
          createdTime: '2026-05-07T00:00:00.000Z',
          fields: {
            SKU: 'INV-1',
            'Workflow Status': 'Pending Review',
          },
        },
      ]);
  });

  it('keeps directory state and strips obsolete workflow queue params from the workflow hub URL', async () => {
    render(
      <MemoryRouter initialEntries={['/workflow-hub?inventoryDirectorySearch=amp&inventoryDirectoryStatus=Ready&workflowPendingReviewSearch=mcintosh&workflowProgressSearch=marantz&workflowPendingReviewGroup=pickup%3Apickup-100&workflowProgressGroup=pickup%3Apickup-200&workflowPendingReviewSort=newest&workflowProgressSort=oldest#used-gear-progress-queue']}>
        <AirtableTab
          viewModel={{
            loading: false,
            error: null,
            listings: [],
            displayValue: (value) => String(value ?? ''),
            hasValue: (value) => value !== null && value !== undefined && value !== '',
            recordTitle: () => 'Inventory Record',
          }}
          currentUserRole="admin"
          currentUserName="Taylor Reviewer"
          onAddNewRecord={vi.fn()}
          onOpenManualIntake={vi.fn()}
          onOpenTestingForm={vi.fn()}
          onOpenPhotosForm={vi.fn()}
          onOpenOperationalRecord={vi.fn()}
          onOpenListingsRecord={vi.fn()}
          onSelectRecord={vi.fn()}
        />
        <LocationState />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(loadWorkflowHubDirectoryMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/workflow-hub?inventoryDirectorySearch=amp&inventoryDirectoryStatus=Ready');
    });

    expect(screen.getByLabelText('Directory Search')).toHaveValue('amp');
    expect(screen.getByLabelText('Directory Status')).toHaveValue('Ready');
    expect(screen.getByLabelText('Directory Sort')).toHaveValue('intake-newest');
    expect(screen.queryByLabelText('Pending Review Search')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Workflow Progress Search')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset Workflow View' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Directory Search'), { target: { value: 'receiver' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('inventoryDirectorySearch=receiver');
      expect(screen.getByTestId('location-state')).toHaveTextContent('inventoryDirectoryStatus=Ready');
    });

    fireEvent.change(screen.getByLabelText('Directory Status'), { target: { value: 'Sold' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('inventoryDirectoryStatus=Sold');
    });

    fireEvent.change(screen.getByLabelText('Directory Sort'), { target: { value: 'intake-oldest' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('inventoryDirectorySort=intake-oldest');
    });

    fireEvent.change(screen.getByLabelText('Directory Sort'), { target: { value: 'sku-desc' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('inventoryDirectorySort=sku-desc');
    });
  });

  it('sorts workflow hub rows by SKU when sku sort is selected from route state', async () => {
    loadWorkflowHubDirectoryMock.mockResolvedValue([
      {
        id: 'rec-10',
        createdTime: '2026-05-07T00:00:00.000Z',
        fields: {
          SKU: 'INV-10',
          'Workflow Status': 'Pending Review',
        },
      },
      {
        id: 'rec-2',
        createdTime: '2026-05-08T00:00:00.000Z',
        fields: {
          SKU: 'INV-2',
          'Workflow Status': 'Pending Review',
        },
      },
      {
        id: 'rec-1',
        createdTime: '2026-05-09T00:00:00.000Z',
        fields: {
          SKU: 'INV-1',
          'Workflow Status': 'Pending Review',
        },
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/workflow-hub?inventoryDirectorySort=sku-asc']}>
        <AirtableTab
          viewModel={{
            loading: false,
            error: null,
            listings: [],
            displayValue: (value) => String(value ?? ''),
            hasValue: (value) => value !== null && value !== undefined && value !== '',
            recordTitle: () => 'Inventory Record',
          }}
          currentUserRole="admin"
          currentUserName="Taylor Reviewer"
          onAddNewRecord={vi.fn()}
          onOpenManualIntake={vi.fn()}
          onOpenTestingForm={vi.fn()}
          onOpenPhotosForm={vi.fn()}
          onOpenOperationalRecord={vi.fn()}
          onOpenListingsRecord={vi.fn()}
          onSelectRecord={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(loadWorkflowHubDirectoryMock).toHaveBeenCalledTimes(1);
      expect(inventoryDirectoryListSectionMock).toHaveBeenCalled();
    });

    const latestCall = inventoryDirectoryListSectionMock.mock.calls[inventoryDirectoryListSectionMock.mock.calls.length - 1]?.[0] as {
      sortMode: string;
      records: Array<{ fields: { SKU?: string } }>;
    };
    expect(latestCall.sortMode).toBe('sku-asc');
    expect(latestCall.records.map((record) => record.fields.SKU)).toEqual(['INV-1', 'INV-2', 'INV-10']);
  });

  it('leaves the workflow hub route on the directory when no workflow state is present', async () => {
    render(
      <MemoryRouter initialEntries={['/workflow-hub']}>
        <AirtableTab
          viewModel={{
            loading: false,
            error: null,
            listings: [],
            displayValue: (value) => String(value ?? ''),
            hasValue: (value) => value !== null && value !== undefined && value !== '',
            recordTitle: () => 'Inventory Record',
          }}
          currentUserRole="processor"
          currentUserName="Taylor Reviewer"
          onAddNewRecord={vi.fn()}
          onOpenManualIntake={vi.fn()}
          onOpenTestingForm={vi.fn()}
          onOpenPhotosForm={vi.fn()}
          onOpenOperationalRecord={vi.fn()}
          onOpenListingsRecord={vi.fn()}
          onSelectRecord={vi.fn()}
        />
        <LocationState />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-state').textContent).toBe('/workflow-hub');
    });
  });

  it('wires workflow hub next-step and edit-intake actions for each directory row', async () => {
    const onOpenManualIntake = vi.fn();
    const onOpenOperationalRecord = vi.fn();

    render(
      <MemoryRouter initialEntries={['/workflow-hub']}>
        <AirtableTab
          viewModel={{
            loading: false,
            error: null,
            listings: [],
            displayValue: (value) => String(value ?? ''),
            hasValue: (value) => value !== null && value !== undefined && value !== '',
            recordTitle: () => 'Inventory Record',
          }}
          currentUserRole="processor"
          currentUserName="Taylor Reviewer"
          onAddNewRecord={vi.fn()}
          onOpenManualIntake={onOpenManualIntake}
          onOpenTestingForm={vi.fn()}
          onOpenPhotosForm={vi.fn()}
          onOpenOperationalRecord={onOpenOperationalRecord}
          onOpenListingsRecord={vi.fn()}
          onSelectRecord={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(inventoryDirectoryListSectionMock).toHaveBeenCalledTimes(1);
    });

    const props = inventoryDirectoryListSectionMock.mock.calls[0][0] as {
      getNextStepLabel: (record: { id: string; fields: Record<string, unknown> }) => string | null;
      onOpenNextStep: (record: { id: string }) => void;
      getSecondaryActionLabel: (record: { id: string }) => string | null;
      onOpenSecondaryAction: (record: { id: string }) => void;
      secondaryActionIcon: string;
    };

    expect(props.getNextStepLabel({ id: 'rec-1', fields: { 'Workflow Status': 'Pending Review' } })).toBe('Open Parking Lot Review');
    props.onOpenNextStep({ id: 'rec-1' });
    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-1');
    expect(props.getSecondaryActionLabel({ id: 'rec-1' })).toBe('Edit Intake');
    expect(props.secondaryActionIcon).toBe('edit');
    props.onOpenSecondaryAction({ id: 'rec-1' });
    expect(onOpenManualIntake).toHaveBeenCalledWith('rec-1');
  });

  it('hides the workflow hub edit-intake action once a row is listed, ready to ship, or shipped', async () => {
    render(
      <MemoryRouter initialEntries={['/workflow-hub']}>
        <AirtableTab
          viewModel={{
            loading: false,
            error: null,
            listings: [],
            displayValue: (value) => String(value ?? ''),
            hasValue: (value) => value !== null && value !== undefined && value !== '',
            recordTitle: () => 'Inventory Record',
          }}
          currentUserRole="processor"
          currentUserName="Taylor Reviewer"
          onAddNewRecord={vi.fn()}
          onOpenManualIntake={vi.fn()}
          onOpenTestingForm={vi.fn()}
          onOpenPhotosForm={vi.fn()}
          onOpenOperationalRecord={vi.fn()}
          onOpenListingsRecord={vi.fn()}
          onSelectRecord={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(inventoryDirectoryListSectionMock).toHaveBeenCalledTimes(1);
    });

    const props = inventoryDirectoryListSectionMock.mock.calls[0][0] as {
      getSecondaryActionLabel: (record: { id: string; fields: Record<string, unknown> }) => string | null;
    };

    expect(props.getSecondaryActionLabel({ id: 'rec-listed', fields: { 'Workflow Status': 'Listed, Shopify' } })).toBeNull();
    expect(props.getSecondaryActionLabel({ id: 'rec-ready', fields: { 'Workflow Status': 'Sold - Ready to Ship' } })).toBeNull();
    expect(props.getSecondaryActionLabel({ id: 'rec-shipped', fields: { 'Workflow Status': 'Shipped' } })).toBeNull();
    expect(props.getSecondaryActionLabel({ id: 'rec-pending', fields: { 'Workflow Status': 'Pending Review' } })).toBe('Edit Intake');
  });

  it('shows the directory error state even when the inventory directory load fails', async () => {
    loadWorkflowHubDirectoryMock.mockRejectedValue(new Error('Failed to load workflow records from tbl0K0nFQL64jQMx8.'));

    render(
      <MemoryRouter initialEntries={['/workflow-hub#used-gear-progress-queue']}>
        <>
          <AirtableTab
            viewModel={{
              loading: false,
              error: null,
              listings: [],
              displayValue: (value) => String(value ?? ''),
              hasValue: (value) => value !== null && value !== undefined && value !== '',
              recordTitle: () => 'Inventory Record',
            }}
            currentUserRole="admin"
            currentUserName="Taylor Reviewer"
            onAddNewRecord={vi.fn()}
            onOpenManualIntake={vi.fn()}
            onOpenTestingForm={vi.fn()}
            onOpenPhotosForm={vi.fn()}
            onOpenOperationalRecord={vi.fn()}
            onOpenListingsRecord={vi.fn()}
            onSelectRecord={vi.fn()}
          />
          <LocationState />
        </>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workflow Hub directory is currently unavailable.')).toBeInTheDocument();
    expect(screen.getByTestId('location-state')).toHaveTextContent('/workflow-hub');
  });
});