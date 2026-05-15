import { useEffect, useMemo, useRef, useState } from 'react';
import { smallPrimaryActionButtonClass, smallSecondaryActionButtonClass, smallSuccessActionButtonClass } from '@/components/app/buttonStyles';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { CopyLinkIconButton } from '@/components/app/CopyLinkIconButton';
import { FilterToggleIconButton } from '@/components/app/FilterToggleIconButton';
import { RefreshIconButton } from '@/components/app/RefreshIconButton';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  loadWorkflowPostPublishQueue,
  markWorkflowRowsShipped,
  markWorkflowRowsSoldReadyToShip,
} from '@/services/usedGearQueue';
import {
  getUsedGearWorkflowPostPublishSnapshot,
  USED_GEAR_STALE_THRESHOLD_DAYS,
  type UsedGearWorkflowPostPublishBucket,
} from '@/services/usedGearWorkflowLifecycle';
import {
  buildPostPublishQueueAgingSummary,
  formatUsedGearAgeDays,
} from '@/services/usedGearWorkflowAging';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import { buildPostPublishLastTouchedSummary } from '@/services/usedGearWorkflowLastTouched';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearWorkflowPostPublishSectionProps {
  currentUserName: string;
  focusedBucket?: UsedGearWorkflowPostPublishBucket | null;
  onFocusedBucketChange?: (bucket: UsedGearWorkflowPostPublishBucket | 'all') => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  sortMode?: UsedGearWorkflowPostPublishSortMode;
  onSortModeChange?: (value: UsedGearWorkflowPostPublishSortMode) => void;
}

export type UsedGearWorkflowPostPublishSortMode = 'latest-activity' | 'oldest-activity' | 'sku';

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

