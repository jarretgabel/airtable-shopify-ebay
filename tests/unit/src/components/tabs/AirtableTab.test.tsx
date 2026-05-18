import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AirtableTab } from '@/components/tabs/AirtableTab';

const { loadInventoryDirectoryMock } = vi.hoisted(() => ({
  loadInventoryDirectoryMock: vi.fn(),
}));

vi.mock('@/services/inventoryDirectory', async () => {
  const actual = await vi.importActual<typeof import('@/services/inventoryDirectory')>('@/services/inventoryDirectory');
  return {
    ...actual,
    loadInventoryDirectory: loadInventoryDirectoryMock,
  };
});

vi.mock('@/components/tabs/airtable/InventoryDirectoryListSection', () => ({
  InventoryDirectoryListSection: ({
    searchTerm,
    statusFilter,
    sortMode,
    onSearchTermChange,
    onStatusFilterChange,
    onSortModeChange,
  }: {
    searchTerm: string;
    statusFilter: string;
    sortMode: 'intake-newest' | 'intake-oldest';
    onSearchTermChange: (value: string) => void;
    onStatusFilterChange: (value: string) => void;
    onSortModeChange: (value: 'intake-newest' | 'intake-oldest') => void;
  }) => (
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
          onChange={(event) => onSortModeChange(event.currentTarget.value as 'intake-newest' | 'intake-oldest')}
        >
          <option value="intake-newest">Intake Date: Newest First</option>
          <option value="intake-oldest">Intake Date: Oldest First</option>
        </select>
      </label>
    </div>
  ),
}));

function LocationState() {
  const location = useLocation();
  return <div data-testid="location-state">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

describe('AirtableTab', () => {
  beforeEach(() => {
    loadInventoryDirectoryMock.mockReset();
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    loadInventoryDirectoryMock.mockResolvedValue({
      records: [
        {
          id: 'rec-1',
          createdTime: '2026-05-07T00:00:00.000Z',
          fields: {
            SKU: 'INV-1',
            Status: 'Ready',
          },
        },
      ],
    });
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
      expect(loadInventoryDirectoryMock).toHaveBeenCalledTimes(1);
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
  });

  it('leaves the workflow hub route on the directory when no legacy workflow state is present', async () => {
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

  it('shows the directory error state even when the inventory directory load fails', async () => {
    loadInventoryDirectoryMock.mockRejectedValue(new Error('Failed to load Airtable records from tblInventory.'));

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

    expect(await screen.findByText('SB Inventory directory is currently unavailable.')).toBeInTheDocument();
    expect(screen.getByTestId('location-state')).toHaveTextContent('/workflow-hub');
  });
});