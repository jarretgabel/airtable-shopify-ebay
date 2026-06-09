import { useEffect, useMemo, useState } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { SecondaryActionButton } from '@/components/app/SecondaryActionButton';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { InventoryDirectoryListSection } from '@/components/tabs/airtable/InventoryDirectoryListSection';
import { groupUsedGearWorkflowRecords, isParkingLotArrivalStageStatus, loadWorkflowHubDirectory } from '@/services/usedGearQueue';
import { getInventoryDirectorySku, getInventoryDirectoryStatus, getInventoryDirectoryTitle } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

type IntakeDirectorySource = 'JotForm' | 'Manual Entry';

const INTAKE_DIRECTORY_WORKFLOW_STATUSES = new Set([
  'Pending Review',
  'Accepted - Awaiting Arrival',
  'Accepted - Arrived, Awaiting SKU',
  'Accepted - Arrived, Awaiting Missing Item',
]);

interface UsedGearWorkflowSourceDirectoryPageProps {
  title: string;
  detail?: string;
  workflowSource: IntakeDirectorySource;
  onOpenRecord: (recordId: string) => void;
  onOpenGroup?: (groupId: string, routeKind: 'pending-review' | 'arrival-stage') => void;
  createActionLabel?: string;
  onCreateAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

type WorkflowSourceDirectoryEntry = AirtableRecord & {
  fields: AirtableRecord['fields'] & {
    '__directoryEntryKind'?: 'record' | 'group';
    '__directoryGroupRouteKind'?: 'pending-review' | 'arrival-stage';
    '__directoryItemLabel'?: string;
    '__directorySearchText'?: string;
  };
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDirectoryShortRecordId(recordId: string): string {
  const trimmedRecordId = recordId.trim();
  const normalizedRecordId = trimmedRecordId.replace(/^rec[-_]?/i, '');
  if (!normalizedRecordId) {
    return trimmedRecordId;
  }

  return normalizedRecordId.slice(-6);
}

function getWorkflowSourceDirectoryItemLabel(record: AirtableRecord): string {
  const itemTitle = getInventoryDirectoryTitle(record.fields).trim();
  if (!itemTitle) {
    return '';
  }

  const normalizedRecordId = record.id.trim().replace(/^rec[-_]?/i, '');
  const shortRecordId = buildDirectoryShortRecordId(record.id);
  if (!normalizedRecordId || !shortRecordId || normalizedRecordId === shortRecordId) {
    return itemTitle;
  }

  const normalizedSuffixPattern = new RegExp(`${escapeRegExp(normalizedRecordId)}$`);
  return normalizedSuffixPattern.test(itemTitle)
    ? itemTitle.replace(normalizedSuffixPattern, shortRecordId)
    : itemTitle;
}

function isSourceDirectoryIntakeRecord(record: AirtableRecord): boolean {
  const workflowStatus = getInventoryDirectoryStatus(record.fields);
  const sku = getInventoryDirectorySku(record.fields);

  return INTAKE_DIRECTORY_WORKFLOW_STATUSES.has(workflowStatus) && sku.length === 0;
}

function isPendingReviewStatus(status: string): boolean {
  return status === 'Pending Review';
}

function getDirectoryGroupRouteKind(records: AirtableRecord[]): 'pending-review' | 'arrival-stage' | null {
  if (records.length < 2) {
    return null;
  }

  const statuses = records.map((record) => getInventoryDirectoryStatus(record.fields));
  if (statuses.every((status) => isPendingReviewStatus(status))) {
    return 'pending-review';
  }

  if (statuses.every((status) => isParkingLotArrivalStageStatus(status))) {
    return 'arrival-stage';
  }

  return null;
}

function buildGroupDirectoryEntry(groupId: string, routeKind: 'pending-review' | 'arrival-stage', records: AirtableRecord[]): WorkflowSourceDirectoryEntry {
  const representativeRecord = [...records].sort((left, right) => getRecordIntakeTimestamp(right) - getRecordIntakeTimestamp(left))[0] ?? records[0]!;
  const itemLabel = `${groupId} (${records.length} items)`;
  const workflowStatus = routeKind === 'arrival-stage' ? 'Arrival-Stage Group' : 'Pending Review Group';

  return {
    ...representativeRecord,
    id: groupId,
    fields: {
      ...representativeRecord.fields,
      'Item Title': itemLabel,
      'Workflow Status': workflowStatus,
      '__directoryEntryKind': 'group',
      '__directoryGroupRouteKind': routeKind,
      '__directoryItemLabel': itemLabel,
      '__directorySearchText': records.map((record) => JSON.stringify(record.fields)).join(' '),
    },
  };
}

function isGroupDirectoryEntry(record: WorkflowSourceDirectoryEntry): boolean {
  return record.fields.__directoryEntryKind === 'group';
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
  onOpenGroup,
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
              setError(loadError instanceof Error ? loadError.message : 'Unable to load workflow directory rows.');
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
    () => records.filter((record) => record.fields['Workflow Source'] === workflowSource && isSourceDirectoryIntakeRecord(record)),
    [records, workflowSource],
  );

  const directoryEntries = useMemo<WorkflowSourceDirectoryEntry[]>(() => {
    const groups = groupUsedGearWorkflowRecords(sourceRecords);
    const entries: WorkflowSourceDirectoryEntry[] = [];

    groups.forEach((group) => {
      const routeKind = getDirectoryGroupRouteKind(group.records);
      if (routeKind) {
        entries.push(buildGroupDirectoryEntry(group.id, routeKind, group.records));
        return;
      }

      group.records.forEach((record) => {
        entries.push({
          ...record,
          fields: {
            ...record.fields,
            '__directoryEntryKind': 'record',
          },
        });
      });
    });

    return entries;
  }, [sourceRecords]);

  const statusOptions = useMemo(
    () => Array.from(new Set(
      directoryEntries
        .map((record) => getInventoryDirectoryStatus(record.fields))
        .filter((value): value is string => value.trim().length > 0),
    )).sort((left, right) => left.localeCompare(right)),
    [directoryEntries],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const matchingRecords = directoryEntries.filter((record) => {
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
  }, [directoryEntries, searchTerm, sortMode, statusFilter]);

  const refreshDirectory = async () => {
    setRefreshing(true);
    setError(null);

    try {
      setRecords(await loadWorkflowHubDirectory());
    } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh workflow directory rows.');
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
          title={`No ${workflowSource} workflow rows found`}
          message={`The workflow table currently has no ${workflowSource} rows.`}
        />
      ) : null}

      {loading && sourceRecords.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              Loading workflow directory...
        </div>
      ) : null}

