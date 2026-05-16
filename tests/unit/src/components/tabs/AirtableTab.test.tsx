import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AirtableTab } from '@/components/tabs/AirtableTab';

const { loadInventoryDirectoryMock } = vi.hoisted(() => ({
  loadInventoryDirectoryMock: vi.fn(),
}));
const { clipboardWriteTextMock } = vi.hoisted(() => ({
  clipboardWriteTextMock: vi.fn(),
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
    onSearchTermChange,
    onStatusFilterChange,
  }: {
    searchTerm: string;
    statusFilter: string;
    onSearchTermChange: (value: string) => void;
    onStatusFilterChange: (value: string) => void;
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
    </div>
  ),
}));

vi.mock('@/components/tabs/airtable/UsedGearPendingReviewSection', () => ({
  UsedGearPendingReviewSection: ({
    searchTerm = '',
    focusedGroupId = null,
    onFocusedGroupIdChange,
    onSearchTermChange,
    sortMode = 'group-label',
    onSortModeChange,
  }: {
    searchTerm?: string;
    focusedGroupId?: string | null;
    onFocusedGroupIdChange?: (value: string | null) => void;
    onSearchTermChange?: (value: string) => void;
    sortMode?: string;
    onSortModeChange?: (value: 'group-label' | 'newest' | 'oldest') => void;
  }) => (
    <div>
      <label>
        Pending Review Search
        <input
          aria-label="Pending Review Search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange?.(event.currentTarget.value)}
        />
      </label>
      <div data-testid="pending-focused-group">{focusedGroupId ?? ''}</div>
      <div data-testid="pending-sort-mode">{sortMode}</div>
      <button type="button" onClick={() => onFocusedGroupIdChange?.('pickup:pickup-42')}>Focus Pending Group</button>
      <button type="button" onClick={() => onFocusedGroupIdChange?.(null)}>Clear Pending Group</button>
      <button type="button" onClick={() => onSortModeChange?.('newest')}>Sort Pending Newest</button>
    </div>
  ),
}));

vi.mock('@/components/tabs/airtable/UsedGearWorkflowProgressSection', () => ({
  UsedGearWorkflowProgressSection: ({
    searchTerm = '',
    focusedGroupId = null,
    onFocusedGroupIdChange,
    onSearchTermChange,
    sortMode = 'group-label',
    onSortModeChange,
  }: {
    searchTerm?: string;
    focusedGroupId?: string | null;
    onFocusedGroupIdChange?: (value: string | null) => void;
    onSearchTermChange?: (value: string) => void;
    sortMode?: string;
    onSortModeChange?: (value: 'group-label' | 'newest' | 'oldest') => void;
  }) => (
    <div>
      <label>
        Workflow Progress Search
        <input
          aria-label="Workflow Progress Search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange?.(event.currentTarget.value)}
        />
      </label>
      <div data-testid="progress-focused-group">{focusedGroupId ?? ''}</div>
      <div data-testid="progress-sort-mode">{sortMode}</div>
      <button type="button" onClick={() => onFocusedGroupIdChange?.('submission:submission-22')}>Focus Progress Group</button>
      <button type="button" onClick={() => onFocusedGroupIdChange?.(null)}>Clear Progress Group</button>
      <button type="button" onClick={() => onSortModeChange?.('oldest')}>Sort Progress Oldest</button>
    </div>
  ),
}));

