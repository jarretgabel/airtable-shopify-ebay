import { useEffect, useMemo, useRef, useState } from 'react';
import { AppPageStatSection } from '@/components/app/AppPageStatSection';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  loadWorkflowPostPublishQueue,
  markWorkflowShipped,
  markWorkflowSoldReadyToShip,
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
import { buildPostPublishLastTouchedSummary } from '@/services/usedGearWorkflowLastTouched';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearWorkflowPostPublishSectionProps {
  currentUserName: string;
  showSectionIntro?: boolean;
  focusedBucket?: UsedGearWorkflowPostPublishBucket | null;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  sortMode?: UsedGearWorkflowPostPublishSortMode;
  onSortModeChange?: (value: UsedGearWorkflowPostPublishSortMode) => void;
}

export type UsedGearWorkflowPostPublishSortMode = 'latest-activity' | 'oldest-activity' | 'sku';

interface PostPublishSectionDefinition {
  key: UsedGearWorkflowPostPublishBucket;
  id: string;
  title: string;
  description: string;
}

export const POST_PUBLISH_OVERVIEW_SECTION_ID = 'used-gear-post-publish';

export function getPostPublishSectionId(bucket: UsedGearWorkflowPostPublishBucket): string {
  return `used-gear-post-publish-${bucket}`;
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

export const POST_PUBLISH_SECTION_DEFINITIONS: PostPublishSectionDefinition[] = [
  {
    key: 'active-listing',
    id: getPostPublishSectionId('active-listing'),
    title: 'Active Listings',
    description: `Live listings that are still inside the ${USED_GEAR_STALE_THRESHOLD_DAYS}-day freshness window.`,
  },
  {
    key: 'stale-listing',
    id: getPostPublishSectionId('stale-listing'),
    title: 'Stale Listings',
    description: `Listings at or beyond the ${USED_GEAR_STALE_THRESHOLD_DAYS}-day threshold, plus rows explicitly moved into the stale queue.`,
  },
  {
    key: 'sold-ready',
    id: getPostPublishSectionId('sold-ready'),
    title: 'Sold Ready To Ship',
    description: 'Sold items waiting for shipping completion.',
  },
  {
    key: 'shipped',
    id: getPostPublishSectionId('shipped'),
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

function getPostPublishListingsActionLabel(bucket: UsedGearWorkflowPostPublishBucket): string | null {
  if (bucket === 'sold-ready' || bucket === 'shipped') {
    return null;
  }

  return 'Open Listings Approval';
}

export function UsedGearWorkflowPostPublishSection({
  showSectionIntro = true,
  focusedBucket = null,
  onOpenOperationalRecord: _onOpenOperationalRecord,
  onOpenListingsRecord,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  sortMode: controlledSortMode,
  onSortModeChange,
}: UsedGearWorkflowPostPublishSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearWorkflowPostPublishSortMode>('latest-activity');
  const [updatingRecordIds, setUpdatingRecordIds] = useState<string[]>([]);
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const sortMode = controlledSortMode ?? uncontrolledSortMode;

  useEffect(() => {
    if (!focusedBucket || !sectionRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      document.getElementById(getPostPublishSectionId(focusedBucket))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const recordsBySection = useMemo(() => {
    const entries = POST_PUBLISH_SECTION_DEFINITIONS.map((section) => [section.key, [] as AirtableRecord[]] as const);
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

  const handleRecordAction = async (recordId: string, action: (nextRecordId: string) => Promise<AirtableRecord>) => {
    setError(null);
    setUpdatingRecordIds((current) => [...current, recordId]);

    try {
      replaceRecords([await action(recordId)]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the operational row.');
    } finally {
      setUpdatingRecordIds((current) => current.filter((currentRecordId) => currentRecordId !== recordId));
    }
  };

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

  const getSectionColumns = (sectionKey: UsedGearWorkflowPostPublishBucket): IntakeItemsMatrixColumn<AirtableRecord>[] => [
    {
      key: 'sku',
      label: 'SKU',
      width: '8.5rem',
      renderCell: (record) => <span className="font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</span>,
    },
    {
      key: 'item',
      label: 'Item',
      width: 'minmax(0,1.65fr)',
      renderCell: (record) => {
        const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
        const status = snapshot?.status ?? 'Unknown';
        const channelLabel = snapshot?.channel || snapshot?.bucket || 'Workflow';

        return (
          <div className="min-w-0">
            <div className="truncate text-sm text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</div>
            <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span>{status}</span>
              <span>{channelLabel}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'overview',
      label: 'Days Live',
      width: '7rem',
      renderCell: (record) => {
        const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
        if (!snapshot) {
          return <span className="text-xs text-[var(--muted)]">No lifecycle snapshot</span>;
        }

        return (
          <span className="text-sm font-semibold text-[var(--ink)]">{snapshot.daysSinceListed ?? '—'}</span>
        );
      },
    },
    {
      key: 'activity',
      label: 'Last Touched',
      width: '11rem',
      renderCell: (record) => {
        const lastTouchedSummary = buildPostPublishLastTouchedSummary(record);

        return (
          <span className="block text-xs text-[var(--muted)]">{lastTouchedSummary.timestamp}</span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8.5rem',
      align: 'center',
      headerClassName: 'border-l border-[var(--line)]/60',
      cellClassName: 'border-l border-[var(--line)]/60',
      renderCell: (record) => {
        const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
        const listingsActionLabel = getPostPublishListingsActionLabel(sectionKey);
        const recordBusy = updatingRecordIds.includes(record.id);
        const showMarkSoldReady = snapshot?.bucket === 'active-listing' || snapshot?.bucket === 'stale-listing';
        const showMarkShipped = snapshot?.bucket === 'sold-ready';

        return (
          <div className="flex min-h-[4.5rem] w-full items-center justify-center gap-1.5">
            {showMarkSoldReady ? (
              <CompactIconActionButton
                label="Mark Sold Ready"
                variant="compact-primary"
                icon="check"
                onClick={() => {
                  void handleRecordAction(record.id, markWorkflowSoldReadyToShip);
                }}
                disabled={recordBusy}
              />
            ) : null}
            {showMarkShipped ? (
              <CompactIconActionButton
                label="Mark Shipped"
                variant="compact-primary"
                icon="truck"
                onClick={() => {
                  void handleRecordAction(record.id, markWorkflowShipped);
                }}
                disabled={recordBusy}
              />
            ) : null}
            {listingsActionLabel ? (
              <CompactIconActionButton label={listingsActionLabel} onClick={() => onOpenListingsRecord(record.id)} disabled={recordBusy} />
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <section id={POST_PUBLISH_OVERVIEW_SECTION_ID} ref={sectionRef} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 scroll-mt-24">
      <div className="flex flex-col gap-4">
        {showSectionIntro ? (
          <AppSectionTitle title="Post-Publish Queue" />
        ) : null}
        <AppPageStatSection
          stats={[
            { label: 'Visible Rows', value: filteredRecords.length },
            { label: 'Active 30+ Days', value: agingSummary.activeNearStaleCount },
            { label: 'Stale 14+ Days', value: agingSummary.staleFollowUpCount },
            { label: 'Oldest Stale', value: formatUsedGearAgeDays(agingSummary.oldestStaleAgeDays) },
          ]}
        />
        <QueueSearchToolbar
          searchAriaLabel="Search used gear post-publish queue"
          searchPlaceholder="Search by status, SKU, model, or lifecycle date"
          searchValue={searchTerm}
          onSearchChange={handleSearchTermChange}
          refreshLabel="Refresh post-publish queue"
          refreshLoadingLabel="Refreshing post-publish queue"
          refreshing={refreshing}
          onRefresh={() => {
            void refreshQueue();
          }}
          sortAriaLabel={`Sort used gear post-publish queue. Current order: ${getPostPublishSortLabel(sortMode)}`}
          sortValue={sortMode}
          onSortChange={(value) => handleSortModeChange(value as UsedGearWorkflowPostPublishSortMode)}
          sortOptions={[
            { value: 'latest-activity', label: 'Latest Activity' },
            { value: 'oldest-activity', label: 'Oldest Activity' },
            { value: 'sku', label: 'SKU' },
          ]}
        />
      </div>

      {focusedBucket ? (
        <div className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Dashboard shortcut opened the post-publish page and jumped to the selected lifecycle section.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {!loading && filteredRecords.length === 0 ? (
        <EmptySurface title="No post-publish operational rows" message="The used-gear workflow currently has no listed, stale, sold-ready, or shipped operational rows.">
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
        ) : POST_PUBLISH_SECTION_DEFINITIONS.map((section) => {
          const sectionRecords = recordsBySection.get(section.key) ?? [];

          return (
            <div id={section.id} key={section.key} className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="mt-1 text-lg font-semibold text-[var(--ink)]">{section.title}</h4>
                  <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">{section.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {sectionRecords.length} row{sectionRecords.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              {sectionRecords.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
                  <p className="m-0">No rows currently match this post-publish stage.</p>
                  <p className="mt-2 mb-0">{getPostPublishSectionEmptyGuidance(section.key)}</p>
                </div>
              ) : (
                <div className="mt-4">
                  <IntakeItemsMatrix
                    items={sectionRecords}
                    columns={getSectionColumns(section.key)}
                    getItemKey={(record) => record.id}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
