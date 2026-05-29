import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AirtableTabViewModel } from '@/app/appTabViewModels';
import { navLabel } from '@/app/appNavigation';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { InventoryDirectoryListSection } from '@/components/tabs/airtable/InventoryDirectoryListSection';
import {
  getInventoryDirectoryItemLabel,
  getInventoryDirectorySku,
  getInventoryDirectoryStatus,
} from '@/services/inventoryDirectory';
import { resolveUsedGearOperationalPath } from '@/services/usedGearOperationalRouting';
import { loadWorkflowHubDirectory } from '@/services/usedGearQueue';
import type { UserRole } from '@/stores/auth/authTypes';
import type { AirtableRecord } from '@/types/airtable';

const INVENTORY_DIRECTORY_SEARCH_PARAM = 'inventoryDirectorySearch';
const INVENTORY_DIRECTORY_STATUS_PARAM = 'inventoryDirectoryStatus';
const INVENTORY_DIRECTORY_SORT_PARAM = 'inventoryDirectorySort';

type InventoryDirectorySortMode = 'intake-newest' | 'intake-oldest';

const WORKFLOW_HUB_INTAKE_EDIT_BLOCKED_STATUSES = new Set([
  'Approved for Publish',
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
  'Sold - Ready to Ship',
  'Shipped',
]);

function parseInventoryDirectorySortMode(search: string): InventoryDirectorySortMode {
  const value = new URLSearchParams(search).get(INVENTORY_DIRECTORY_SORT_PARAM);
  return value === 'intake-oldest' ? value : 'intake-newest';
}

function getRecordIntakeTimestamp(record: AirtableRecord): number {
  const arrivalDate = typeof record.fields['Arrival Date'] === 'string' ? record.fields['Arrival Date'].trim() : '';
  const parsedArrival = arrivalDate ? Date.parse(arrivalDate) : Number.NaN;
  if (Number.isFinite(parsedArrival)) {
    return parsedArrival;
  }

  const createdTime = Date.parse(record.createdTime);
  return Number.isFinite(createdTime) ? createdTime : Number.POSITIVE_INFINITY;
}

interface AirtableTabProps {
  viewModel: AirtableTabViewModel;
  currentUserRole: UserRole;
  currentUserName: string;
  onAddNewRecord: () => void;
  onOpenManualIntake: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onSelectRecord: (recordId: string) => void;
}