vi.mock('@/components/tabs/airtable/UsedGearWorkflowPostPublishSection', () => ({
  UsedGearWorkflowPostPublishSection: ({
    searchTerm = '',
    onSearchTermChange,
    onFocusedBucketChange,
    sortMode = 'latest-activity',
    onSortModeChange,
  }: {
    searchTerm?: string;
    onSearchTermChange?: (value: string) => void;
    onFocusedBucketChange?: (bucket: 'all' | 'active-listing' | 'stale-listing' | 'sold-ready' | 'shipped') => void;
    sortMode?: string;
    onSortModeChange?: (value: 'latest-activity' | 'oldest-activity' | 'sku') => void;
  }) => (
    <div>
      <label>
        Post Publish Search
        <input
          aria-label="Post Publish Search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange?.(event.currentTarget.value)}
        />
      </label>
      <div data-testid="post-publish-sort-mode">{sortMode}</div>
      <button type="button" onClick={() => onFocusedBucketChange?.('sold-ready')}>Focus Sold Ready</button>
      <button type="button" onClick={() => onFocusedBucketChange?.('all')}>Show All Buckets</button>
      <button type="button" onClick={() => onSortModeChange?.('sku')}>Sort Post Publish SKU</button>
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
    clipboardWriteTextMock.mockReset();
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextMock,
      },
    });
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

  it('hydrates workflow view state from the URL, persists updates, and resets workflow params', async () => {
    render(
      <MemoryRouter initialEntries={['/inventory?inventoryDirectorySearch=amp&inventoryDirectoryStatus=Ready&workflowPendingReviewSearch=mcintosh&workflowProgressSearch=marantz&workflowPostPublishSearch=shipped&workflowPostPublishBucket=active-listing&workflowPendingReviewSort=newest&workflowProgressSort=oldest&workflowPostPublishSort=sku&workflowPendingReviewGroup=pickup:pickup-7&workflowProgressGroup=submission:submission-9']}>
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

    expect(screen.getByLabelText('Directory Search')).toHaveValue('amp');
    expect(screen.getByLabelText('Directory Status')).toHaveValue('Ready');
    expect(screen.getByLabelText('Pending Review Search')).toHaveValue('mcintosh');
    expect(screen.getByLabelText('Workflow Progress Search')).toHaveValue('marantz');
    expect(screen.getByLabelText('Post Publish Search')).toHaveValue('shipped');
    expect(screen.getByTestId('pending-focused-group')).toHaveTextContent('pickup:pickup-7');
    expect(screen.getByTestId('progress-focused-group')).toHaveTextContent('submission:submission-9');
    expect(screen.getByTestId('pending-sort-mode')).toHaveTextContent('newest');
    expect(screen.getByTestId('progress-sort-mode')).toHaveTextContent('oldest');
    expect(screen.getByTestId('post-publish-sort-mode')).toHaveTextContent('sku');
    expect(screen.getByRole('button', { name: 'Reset Workflow View' })).toBeInTheDocument();
    expect(screen.getByText('Pending review: mcintosh')).toBeInTheDocument();
    expect(screen.getByText('Progress: marantz')).toBeInTheDocument();
    expect(screen.getByText('Post-publish: shipped')).toBeInTheDocument();
    expect(screen.getByText('Pending group: pickup:pickup-7')).toBeInTheDocument();
    expect(screen.getByText('Progress group: submission:submission-9')).toBeInTheDocument();
    expect(screen.getByText('Bucket: Active Listings')).toBeInTheDocument();
    expect(screen.getByText('Pending sort: Newest First')).toBeInTheDocument();
    expect(screen.getByText('Progress sort: Oldest First')).toBeInTheDocument();
    expect(screen.getByText('Post-publish sort: SKU')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Directory Search'), { target: { value: 'receiver' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('inventoryDirectorySearch=receiver');
      expect(screen.getByTestId('location-state')).toHaveTextContent('inventoryDirectoryStatus=Ready');
    });

    fireEvent.change(screen.getByLabelText('Directory Status'), { target: { value: 'Sold' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('inventoryDirectoryStatus=Sold');
    });

    fireEvent.change(screen.getByLabelText('Pending Review Search'), { target: { value: 'fisher' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/inventory?inventoryDirectorySearch=receiver&inventoryDirectoryStatus=Sold&workflowPendingReviewSearch=fisher&workflowProgressSearch=marantz&workflowPostPublishSearch=shipped&workflowPostPublishBucket=active-listing&workflowPendingReviewSort=newest&workflowProgressSort=oldest&workflowPostPublishSort=sku&workflowPendingReviewGroup=pickup%3Apickup-7&workflowProgressGroup=submission%3Asubmission-9#used-gear-pending-review');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Focus Pending Group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Focus Progress Group' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPendingReviewGroup=pickup%3Apickup-42');
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowProgressGroup=submission%3Asubmission-22');
    });

    fireEvent.change(screen.getByLabelText('Post Publish Search'), { target: { value: 'mcintosh' } });

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPostPublishSearch=mcintosh');
      expect(screen.getByTestId('location-state')).toHaveTextContent('#used-gear-post-publish');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Focus Sold Ready' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPostPublishBucket=sold-ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sort Pending Newest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sort Progress Oldest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sort Post Publish SKU' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPendingReviewSort=newest');
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowProgressSort=oldest');
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPostPublishSort=sku');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear pending review group focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear progress queue group focus' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).not.toHaveTextContent('workflowPendingReviewGroup=');
      expect(screen.getByTestId('location-state')).not.toHaveTextContent('workflowProgressGroup=');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear pending review search' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Pending Review Search')).toHaveValue('');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear progress queue search' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear post-publish bucket filter' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).not.toHaveTextContent('workflowPostPublishBucket=');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copy Current Workflow View' }));

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(expect.stringContaining('/inventory?'));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset Workflow View' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/inventory');
      expect(screen.getByLabelText('Pending Review Search')).toHaveValue('');
      expect(screen.getByLabelText('Workflow Progress Search')).toHaveValue('');
      expect(screen.getByLabelText('Post Publish Search')).toHaveValue('');
      expect(screen.getByLabelText('Directory Search')).toHaveValue('receiver');
      expect(screen.getByLabelText('Directory Status')).toHaveValue('Sold');
      expect(screen.getByTestId('pending-focused-group')).toHaveTextContent('');
      expect(screen.getByTestId('progress-focused-group')).toHaveTextContent('');
    });
  });

  it('defaults processor inventory routes to pending review when no workflow state is present', async () => {
    render(
      <MemoryRouter initialEntries={['/inventory']}>
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
      expect(screen.getByTestId('location-state').textContent).toBe('/inventory#used-gear-pending-review');
    });
  });

  it('keeps the workflow summary bar sticky when workflow filters are active', async () => {
    render(
      <MemoryRouter initialEntries={['/inventory?workflowPendingReviewSearch=mcintosh']}>
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

    const workflowFiltersHeading = screen.getAllByText('Workflow filters')[0]!;
    const stickyPanel = workflowFiltersHeading.closest('div[class*="sticky"]');
    expect(stickyPanel).not.toBeNull();
    expect(stickyPanel?.className).toContain('sticky');
  });

  it('keeps workflow sections available when the inventory directory load fails', async () => {
    loadInventoryDirectoryMock.mockRejectedValue(new Error('Failed to load Airtable records from tblInventory.'));

    render(
      <MemoryRouter initialEntries={['/inventory#used-gear-post-publish']}>
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
    expect(screen.getByLabelText('Pending Review Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Workflow Progress Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Post Publish Search')).toBeInTheDocument();
    expect(screen.getByTestId('location-state')).toHaveTextContent('/inventory#used-gear-post-publish');
  });
});