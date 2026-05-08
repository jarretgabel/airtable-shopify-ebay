import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  assignWorkflowOwner,
  assignWorkflowOwnerBatch,
  clearWorkflowOwner,
  clearWorkflowOwnerBatch,
  loadWorkflowPostPublishQueue,
  markWorkflowRelisted,
  markWorkflowListingStale,
  markWorkflowRowsShipped,
  markWorkflowRowsSoldReadyToShip,
  saveWorkflowStaleRecovery,
  markWorkflowShipped,
  markWorkflowSoldReadyToShip,
} from '@/services/usedGearQueue';
import {
  getUsedGearWorkflowPostPublishSnapshot,
  isUsedGearWorkflowStaleRecoveryStatus,
  USED_GEAR_STALE_THRESHOLD_DAYS,
  USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS,
  type UsedGearWorkflowStaleRecoveryStatus,
  type UsedGearWorkflowPostPublishBucket,
  type UsedGearWorkflowPostPublishOwnerFilter,
} from '@/services/usedGearWorkflowLifecycle';
import {
  buildPostPublishQueueAgingSummary,
  formatUsedGearAgeDays,
} from '@/services/usedGearWorkflowAging';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearWorkflowPostPublishSectionProps {
  currentUserName: string;
  focusedBucket?: UsedGearWorkflowPostPublishBucket | null;
  onFocusedBucketChange?: (bucket: UsedGearWorkflowPostPublishBucket | 'all') => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  historyFilter?: UsedGearWorkflowPostPublishHistoryFilter;
  onHistoryFilterChange?: (value: UsedGearWorkflowPostPublishHistoryFilter) => void;
  ownerFilter?: UsedGearWorkflowPostPublishOwnerFilter;
  onOwnerFilterChange?: (value: UsedGearWorkflowPostPublishOwnerFilter) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  collapsedSectionKeys?: UsedGearWorkflowPostPublishBucket[];
  onCollapsedSectionKeysChange?: (keys: UsedGearWorkflowPostPublishBucket[]) => void;
  sortMode?: UsedGearWorkflowPostPublishSortMode;
  onSortModeChange?: (value: UsedGearWorkflowPostPublishSortMode) => void;
}

export type UsedGearWorkflowPostPublishSortMode = 'latest-activity' | 'oldest-activity' | 'sku';
export type UsedGearWorkflowPostPublishHistoryFilter = 'all' | 'active-only' | 'history-only';

interface PostPublishSectionDefinition {
  key: UsedGearWorkflowPostPublishBucket;
  title: string;
  description: string;
}

function getPostPublishSectionEmptyGuidance(bucket: UsedGearWorkflowPostPublishBucket): string {
  switch (bucket) {
    case 'active-listing':
      return 'Next action: publish the next Approved for Publish row in Listings, or move to Stale Listings when a live marketplace item needs follow-up.';
    case 'stale-listing':
      return 'Next action: keep working Active Listings until an item ages into stale follow-up, or mark a listed row stale when the relist/recovery workflow needs to begin.';
    case 'sold-ready':
      return 'Next action: mark a listed or stale row Sold Ready To Ship after payment is confirmed, or return to Active Listings and Stale Listings for marketplace follow-through.';
    case 'shipped':
      return 'Next action: mark a Sold Ready To Ship row Shipped after fulfillment completes, or switch history mode back to active work when the team is triaging current lifecycle items.';
    default:
      return 'Next action: continue the next workflow handoff from Listings or the active lifecycle queue.';
  }
}

const SECTION_DEFINITIONS: PostPublishSectionDefinition[] = [
  {
    key: 'active-listing',
    title: 'Active Listings',
    description: `Live listings that are still inside the ${USED_GEAR_STALE_THRESHOLD_DAYS}-day freshness window.`,
  },
  {
    key: 'stale-listing',
    title: 'Stale Listings',
    description: `Listings at or beyond the ${USED_GEAR_STALE_THRESHOLD_DAYS}-day threshold, plus rows explicitly moved into the stale queue.`,
  },
  {
    key: 'sold-ready',
    title: 'Sold Ready To Ship',
    description: 'Sold items waiting for shipping completion.',
  },
  {
    key: 'shipped',
    title: 'Shipped History',
    description: 'Completed shipments retained for quick workflow lookup.',
  },
];

