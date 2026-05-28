import { useEffect, useMemo, useState } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { SecondaryActionButton } from '@/components/app/SecondaryActionButton';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { InventoryDirectoryListSection } from '@/components/tabs/airtable/InventoryDirectoryListSection';
import { loadWorkflowHubDirectory } from '@/services/usedGearQueue';
import { isParkingLotStatus } from '@/services/usedGearQueue';
import { getInventoryDirectoryStatus } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

type IntakeDirectorySource = 'JotForm' | 'Manual Entry';

interface UsedGearWorkflowSourceDirectoryPageProps {
  title: string;
  detail?: string;
  workflowSource: IntakeDirectorySource;
  onOpenRecord: (recordId: string) => void;
  createActionLabel?: string;
  onCreateAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
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

export function UsedGearWorkflowSourceDirectoryPage({
  title,
  detail,
  workflowSource,
  onOpenRecord,
  createActionLabel,
  onCreateAction,
  secondaryActionLabel,
  onSecondaryAction,
}: UsedGearWorkflowSourceDirectoryPageProps) {
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'intake-newest' | 'intake-oldest'>('intake-newest');

  useEffect(() => {
    let cancelled = false;

    const loadRecords = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextRecords = await loadWorkflowHubDirectory();
        if (!cancelled) {
          setRecords(nextRecords);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load intake directory rows.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, []);

  const sourceRecords = useMemo(
    () => records.filter((record) => (
      record.fields['Workflow Source'] === workflowSource
      && isParkingLotStatus(getInventoryDirectoryStatus(record.fields))
    )),
    [records, workflowSource],
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(
      sourceRecords
        .map((record) => getInventoryDirectoryStatus(record.fields))
        .filter((value): value is string => value.trim().length > 0),
    )).sort((left, right) => left.localeCompare(right)),
    [sourceRecords],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const matchingRecords = sourceRecords.filter((record) => {
      const status = getInventoryDirectoryStatus(record.fields);
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return JSON.stringify(record.fields).toLowerCase().includes(normalizedSearch);
    });

    return [...matchingRecords].sort((left, right) => {
      const leftTimestamp = getRecordIntakeTimestamp(left);
      const rightTimestamp = getRecordIntakeTimestamp(right);
      return sortMode === 'intake-oldest'
        ? leftTimestamp - rightTimestamp
        : rightTimestamp - leftTimestamp;
    });
  }, [searchTerm, sortMode, sourceRecords, statusFilter]);

  const refreshDirectory = async () => {
    setRefreshing(true);
    setError(null);

    try {
      setRecords(await loadWorkflowHubDirectory());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh intake directory rows.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow="Intake"
        title={title}
        detail={detail}
        actions={createActionLabel && onCreateAction ? (
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryActionButton onClick={onCreateAction}>{createActionLabel}</SecondaryActionButton>
            {secondaryActionLabel && onSecondaryAction ? (
              <SecondaryActionButton onClick={onSecondaryAction}>{secondaryActionLabel}</SecondaryActionButton>
            ) : null}
          </div>
        ) : secondaryActionLabel && onSecondaryAction ? (
          <SecondaryActionButton onClick={onSecondaryAction}>{secondaryActionLabel}</SecondaryActionButton>
        ) : undefined}
      />

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && sourceRecords.length === 0 ? (
        <EmptySurface
          title={`No ${workflowSource} intake-stage rows found`}
          message={`The workflow table currently has no ${workflowSource} rows in the intake-stage workflow statuses.`}
        />
      ) : null}

      {loading && sourceRecords.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          Loading intake directory...
        </div>
      ) : null}

      {sourceRecords.length > 0 ? (
        <InventoryDirectoryListSection
          records={filteredRecords}
          totalCount={sourceRecords.length}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          sortMode={sortMode}
          statusOptions={statusOptions}
          refreshing={refreshing}
          onSearchTermChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onSortModeChange={setSortMode}
          onRefresh={() => {
            void refreshDirectory();
          }}
          onSelectRecord={onOpenRecord}
          selectRecordLabel="Open Intake Record"
          searchAriaLabel={`Search ${title}`}
          searchPlaceholder="Search by SKU, make, model, or status"
          refreshLabel={`Refresh ${title}`}
          refreshLoadingLabel={`Refreshing ${title}`}
          resultLabel="intake rows"
          emptyMessage="No intake rows match the current search and status filters."
        />
      ) : null}
    </AppPageLayout>
  );
}