export function AirtableTab({
  viewModel,
  onOpenManualIntake,
  onOpenOperationalRecord,
  onSelectRecord,
}: AirtableTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(viewModel.error?.message ?? null);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryRefreshing, setDirectoryRefreshing] = useState(false);
  const inventoryDirectorySearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(INVENTORY_DIRECTORY_SEARCH_PARAM) ?? '';
  }, [location.search]);
  const inventoryDirectoryStatusFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(INVENTORY_DIRECTORY_STATUS_PARAM) ?? 'all';
  }, [location.search]);
  const inventoryDirectorySortMode = useMemo(() => parseInventoryDirectorySortMode(location.search), [location.search]);

  const updateInventoryDirectoryRouteState = (update: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: '',
    }, { replace: true });
  };

  const handleInventoryDirectorySearchChange = (value: string) => {
    updateInventoryDirectoryRouteState((params) => {
      if (value.trim().length === 0) {
        params.delete(INVENTORY_DIRECTORY_SEARCH_PARAM);
      } else {
        params.set(INVENTORY_DIRECTORY_SEARCH_PARAM, value);
      }
    });
  };

  const handleInventoryDirectoryStatusFilterChange = (value: string) => {
    updateInventoryDirectoryRouteState((params) => {
      if (value === 'all') {
        params.delete(INVENTORY_DIRECTORY_STATUS_PARAM);
      } else {
        params.set(INVENTORY_DIRECTORY_STATUS_PARAM, value);
      }
    });
  };

  const handleInventoryDirectorySortModeChange = (value: InventoryDirectorySortMode) => {
    updateInventoryDirectoryRouteState((params) => {
      if (value === 'intake-newest') {
        params.delete(INVENTORY_DIRECTORY_SORT_PARAM);
      } else {
        params.set(INVENTORY_DIRECTORY_SORT_PARAM, value);
      }
    });
  };

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search);
    let changed = false;

    [
      'workflowPendingReviewSearch',
      'workflowProgressSearch',
      'workflowPendingReviewGroup',
      'workflowProgressGroup',
      'workflowPendingReviewSort',
      'workflowProgressSort',
    ].forEach((paramName) => {
      if (nextParams.has(paramName)) {
        nextParams.delete(paramName);
        changed = true;
      }
    });

    const shouldClearHash = location.hash === '#used-gear-pending-review' || location.hash === '#used-gear-progress-queue';
    if (!changed && !shouldClearHash) {
      return;
    }

    navigate({
      pathname: location.pathname,
      search: nextParams.toString() ? `?${nextParams.toString()}` : '',
      hash: shouldClearHash ? '' : location.hash,
    }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadDirectoryData = async () => {
      setDirectoryLoading(true);
      setDirectoryError(null);

      try {
        const data = await loadWorkflowHubDirectory();
        if (cancelled) return;
        setRecords(data);
      } catch (error) {
        if (cancelled) return;
        setDirectoryError(error instanceof Error ? error.message : 'Unable to load the Workflow Hub directory.');
      } finally {
        if (!cancelled) {
          setDirectoryLoading(false);
        }
      }
    };

    void loadDirectoryData();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusOptions = useMemo(
    () => Array.from(new Set(records
      .map((record) => getInventoryDirectoryStatus(record.fields))
      .filter((value): value is string => value.trim().length > 0)))
      .sort((left, right) => left.localeCompare(right)),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = inventoryDirectorySearch.trim().toLowerCase();

    const nextRecords = records.filter((record) => {
      const status = getInventoryDirectoryStatus(record.fields);
      if (inventoryDirectoryStatusFilter !== 'all' && status !== inventoryDirectoryStatusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        getInventoryDirectorySku(record.fields),
        getInventoryDirectoryItemLabel(record.fields),
        record.fields['Component Type'],
        status,
      ]
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    if (inventoryDirectorySortMode === 'intake-oldest') {
      return [...nextRecords].sort((left, right) => getRecordIntakeTimestamp(left) - getRecordIntakeTimestamp(right));
    }

    return [...nextRecords].sort((left, right) => getRecordIntakeTimestamp(right) - getRecordIntakeTimestamp(left));
  }, [inventoryDirectorySearch, inventoryDirectorySortMode, inventoryDirectoryStatusFilter, records]);

  const loadDirectoryData = async () => {
    setDirectoryRefreshing(true);
    setDirectoryError(null);

    try {
      const data = await loadWorkflowHubDirectory();
      setRecords(data);
    } catch (error) {
      setDirectoryError(error instanceof Error ? error.message : 'Unable to refresh the Workflow Hub directory.');
    } finally {
      setDirectoryRefreshing(false);
    }
  };

  const getWorkflowHubIntakeEditLabel = (record: AirtableRecord): string | null => {
    const status = getInventoryDirectoryStatus(record.fields ?? {});
    return WORKFLOW_HUB_INTAKE_EDIT_BLOCKED_STATUSES.has(status) ? null : 'Edit Intake';
  };

  const getWorkflowHubNextStepLabel = (record: AirtableRecord): string => {
    const nextPath = resolveUsedGearOperationalPath(record.id, record.fields);

    if (nextPath.startsWith('/parking-lot/arrival/')) {
      return 'Open Parking Lot';
    }

    if (nextPath.startsWith('/parking-lot/')) {
      return 'Open Parking Lot Review';
    }

    if (nextPath.startsWith('/testing/')) {
      return 'Open Testing';
    }

    if (nextPath.startsWith('/photography/')) {
      return 'Open Photography';
    }

    if (nextPath.startsWith('/trash-review/')) {
      return 'Open Trash Review';
    }

    if (nextPath.startsWith('/listings/')) {
      return 'Open Listings';
    }

    return 'Open Next Step';
  };

  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow="Processing"
        title={navLabel('inventory')}
      />

      {directoryError ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {directoryError}
        </div>
      ) : null}

      <section id="inventory-directory-list" className="space-y-4">
        {directoryLoading && records.length === 0 ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            Loading Workflow Hub directory...
          </div>
        ) : null}

        {directoryError && records.length === 0 ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-4 text-sm text-amber-200">
            <p className="m-0 font-semibold">Workflow Hub directory is currently unavailable.</p>
            <p className="mt-2 mb-0">{directoryError}</p>
          </div>
        ) : null}

          {!directoryLoading && !directoryError && records.length === 0 ? (
            <EmptySurface title="No workflow rows found" message="The Workflow Hub currently has no rows in this table.">
              <p className="mt-3 text-sm text-[var(--muted)]">
                Next route: start in Parking Lot for customer-submitted intake, or open Intake when staff needs to create the first manual operational row inside the app.
              </p>
            </EmptySurface>
          ) : null}

          {records.length > 0 ? (
            <InventoryDirectoryListSection
              records={filteredRecords}
              totalCount={records.length}
              searchTerm={inventoryDirectorySearch}
              statusFilter={inventoryDirectoryStatusFilter}
              sortMode={inventoryDirectorySortMode}
              statusOptions={statusOptions}
              refreshing={directoryRefreshing}
              onSearchTermChange={handleInventoryDirectorySearchChange}
              onStatusFilterChange={handleInventoryDirectoryStatusFilterChange}
              onSortModeChange={handleInventoryDirectorySortModeChange}
              onRefresh={() => {
                void loadDirectoryData();
              }}
              getNextStepLabel={getWorkflowHubNextStepLabel}
              onOpenNextStep={(record) => onOpenOperationalRecord(record.id)}
              getSecondaryActionLabel={getWorkflowHubIntakeEditLabel}
              onOpenSecondaryAction={(record) => onOpenManualIntake(record.id)}
              secondaryActionIcon="edit"
              onSelectRecord={onSelectRecord}
            />
          ) : null}
        </section>
      </AppPageLayout>
  );
}
