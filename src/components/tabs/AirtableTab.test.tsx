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
    onSearchTermChange,
    collapsedGroupIds = [],
    onCollapsedGroupIdsChange,
    sortMode = 'group-label',
    onSortModeChange,
  }: {
    searchTerm?: string;
    onSearchTermChange?: (value: string) => void;
    collapsedGroupIds?: string[];
    onCollapsedGroupIdsChange?: (groupIds: string[]) => void;
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
      <div data-testid="pending-sort-mode">{sortMode}</div>
      <div data-testid="pending-collapsed-groups">{collapsedGroupIds.join('|')}</div>
      <button type="button" onClick={() => onCollapsedGroupIdsChange?.(['pickup-1'])}>Collapse Pending Group</button>
      <button type="button" onClick={() => onCollapsedGroupIdsChange?.([])}>Expand Pending Groups</button>
      <button type="button" onClick={() => onSortModeChange?.('newest')}>Sort Pending Newest</button>
    </div>
  ),
}));

vi.mock('@/components/tabs/airtable/UsedGearWorkflowProgressSection', () => ({
  UsedGearWorkflowProgressSection: ({
    searchTerm = '',
    onSearchTermChange,
    collapsedGroupIds = [],
    onCollapsedGroupIdsChange,
    sortMode = 'group-label',
    onSortModeChange,
  }: {
    searchTerm?: string;
    onSearchTermChange?: (value: string) => void;
    collapsedGroupIds?: string[];
    onCollapsedGroupIdsChange?: (groupIds: string[]) => void;
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
      <div data-testid="progress-sort-mode">{sortMode}</div>
      <div data-testid="progress-collapsed-groups">{collapsedGroupIds.join('|')}</div>
      <button type="button" onClick={() => onCollapsedGroupIdsChange?.(['submission-2'])}>Collapse Progress Group</button>
      <button type="button" onClick={() => onCollapsedGroupIdsChange?.([])}>Expand Progress Groups</button>
      <button type="button" onClick={() => onSortModeChange?.('oldest')}>Sort Progress Oldest</button>
    </div>
  ),
}));

vi.mock('@/components/tabs/airtable/UsedGearWorkflowPostPublishSection', () => ({
  UsedGearWorkflowPostPublishSection: ({
    searchTerm = '',
    onSearchTermChange,
    onFocusedBucketChange,
    collapsedSectionKeys = [],
    onCollapsedSectionKeysChange,
    sortMode = 'latest-activity',
    onSortModeChange,
  }: {
    searchTerm?: string;
    onSearchTermChange?: (value: string) => void;
    onFocusedBucketChange?: (bucket: 'all' | 'active-listing' | 'stale-listing' | 'sold-ready' | 'shipped') => void;
    collapsedSectionKeys?: string[];
    onCollapsedSectionKeysChange?: (keys: Array<'active-listing' | 'stale-listing' | 'sold-ready' | 'shipped'>) => void;
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
      <div data-testid="post-publish-collapsed-sections">{collapsedSectionKeys.join('|')}</div>
      <button type="button" onClick={() => onFocusedBucketChange?.('sold-ready')}>Focus Sold Ready</button>
      <button type="button" onClick={() => onCollapsedSectionKeysChange?.(['stale-listing'])}>Collapse Post Publish Section</button>
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
      <MemoryRouter initialEntries={['/inventory?inventoryDirectorySearch=amp&inventoryDirectoryStatus=Ready&workflowPendingReviewSearch=mcintosh&workflowProgressSearch=marantz&workflowPostPublishSearch=shipped&workflowPendingReviewCollapsedGroups=pickup-7&workflowProgressCollapsedGroups=submission-9&workflowPostPublishCollapsedSections=stale-listing&workflowPostPublishBucket=active-listing&workflowPendingReviewSort=newest&workflowProgressSort=oldest&workflowPostPublishSort=sku']}>
        <AirtableTab
          viewModel={{
            loading: false,
            error: null,
            listings: [],
            displayValue: (value) => String(value ?? ''),
            hasValue: (value) => value !== null && value !== undefined && value !== '',
            recordTitle: () => 'Inventory Record',
          }}
          currentUserName="Taylor Reviewer"
          onAddNewRecord={vi.fn()}
          onOpenIncomingGearForm={vi.fn()}
          onOpenTestingForm={vi.fn()}
          onOpenPhotosForm={vi.fn()}
          onOpenWorkflowRecord={vi.fn()}
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
    expect(screen.getByTestId('pending-sort-mode')).toHaveTextContent('newest');
    expect(screen.getByTestId('progress-sort-mode')).toHaveTextContent('oldest');
    expect(screen.getByTestId('post-publish-sort-mode')).toHaveTextContent('sku');
    expect(screen.getByTestId('pending-collapsed-groups')).toHaveTextContent('pickup-7');
    expect(screen.getByTestId('progress-collapsed-groups')).toHaveTextContent('submission-9');
    expect(screen.getByTestId('post-publish-collapsed-sections')).toHaveTextContent('stale-listing');
    expect(screen.getByRole('button', { name: 'Reset Workflow View' })).toBeInTheDocument();
    expect(screen.getByText('Pending review: mcintosh')).toBeInTheDocument();
    expect(screen.getByText('Progress: marantz')).toBeInTheDocument();
    expect(screen.getByText('Post-publish: shipped')).toBeInTheDocument();
    expect(screen.getByText('Pending groups collapsed: 1')).toBeInTheDocument();
    expect(screen.getByText('Progress groups collapsed: 1')).toBeInTheDocument();
    expect(screen.getByText('Bucket: Active Listings')).toBeInTheDocument();
    expect(screen.getByText('Buckets collapsed: 1')).toBeInTheDocument();
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
      expect(screen.getByTestId('location-state')).toHaveTextContent('/inventory?inventoryDirectorySearch=receiver&inventoryDirectoryStatus=Sold&workflowPendingReviewSearch=fisher&workflowProgressSearch=marantz&workflowPostPublishSearch=shipped&workflowPendingReviewCollapsedGroups=pickup-7&workflowProgressCollapsedGroups=submission-9&workflowPostPublishCollapsedSections=stale-listing&workflowPostPublishBucket=active-listing&workflowPendingReviewSort=newest&workflowProgressSort=oldest&workflowPostPublishSort=sku#used-gear-pending-review');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Pending Group' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPendingReviewCollapsedGroups=pickup-1');
      expect(screen.getByTestId('pending-collapsed-groups')).toHaveTextContent('pickup-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Progress Group' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowProgressCollapsedGroups=submission-2');
      expect(screen.getByTestId('progress-collapsed-groups')).toHaveTextContent('submission-2');
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

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Post Publish Section' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPostPublishCollapsedSections=stale-listing');
      expect(screen.getByTestId('post-publish-collapsed-sections')).toHaveTextContent('stale-listing');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sort Pending Newest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sort Progress Oldest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sort Post Publish SKU' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPendingReviewSort=newest');
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowProgressSort=oldest');
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPostPublishSort=sku');
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
      expect(screen.getByTestId('pending-collapsed-groups')).toHaveTextContent('');
      expect(screen.getByTestId('progress-collapsed-groups')).toHaveTextContent('');
      expect(screen.getByTestId('post-publish-collapsed-sections')).toHaveTextContent('');
    });
  });

  it('saves, reapplies, and deletes named workflow view presets', async () => {
    render(
      <MemoryRouter initialEntries={['/inventory?workflowPendingReviewSearch=mcintosh&workflowProgressSearch=marantz&workflowPostPublishBucket=stale-listing#used-gear-post-publish']}>
        <AirtableTab
          viewModel={{
            loading: false,
            error: null,
            listings: [],
            displayValue: (value) => String(value ?? ''),
            hasValue: (value) => value !== null && value !== undefined && value !== '',
            recordTitle: () => 'Inventory Record',
          }}
          currentUserName="Taylor Reviewer"
          onAddNewRecord={vi.fn()}
          onOpenIncomingGearForm={vi.fn()}
          onOpenTestingForm={vi.fn()}
          onOpenPhotosForm={vi.fn()}
          onOpenWorkflowRecord={vi.fn()}
          onOpenListingsRecord={vi.fn()}
          onSelectRecord={vi.fn()}
        />
        <LocationState />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(loadInventoryDirectoryMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Workflow view preset name'), { target: { value: 'Triage View' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Workflow View' }));

    expect(screen.getByRole('button', { name: 'Triage View' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Workflow View' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/inventory');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Triage View' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPendingReviewSearch=mcintosh');
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowProgressSearch=marantz');
      expect(screen.getByTestId('location-state')).toHaveTextContent('workflowPostPublishBucket=stale-listing');
      expect(screen.getByTestId('location-state')).toHaveTextContent('#used-gear-post-publish');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Triage View workflow view' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Triage View' })).not.toBeInTheDocument();
    });
  });
});