      {sourceRecords.length > 0 ? (
        <InventoryDirectoryListSection
          records={filteredRecords}
          totalCount={directoryEntries.length}
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
          onSelectRecord={(recordId) => {
            const selectedEntry = directoryEntries.find((record) => record.id === recordId) ?? null;
            if (selectedEntry && isGroupDirectoryEntry(selectedEntry) && onOpenGroup) {
              const routeKind = selectedEntry.fields.__directoryGroupRouteKind;
              if (routeKind === 'pending-review' || routeKind === 'arrival-stage') {
                onOpenGroup(recordId, routeKind);
                return;
              }
            }

            onOpenRecord(recordId);
          }}
          selectRecordLabel="Open Intake Review"
          searchAriaLabel={`Search ${title}`}
          searchPlaceholder="Search by SKU, make, model, or status"
          refreshLabel={`Refresh ${title}`}
          refreshLoadingLabel={`Refreshing ${title}`}
          resultLabel="workflow rows"
          emptyMessage="No workflow rows match the current search and status filters."
          getItemLabel={(record) => {
            const customLabel = typeof record.fields.__directoryItemLabel === 'string' ? record.fields.__directoryItemLabel : '';
            if (customLabel) {
              return customLabel;
            }

            if (workflowSource === 'Manual Entry') {
              return getWorkflowSourceDirectoryItemLabel(record);
            }

            return getInventoryDirectoryTitle(record.fields);
          }}
        />
      ) : null}
    </AppPageLayout>
  );
}