function recordSearchText(record: AirtableRecord): string {
  return [
    record.fields.SKU,
    record.fields.Make,
    record.fields.Model,
    record.fields['Workflow Status'],
    record.fields['Workflow Owner'],
    record.fields['Listed At'],
    record.fields['Shipment Follow-Through Notes'],
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

function getPostPublishSortLabel(sortMode: UsedGearWorkflowPostPublishSortMode): string {
  if (sortMode === 'oldest-activity') {
    return 'Oldest Activity';
  }

  if (sortMode === 'sku') {
    return 'SKU';
  }

  return 'Latest Activity';
}

export function UsedGearWorkflowPostPublishSection({
  focusedBucket = null,
  onFocusedBucketChange,
  onOpenWorkflowRecord,
  onOpenListingsRecord,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
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
  const [showQueueTools, setShowQueueTools] = useState(false);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearWorkflowPostPublishSortMode>('latest-activity');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const sortMode = controlledSortMode ?? uncontrolledSortMode;
  const batchBusy = false;

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
      if (!normalizedSearch) {
        return true;
      }

      return recordSearchText(record).includes(normalizedSearch);
    });
  }, [records, searchTerm]);
  const filteredRecordIdSet = useMemo(() => new Set(filteredRecords.map((record) => record.id)), [filteredRecords]);
  const selectedRecords = useMemo(
    () => filteredRecords.filter((record) => selectedRecordIds.includes(record.id)),
    [filteredRecords, selectedRecordIds],
  );
  const selectedSnapshots = useMemo(
    () => selectedRecords.map((record) => ({ record, snapshot: getUsedGearWorkflowPostPublishSnapshot(record) })).filter((entry) => entry.snapshot),
    [selectedRecords],
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
    if (selectedBucket === 'all') {
      return SECTION_DEFINITIONS;
    }

    return SECTION_DEFINITIONS.filter((section) => section.key === selectedBucket);
  }, [selectedBucket]);
  const hasBucketFilterActive = selectedBucket !== 'all';

  useEffect(() => {
    if (hasBucketFilterActive) {
      setShowQueueTools(true);
    }
  }, [hasBucketFilterActive]);

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

  const replaceRecords = (updatedRecords: AirtableRecord[]) => {
    if (updatedRecords.length === 0) {
      return;
    }

    const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));
    setRecords((currentRecords) => currentRecords.map((record) => updatedById.get(record.id) ?? record));
  };

  const handleBatchAction = async (action: (recordIds: string[]) => Promise<AirtableRecord[]>) => {
    if (selectedRecordIds.length === 0) {
      return;
    }

    setError(null);

    try {
      replaceRecords(await action(selectedRecordIds));
      setSelectedRecordIds([]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the selected workflow rows.');
    }
  };

  const openLastTouchedAction = (recordId: string, actionTarget: 'review-record' | 'workflow-record' | 'listings-record') => {
    if (actionTarget === 'listings-record') {
      onOpenListingsRecord(recordId);
      return;
    }

    onOpenWorkflowRecord(recordId);
  };

  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const handleSearchTermChange = (value: string) => {
    if (typeof controlledSearchTerm !== 'string') {
      setUncontrolledSearchTerm(value);
    }

    onSearchTermChange?.(value);
  };

  const handleSortModeChange = (value: UsedGearWorkflowPostPublishSortMode) => {
    if (!controlledSortMode) {
      setUncontrolledSortMode(value);
    }

    onSortModeChange?.(value);
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

  return (
    <section id="used-gear-post-publish" ref={sectionRef} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
      <div className="flex flex-col gap-4">
        <div>
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Workflow</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Post-Publish Queue</h3>
          <div className="mt-3 max-w-2xl">
            <CollapsibleHelperText label="Queue guide">
              Track listing follow-up by bucket, then open the workflow record for per-row lifecycle actions.
            </CollapsibleHelperText>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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
          <div className="flex flex-wrap items-center gap-3">
            <CopyLinkIconButton
              onClick={() => {
                void copyLink();
              }}
              disabled={copyingLink}
              copying={copyingLink}
              copied={copiedLink}
              label={selectedBucket === 'all' ? 'Copy Queue Link' : 'Copy Filtered Link'}
              copyingLabel={selectedBucket === 'all' ? 'Copying queue link' : 'Copying filtered link'}
              copiedLabel={selectedBucket === 'all' ? 'Queue link copied' : 'Filtered link copied'}
            />
            <RefreshIconButton
              onClick={() => {
                void refreshQueue();
              }}
              disabled={refreshing}
              loading={refreshing}
              label="Refresh post-publish queue"
              loadingLabel="Refreshing post-publish queue"
            />
            <div className="relative h-10 w-10 shrink-0">
              <div
                aria-hidden="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[var(--line)] hover:text-[var(--ink)]"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M4.167 5.417h9.166" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="M4.167 10h6.666" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="M4.167 14.583h4.166" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="M14.583 4.167v11.666" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="m12.5 6.25 2.083-2.083 2.084 2.083" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m12.5 13.75 2.083 2.083 2.084-2.083" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <select
                aria-label={`Sort used gear post-publish queue. Current order: ${getPostPublishSortLabel(sortMode)}`}
                className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
                value={sortMode}
                onChange={(event) => handleSortModeChange(event.currentTarget.value as UsedGearWorkflowPostPublishSortMode)}
              >
                <option value="latest-activity">Latest Activity</option>
                <option value="oldest-activity">Oldest Activity</option>
                <option value="sku">SKU</option>
              </select>
            </div>
            <FilterToggleIconButton
              onClick={() => setShowQueueTools((current) => !current)}
              aria-expanded={showQueueTools}
              expanded={showQueueTools}
              collapsedLabel="Show Buckets"
              expandedLabel="Hide Buckets"
            />
          </div>
        </div>
      </div>

      {showQueueTools ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4">
          <div className="grid gap-4 xl:grid-cols-3 xl:items-start">
            <div className="space-y-2 xl:col-span-2">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Bucket</p>
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
            </div>
          </div>
        </div>
      ) : null}

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

      {selectedRecordIds.length > 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Selected Rows</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {selectedRecordIds.length} selected row{selectedRecordIds.length === 1 ? '' : 's'} ready for batch lifecycle updates.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyLinkIconButton
              onClick={() => {
                void copyLink();
              }}
              disabled={copyingLink}
              copying={copyingLink}
              copied={copiedLink}
              label="Copy Filtered Link"
              copyingLabel="Copying filtered link"
              copiedLabel="Filtered link copied"
            />
            <RefreshIconButton
              onClick={() => {
                void refreshQueue();
              }}
              disabled={refreshing}
              loading={refreshing}
              label="Refresh post-publish queue"
              loadingLabel="Refreshing post-publish queue"
            />
            <button
              className={smallSecondaryActionButtonClass}
              type="button"
              onClick={() => setSelectedRecordIds([])}
              disabled={batchBusy}
            >
              Clear Selection
            </button>
            <button
              type="button"
              className={smallPrimaryActionButtonClass}
              onClick={() => {
                void handleBatchAction(markWorkflowRowsSoldReadyToShip);
              }}
              disabled={batchBusy || !canBatchMarkSoldReady}
            >
              Mark Selected Sold Ready
            </button>
            <button
              type="button"
              className={smallSuccessActionButtonClass}
              onClick={() => {
                void handleBatchAction(markWorkflowRowsShipped);
              }}
              disabled={batchBusy || !canBatchMarkShipped}
            >
              Mark Selected Shipped
            </button>
          </div>
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
          const sectionRecordIds = sectionRecords.map((record) => record.id);
          const allSectionRecordsSelected = sectionRecordIds.length > 0 && sectionRecordIds.every((recordId) => selectedRecordIds.includes(recordId));

          return (
            <div key={section.key} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="mt-1 text-lg font-semibold text-[var(--ink)]">{section.title}</h4>
                  <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">{section.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {sectionRecords.length} row{sectionRecords.length === 1 ? '' : 's'}
                  </div>
                  <button
                      type="button"
                      className={smallSecondaryActionButtonClass}
                      onClick={() => toggleSectionSelected(sectionRecordIds)}
                      disabled={sectionRecordIds.length === 0 || batchBusy}
                    >
                      {allSectionRecordsSelected ? 'Clear Bucket Selection' : 'Select Bucket'}
                    </button>
                </div>
              </div>

              {sectionRecords.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
                  <p className="m-0">No rows currently match this post-publish stage.</p>
                  <p className="mt-2 mb-0">{getPostPublishSectionEmptyGuidance(section.key)}</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {sectionRecords.map((record) => {
                    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
                    if (!snapshot) return null;

                    const lastTouchedSummary = buildPostPublishLastTouchedSummary(record);
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
                        </div>

                        <button
                          type="button"
                          className="mt-3 block w-full rounded-xl border border-[var(--line)] bg-[var(--bg)]/70 px-3 py-3 text-left text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => openLastTouchedAction(record.id, lastTouchedSummary.actionTarget)}
                          disabled={batchBusy}
                        >
                          <span className="font-semibold text-[var(--ink)]">Last touched:</span> {lastTouchedSummary.description} · {lastTouchedSummary.timestamp}
                          <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{lastTouchedSummary.actionLabel}</span>
                        </button>

                        <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                          <div>Days Live: {snapshot.daysSinceListed ?? '—'}</div>
                          <div>Price: {displayInventoryValue(record.fields.Price || record.fields['Shopify Price'] || record.fields['Ebay Price'] || record.fields['eBay Price'])}</div>
                          <div>Recovery Status: {displayInventoryValue(snapshot.staleRecoveryStatus)}</div>
                        </div>

                        {snapshot.bucket !== 'shipped' && snapshot.isPastStaleThreshold && snapshot.status !== 'Stale Listing, Shopify' && snapshot.status !== 'Stale Listing, eBay' ? (
                          <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
                            This listing has been live for {snapshot.daysSinceListed ?? 0} days and has crossed the {snapshot.staleThresholdDays}-day stale threshold.
                          </div>
                        ) : null}

                        <details className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 px-3 py-3 text-sm text-[var(--muted)]">
                          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                            More Lifecycle Details
                          </summary>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div>Listed At: {displayInventoryValue(snapshot.listedAt)}</div>
                            <div>Stale At: {displayInventoryValue(snapshot.staleListingAt)}</div>
                            <div>Relisted At: {displayInventoryValue(snapshot.relistedAt)}</div>
                            <div>Sold Ready At: {displayInventoryValue(snapshot.soldReadyToShipAt)}</div>
                            <div>Shipped At: {displayInventoryValue(snapshot.shippedAt)}</div>
                          </div>
                          {snapshot.staleRecoveryNotes ? (
                            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--ink)]">
                              {snapshot.staleRecoveryNotes}
                            </div>
                          ) : null}
                          {snapshot.shipmentFollowThroughNotes ? (
                            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--ink)]">
                              {snapshot.shipmentFollowThroughNotes}
                            </div>
                          ) : null}
                          {snapshot.bucket !== 'sold-ready' && snapshot.bucket !== 'shipped' ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={smallSecondaryActionButtonClass}
                                onClick={() => onOpenListingsRecord(record.id)}
                                disabled={batchBusy}
                              >
                                Open Listings Approval
                              </button>
                            </div>
                          ) : null}
                        </details>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={smallPrimaryActionButtonClass}
                            onClick={() => onOpenWorkflowRecord(record.id)}
                            disabled={batchBusy}
                          >
                            Open Workflow Record
                          </button>
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