function normalizeStaleRecoveryStatus(value: unknown): UsedGearWorkflowStaleRecoveryStatus | '' {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return isUsedGearWorkflowStaleRecoveryStatus(normalized) ? normalized : '';
}

function recordSearchText(record: AirtableRecord): string {
  return [
    record.fields.SKU,
    record.fields.Make,
    record.fields.Model,
    record.fields['Workflow Status'],
    record.fields['Workflow Owner'],
    record.fields['Listed At'],
    record.fields['Submission Group ID'],
    record.fields['Pick Up ID'],
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function sortByLifecycleDate(left: AirtableRecord, right: AirtableRecord): number {
  const leftSnapshot = getUsedGearWorkflowPostPublishSnapshot(left);
  const rightSnapshot = getUsedGearWorkflowPostPublishSnapshot(right);
  const leftDate = leftSnapshot?.shippedAt ?? leftSnapshot?.soldReadyToShipAt ?? leftSnapshot?.staleListingAt ?? leftSnapshot?.listedAt ?? '';
  const rightDate = rightSnapshot?.shippedAt ?? rightSnapshot?.soldReadyToShipAt ?? rightSnapshot?.staleListingAt ?? rightSnapshot?.listedAt ?? '';

  return new Date(rightDate || 0).getTime() - new Date(leftDate || 0).getTime();
}

export function UsedGearWorkflowPostPublishSection({
  currentUserName,
  focusedBucket = null,
  onFocusedBucketChange,
  onOpenWorkflowRecord,
  onOpenListingsRecord,
  historyFilter = 'all',
  onHistoryFilterChange,
  ownerFilter = 'all',
  onOwnerFilterChange,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  collapsedSectionKeys: controlledCollapsedSectionKeys,
  onCollapsedSectionKeysChange,
  sortMode: controlledSortMode,
  onSortModeChange,
}: UsedGearWorkflowPostPublishSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const selectedBucket = focusedBucket ?? 'all';
  const { copyingLink, copiedLink, copyLink } = useCopyQueueLink({
    sectionId: 'used-gear-post-publish',
    successTitle: 'Queue link copied',
    successMessage: selectedBucket === 'all'
      ? 'The post-publish queue link is ready to share.'
      : 'The filtered post-publish queue link is ready to share.',
    unavailableMessage: 'This browser cannot copy the post-publish queue link automatically.',
    failureMessage: 'The post-publish queue link could not be copied. Try again or copy the URL from the browser address bar.',
  });
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [uncontrolledCollapsedSectionKeys, setUncontrolledCollapsedSectionKeys] = useState<UsedGearWorkflowPostPublishBucket[]>([]);
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearWorkflowPostPublishSortMode>('latest-activity');
  const [actionRecordId, setActionRecordId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [staleRecoveryStatuses, setStaleRecoveryStatuses] = useState<Record<string, UsedGearWorkflowStaleRecoveryStatus | ''>>({});
  const [staleRecoveryNotes, setStaleRecoveryNotes] = useState<Record<string, string>>({});
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const collapsedSectionKeys = Array.isArray(controlledCollapsedSectionKeys)
    ? controlledCollapsedSectionKeys
    : uncontrolledCollapsedSectionKeys;
  const sortMode = controlledSortMode ?? uncontrolledSortMode;

  useEffect(() => {
    if (!focusedBucket || !sectionRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [focusedBucket]);

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextRecords = await loadWorkflowPostPublishQueue();
        if (!cancelled) {
          setRecords(nextRecords);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the used-gear post-publish queue.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const workflowOwner = typeof record.fields['Workflow Owner'] === 'string' ? record.fields['Workflow Owner'].trim() : '';

      if (ownerFilter === 'mine' && workflowOwner !== currentUserName) {
        return false;
      }

      if (ownerFilter === 'unassigned' && workflowOwner.length > 0) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return recordSearchText(record).includes(normalizedSearch);
    });
  }, [currentUserName, ownerFilter, records, searchTerm]);
  const filteredRecordIdSet = useMemo(() => new Set(filteredRecords.map((record) => record.id)), [filteredRecords]);
  const selectedRecords = useMemo(
    () => filteredRecords.filter((record) => selectedRecordIds.includes(record.id)),
    [filteredRecords, selectedRecordIds],
  );
  const selectedSnapshots = useMemo(
    () => selectedRecords.map((record) => ({ record, snapshot: getUsedGearWorkflowPostPublishSnapshot(record) })).filter((entry) => entry.snapshot),
    [selectedRecords],
  );
  const unownedSoldReadyCount = useMemo(
    () => filteredRecords.filter((record) => {
      const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
      const owner = typeof record.fields['Workflow Owner'] === 'string' ? record.fields['Workflow Owner'].trim() : '';
      return snapshot?.bucket === 'sold-ready' && owner.length === 0;
    }).length,
    [filteredRecords],
  );
  const unownedStaleCount = useMemo(
    () => filteredRecords.filter((record) => {
      const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
      const owner = typeof record.fields['Workflow Owner'] === 'string' ? record.fields['Workflow Owner'].trim() : '';
      return snapshot?.bucket === 'stale-listing' && owner.length === 0;
    }).length,
    [filteredRecords],
  );

  const recordsBySection = useMemo(() => {
    const entries = SECTION_DEFINITIONS.map((section) => [section.key, [] as AirtableRecord[]] as const);
    const nextMap = new Map<UsedGearWorkflowPostPublishBucket, AirtableRecord[]>(entries);

    filteredRecords.forEach((record) => {
      const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
      if (!snapshot) return;
      nextMap.get(snapshot.bucket)?.push(record);
    });

    nextMap.forEach((bucketRecords) => bucketRecords.sort((left, right) => {
      if (sortMode === 'oldest-activity') {
        return sortByLifecycleDate(right, left);
      }
      if (sortMode === 'sku') {
        return displayInventoryValue(left.fields.SKU).localeCompare(displayInventoryValue(right.fields.SKU));
      }
      return sortByLifecycleDate(left, right);
    }));
    return nextMap;
  }, [filteredRecords, sortMode]);
  const agingSummary = useMemo(() => buildPostPublishQueueAgingSummary(filteredRecords), [filteredRecords]);
  const canBatchMarkSoldReady = selectedSnapshots.length > 0
    && selectedSnapshots.every((entry) => entry.snapshot?.bucket === 'active-listing' || entry.snapshot?.bucket === 'stale-listing');
  const canBatchMarkShipped = selectedSnapshots.length > 0
    && selectedSnapshots.every((entry) => entry.snapshot?.bucket === 'sold-ready');

  const visibleSections = useMemo(() => {
    const sectionDefinitions = historyFilter === 'active-only'
      ? SECTION_DEFINITIONS.filter((section) => section.key !== 'shipped')
      : historyFilter === 'history-only'
        ? SECTION_DEFINITIONS.filter((section) => section.key === 'shipped')
        : SECTION_DEFINITIONS;

    if (selectedBucket === 'all') {
      return sectionDefinitions;
    }

    return sectionDefinitions.filter((section) => section.key === selectedBucket);
  }, [historyFilter, selectedBucket]);
  const visibleSectionKeys = useMemo(
    () => visibleSections.map((section) => section.key),
    [visibleSections],
  );
  const collapsedSectionKeySet = useMemo(() => new Set(collapsedSectionKeys), [collapsedSectionKeys]);
  const allVisibleSectionsCollapsed = visibleSectionKeys.length > 0
    && visibleSectionKeys.every((sectionKey) => collapsedSectionKeySet.has(sectionKey));

  useEffect(() => {
    setSelectedRecordIds((current) => current.filter((recordId) => filteredRecordIdSet.has(recordId)));
  }, [filteredRecordIdSet]);

  const refreshQueue = async () => {
    setRefreshing(true);
    setError(null);

    try {
      setRecords(await loadWorkflowPostPublishQueue());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the used-gear post-publish queue.');
    } finally {
      setRefreshing(false);
    }
  };

  const replaceRecord = (updatedRecord: AirtableRecord) => {
    setRecords((currentRecords) => currentRecords.map((record) => record.id === updatedRecord.id ? updatedRecord : record));
    setStaleRecoveryStatuses((current) => ({
      ...current,
      [updatedRecord.id]: normalizeStaleRecoveryStatus(updatedRecord.fields['Stale Recovery Status']),
    }));
    setStaleRecoveryNotes((current) => ({
      ...current,
      [updatedRecord.id]: typeof updatedRecord.fields['Stale Recovery Notes'] === 'string' ? updatedRecord.fields['Stale Recovery Notes'] : '',
    }));
  };

  const replaceRecords = (updatedRecords: AirtableRecord[]) => {
    if (updatedRecords.length === 0) {
      return;
    }

    const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));
    setRecords((currentRecords) => currentRecords.map((record) => updatedById.get(record.id) ?? record));
    updatedRecords.forEach((record) => {
      setStaleRecoveryStatuses((current) => ({
        ...current,
        [record.id]: normalizeStaleRecoveryStatus(record.fields['Stale Recovery Status']),
      }));
      setStaleRecoveryNotes((current) => ({
        ...current,
        [record.id]: typeof record.fields['Stale Recovery Notes'] === 'string' ? record.fields['Stale Recovery Notes'] : '',
      }));
    });
  };

  const handleAction = async (recordId: string, action: () => Promise<AirtableRecord>) => {
    setActionRecordId(recordId);
    setError(null);

    try {
      replaceRecord(await action());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the selected workflow row.');
    } finally {
      setActionRecordId(null);
    }
  };

  const handleBatchAction = async (action: (recordIds: string[]) => Promise<AirtableRecord[]>) => {
    if (selectedRecordIds.length === 0) {
      return;
    }

    setBatchBusy(true);
    setError(null);

    try {
      replaceRecords(await action(selectedRecordIds));
      setSelectedRecordIds([]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the selected workflow rows.');
    } finally {
      setBatchBusy(false);
    }
  };

  const getDraftStaleRecoveryStatus = (record: AirtableRecord): UsedGearWorkflowStaleRecoveryStatus | '' => {
    if (typeof staleRecoveryStatuses[record.id] === 'string') {
      return staleRecoveryStatuses[record.id];
    }

    return normalizeStaleRecoveryStatus(record.fields['Stale Recovery Status']);
  };

  const getDraftStaleRecoveryNotes = (record: AirtableRecord): string => {
    if (typeof staleRecoveryNotes[record.id] === 'string') {
      return staleRecoveryNotes[record.id];
    }

    return typeof record.fields['Stale Recovery Notes'] === 'string' ? record.fields['Stale Recovery Notes'] : '';
  };

  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const handleSearchTermChange = (value: string) => {
    if (typeof controlledSearchTerm !== 'string') {
      setUncontrolledSearchTerm(value);
    }

    onSearchTermChange?.(value);
  };

  const handleOwnerFilterChange = (value: UsedGearWorkflowPostPublishOwnerFilter) => {
    onOwnerFilterChange?.(value);
  };

  const handleCollapsedSectionKeysChange = (keys: UsedGearWorkflowPostPublishBucket[]) => {
    if (!Array.isArray(controlledCollapsedSectionKeys)) {
      setUncontrolledCollapsedSectionKeys(keys);
    }

    onCollapsedSectionKeysChange?.(keys);
  };

  const handleSortModeChange = (value: UsedGearWorkflowPostPublishSortMode) => {
    if (!controlledSortMode) {
      setUncontrolledSortMode(value);
    }

    onSortModeChange?.(value);
  };

  const toggleSectionCollapsed = (sectionKey: UsedGearWorkflowPostPublishBucket) => {
    const nextKeys = collapsedSectionKeySet.has(sectionKey)
      ? collapsedSectionKeys.filter((key) => key !== sectionKey)
      : [...collapsedSectionKeys, sectionKey].sort((left, right) => left.localeCompare(right)) as UsedGearWorkflowPostPublishBucket[];

    handleCollapsedSectionKeysChange(nextKeys);
  };

  const toggleRecordSelected = (recordId: string) => {
    setSelectedRecordIds((current) => current.includes(recordId)
      ? current.filter((value) => value !== recordId)
      : [...current, recordId]);
  };

  const toggleSectionSelected = (recordIds: string[]) => {
    if (recordIds.length === 0) {
      return;
    }

    setSelectedRecordIds((current) => {
      const allSelected = recordIds.every((recordId) => current.includes(recordId));
      if (allSelected) {
        return current.filter((recordId) => !recordIds.includes(recordId));
      }

      return Array.from(new Set([...current, ...recordIds]));
    });
  };

  const collapseVisibleSections = () => {
    const nextKeys = Array.from(new Set([...collapsedSectionKeys, ...visibleSectionKeys]))
      .sort((left, right) => left.localeCompare(right)) as UsedGearWorkflowPostPublishBucket[];

    handleCollapsedSectionKeysChange(nextKeys);
  };

  const expandVisibleSections = () => {
    handleCollapsedSectionKeysChange(
      collapsedSectionKeys.filter((key) => !visibleSectionKeys.includes(key)),
    );
  };

  return (
    <section id="used-gear-post-publish" ref={sectionRef} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Workflow</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Post-Publish Queue</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Manage live listings after publish, identify stale inventory, route sold items into shipping, and keep shipped-history visible inside the app.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void copyLink();
            }}
            disabled={copyingLink}
          >
            {copyingLink ? 'Copying...' : copiedLink ? 'Link Copied' : selectedBucket === 'all' ? 'Copy Queue Link' : 'Copy Filtered Link'}
          </button>
          <label className="min-w-[240px] flex-1">
            <span className="sr-only">Search used gear post-publish queue</span>
            <input
              type="text"
              className={inputClassName}
              value={searchTerm}
              onChange={(event) => handleSearchTermChange(event.currentTarget.value)}
              placeholder="Search by status, SKU, model, or lifecycle date"
            />
          </label>
          <label className="min-w-[180px]">
            <span className="sr-only">Sort used gear post-publish queue</span>
            <select
              className={inputClassName}
              value={sortMode}
              onChange={(event) => handleSortModeChange(event.currentTarget.value as UsedGearWorkflowPostPublishSortMode)}
            >
              <option value="latest-activity">Sort: Latest Activity</option>
              <option value="oldest-activity">Sort: Oldest Activity</option>
              <option value="sku">Sort: SKU</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void refreshQueue();
            }}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Queue'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={collapseVisibleSections}
            disabled={visibleSectionKeys.length === 0 || allVisibleSectionsCollapsed}
          >
            Collapse All Buckets
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={expandVisibleSections}
            disabled={visibleSectionKeys.length === 0 || collapsedSectionKeys.length === 0}
          >
            Expand All Buckets
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${selectedBucket === 'all' ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
          onClick={() => onFocusedBucketChange?.('all')}
        >
          All Buckets
        </button>
        {SECTION_DEFINITIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${selectedBucket === section.key ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
            onClick={() => onFocusedBucketChange?.(section.key)}
          >
            {section.title}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${historyFilter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
          onClick={() => onHistoryFilterChange?.('all')}
        >
          All Lifecycle Work
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${historyFilter === 'active-only' ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
          onClick={() => onHistoryFilterChange?.('active-only')}
        >
          Active Only
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${historyFilter === 'history-only' ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
          onClick={() => onHistoryFilterChange?.('history-only')}
        >
          History Only
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${ownerFilter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
          onClick={() => handleOwnerFilterChange('all')}
        >
          All Owners
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${ownerFilter === 'mine' ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
          onClick={() => handleOwnerFilterChange('mine')}
        >
          Assigned To Me
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${ownerFilter === 'unassigned' ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
          onClick={() => handleOwnerFilterChange('unassigned')}
        >
          Unassigned Only
        </button>
      </div>

      {focusedBucket ? (
        <div className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Dashboard shortcut opened the post-publish queue filtered to the selected lifecycle bucket.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible Rows</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{filteredRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Active 30+ Days</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{agingSummary.activeNearStaleCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Stale 14+ Days</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{agingSummary.staleFollowUpCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Oldest Stale</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{formatUsedGearAgeDays(agingSummary.oldestStaleAgeDays)}</p>
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Reconciliation Helpers</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {selectedRecordIds.length > 0
                  ? `${selectedRecordIds.length} selected row${selectedRecordIds.length === 1 ? '' : 's'} ready for batch ownership or lifecycle updates.`
                  : 'Select post-publish rows to batch assign ownership or reconcile sold-ready and shipped status changes.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1">Unowned Stale: {unownedStaleCount}</div>
              <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1">Unowned Sold Ready: {unownedSoldReadyCount}</div>
            </div>
          </div>
          {selectedRecordIds.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleBatchAction((recordIds) => assignWorkflowOwnerBatch(recordIds, currentUserName));
                }}
                disabled={batchBusy}
              >
                {batchBusy ? 'Saving...' : 'Assign Selected To Me'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleBatchAction(clearWorkflowOwnerBatch);
                }}
                disabled={batchBusy}
              >
                {batchBusy ? 'Saving...' : 'Clear Selected Owner'}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleBatchAction(markWorkflowRowsSoldReadyToShip);
                }}
                disabled={batchBusy || !canBatchMarkSoldReady}
              >
                {batchBusy ? 'Saving...' : 'Mark Selected Sold Ready'}
              </button>
              <button
                type="button"
                className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleBatchAction(markWorkflowRowsShipped);
                }}
                disabled={batchBusy || !canBatchMarkShipped}
              >
                {batchBusy ? 'Saving...' : 'Mark Selected Shipped'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setSelectedRecordIds([])}
                disabled={batchBusy}
              >
                Clear Selection
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && filteredRecords.length === 0 ? (
        <EmptySurface title="No post-publish workflow rows" message="The used-gear workflow currently has no listed, stale, sold-ready, or shipped rows.">
          <p className="mt-3 text-sm text-[var(--muted)]">
            Next route: open Listings for newly approved publish work, then return here when a live item needs stale, sold-ready, or shipped follow-through.
          </p>
        </EmptySurface>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading used-gear post-publish queue...
          </div>
        ) : visibleSections.map((section) => {
          const sectionRecords = recordsBySection.get(section.key) ?? [];
          const collapsed = collapsedSectionKeySet.has(section.key);
          const sectionRecordIds = sectionRecords.map((record) => record.id);
          const allSectionRecordsSelected = sectionRecordIds.length > 0 && sectionRecordIds.every((recordId) => selectedRecordIds.includes(recordId));

          return (
            <div key={section.key} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{section.description}</p>
                  <h4 className="mt-1 text-lg font-semibold text-[var(--ink)]">{section.title}</h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {sectionRecords.length} row{sectionRecords.length === 1 ? '' : 's'}
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => toggleSectionCollapsed(section.key)}
                    aria-expanded={!collapsed}
                  >
                    {collapsed ? 'Expand Bucket' : 'Collapse Bucket'}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => toggleSectionSelected(sectionRecordIds)}
                    disabled={sectionRecordIds.length === 0 || batchBusy}
                  >
                    {allSectionRecordsSelected ? 'Clear Bucket Selection' : 'Select Bucket'}
                  </button>
                </div>
              </div>

              {collapsed ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
                  This lifecycle bucket is collapsed in the current shared queue view.
                </div>
              ) : sectionRecords.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
                  <p className="m-0">No rows currently match this post-publish stage.</p>
                  <p className="mt-2 mb-0">{getPostPublishSectionEmptyGuidance(section.key)}</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {sectionRecords.map((record) => {
                    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
                    if (!snapshot) return null;

                    const busy = actionRecordId === record.id;
                    const isStaleListing = snapshot.status === 'Stale Listing, Shopify' || snapshot.status === 'Stale Listing, eBay';
                    const canMarkStale = snapshot.status === 'Listed, Shopify' || snapshot.status === 'Listed, eBay';
                    const canMarkSoldReady = snapshot.bucket === 'active-listing' || snapshot.bucket === 'stale-listing';
                    const canMarkShipped = snapshot.bucket === 'sold-ready';
                    const workflowOwner = typeof record.fields['Workflow Owner'] === 'string' ? record.fields['Workflow Owner'].trim() : '';
                    const workflowOwnerAssignedAt = typeof record.fields['Workflow Owner Assigned At'] === 'string' ? record.fields['Workflow Owner Assigned At'] : null;
                    const draftStaleRecoveryStatus = getDraftStaleRecoveryStatus(record);
                    const draftStaleRecoveryNotes = getDraftStaleRecoveryNotes(record);
                    const selected = selectedRecordIds.includes(record.id);

                    return (
                      <article key={record.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{snapshot.status}</p>
                            <h5 className="mt-1 text-lg font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</h5>
                            <p className="mt-1 text-sm text-[var(--muted)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</p>
                          </div>
                          <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                            {snapshot.channel ? snapshot.channel : snapshot.bucket}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--muted)]">
                          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRecordSelected(record.id)}
                              disabled={batchBusy}
                              aria-label={`Select ${displayInventoryValue(record.fields.SKU)}`}
                            />
                            Select Row
                          </label>
                          <div className="text-right">
                            <div className="font-semibold text-[var(--ink)]">{workflowOwner || 'Unassigned'}</div>
                            <div className="text-xs uppercase tracking-[0.08em]">Owner assigned {displayInventoryValue(workflowOwnerAssignedAt)}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                          <div>Listed At: {displayInventoryValue(snapshot.listedAt)}</div>
                          <div>Days Live: {snapshot.daysSinceListed ?? '—'}</div>
                          <div>Stale At: {displayInventoryValue(snapshot.staleListingAt)}</div>
                          <div>Relisted At: {displayInventoryValue(snapshot.relistedAt)}</div>
                          <div>Sold Ready At: {displayInventoryValue(snapshot.soldReadyToShipAt)}</div>
                          <div>Shipped At: {displayInventoryValue(snapshot.shippedAt)}</div>
                          <div>Workflow Owner: {workflowOwner || 'Unassigned'}</div>
                          <div>Owner Assigned: {displayInventoryValue(workflowOwnerAssignedAt)}</div>
                          <div>Price: {displayInventoryValue(record.fields.Price || record.fields['Shopify Price'] || record.fields['eBay Price'])}</div>
                          <div>Recovery Updated: {displayInventoryValue(snapshot.staleRecoveryUpdatedAt)}</div>
                        </div>

                        {snapshot.bucket !== 'shipped' && snapshot.isPastStaleThreshold && snapshot.status !== 'Stale Listing, Shopify' && snapshot.status !== 'Stale Listing, eBay' ? (
                          <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
                            This listing has been live for {snapshot.daysSinceListed ?? 0} days and has crossed the {snapshot.staleThresholdDays}-day stale threshold.
                          </div>
                        ) : null}

                        {isStaleListing ? (
                          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/70 px-3 py-3 text-sm text-[var(--muted)]">
                            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Stale Recovery</p>
                            <div className="mt-3 grid gap-3">
                              <label>
                                <span className="sr-only">Stale recovery status</span>
                                <select
                                  className={inputClassName}
                                  value={draftStaleRecoveryStatus}
                                  onChange={(event) => {
                                    const value = normalizeStaleRecoveryStatus(event.currentTarget.value);
                                    setStaleRecoveryStatuses((current) => ({ ...current, [record.id]: value }));
                                  }}
                                  disabled={busy}
                                >
                                  <option value="">Recovery Status</option>
                                  {USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span className="sr-only">Stale recovery notes</span>
                                <textarea
                                  className={`${inputClassName} min-h-24 resize-y`}
                                  value={draftStaleRecoveryNotes}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value;
                                    setStaleRecoveryNotes((current) => ({ ...current, [record.id]: value }));
                                  }}
                                  placeholder="Add relist, pricing, or content-refresh notes"
                                  disabled={busy}
                                />
                              </label>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>Recovery Status: {displayInventoryValue(snapshot.staleRecoveryStatus)}</div>
                                <div>Recovery Updated: {displayInventoryValue(snapshot.staleRecoveryUpdatedAt)}</div>
                              </div>
                              {snapshot.staleRecoveryNotes ? (
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--ink)]">
                                  {snapshot.staleRecoveryNotes}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            onClick={() => onOpenWorkflowRecord(record.id)}
                            disabled={batchBusy}
                          >
                            Workflow Detail
                          </button>
                          {snapshot.bucket !== 'sold-ready' && snapshot.bucket !== 'shipped' ? (
                            <button
                              type="button"
                              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              onClick={() => onOpenListingsRecord(record.id)}
                              disabled={batchBusy}
                            >
                              Open Listings Approval
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => {
                              void handleAction(record.id, () => assignWorkflowOwner(record.id, currentUserName));
                            }}
                            disabled={busy}
                          >
                            {busy ? 'Saving...' : workflowOwner === currentUserName ? 'Refresh Owner' : 'Assign To Me'}
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => {
                              void handleAction(record.id, () => clearWorkflowOwner(record.id));
                            }}
                            disabled={busy || workflowOwner.length === 0}
                          >
                            {busy ? 'Saving...' : 'Clear Owner'}
                          </button>
                          {canMarkStale ? (
                            <button
                              type="button"
                              className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                void handleAction(record.id, () => markWorkflowListingStale(record.id));
                              }}
                              disabled={busy}
                            >
                              {busy ? 'Saving...' : 'Mark Stale'}
                            </button>
                          ) : null}
                          {isStaleListing ? (
                            <button
                              type="button"
                              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                void handleAction(record.id, () => saveWorkflowStaleRecovery(record.id, {
                                  staleRecoveryStatus: draftStaleRecoveryStatus || null,
                                  staleRecoveryNotes: draftStaleRecoveryNotes || null,
                                }));
                              }}
                              disabled={busy}
                            >
                              {busy ? 'Saving...' : 'Save Recovery'}
                            </button>
                          ) : null}
                          {isStaleListing ? (
                            <button
                              type="button"
                              className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                void handleAction(record.id, () => markWorkflowRelisted(record.id));
                              }}
                              disabled={busy}
                            >
                              {busy ? 'Saving...' : 'Mark Relisted'}
                            </button>
                          ) : null}
                          {canMarkSoldReady ? (
                            <button
                              type="button"
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                void handleAction(record.id, () => markWorkflowSoldReadyToShip(record.id));
                              }}
                              disabled={busy}
                            >
                              {busy ? 'Saving...' : 'Mark Sold Ready'}
                            </button>
                          ) : null}
                          {canMarkShipped ? (
                            <button
                              type="button"
                              className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                void handleAction(record.id, () => markWorkflowShipped(record.id));
                              }}
                              disabled={busy}
                            >
                              {busy ? 'Saving...' : 'Mark Shipped'}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
