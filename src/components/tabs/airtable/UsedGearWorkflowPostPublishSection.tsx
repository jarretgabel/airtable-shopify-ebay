import { useEffect, useMemo, useRef, useState } from 'react';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { getWorkflowStatusChipClasses } from '@/components/app/workflowStatusChips';
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
import { buildPostPublishLastTouchedSummary } from '@/services/usedGearWorkflowLastTouched';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearWorkflowPostPublishSectionProps {
  currentUserName: string;
  showSectionIntro?: boolean;
  showSectionTitles?: boolean;
  focusedBucket?: UsedGearWorkflowPostPublishBucket | null;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  sortMode?: UsedGearWorkflowPostPublishSortMode;
  onSortModeChange?: (value: UsedGearWorkflowPostPublishSortMode) => void;
  sectionDefinitions?: PostPublishSectionDefinition[];
  overviewSectionId?: string;
  queueTitle?: string;
  queueNoun?: string;
  focusedBucketNotice?: string;
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  nextRouteMessage?: string;
  searchPlaceholder?: string;
}

export type UsedGearWorkflowPostPublishSortMode = 'latest-activity' | 'oldest-activity' | 'sku';

export interface PostPublishSectionDefinition {
  key: UsedGearWorkflowPostPublishBucket;
  id: string;
  title: string;
  description: string;
}

export const POST_PUBLISH_OVERVIEW_SECTION_ID = 'used-gear-post-publish';
export const ARCHIVE_OVERVIEW_SECTION_ID = 'used-gear-archive';

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
      return 'Next action: use Archive for completed-item lookup, or return to Post-Publish when an item still needs shipment completion.';
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
];

export const ARCHIVE_SECTION_DEFINITIONS: PostPublishSectionDefinition[] = [
  {
    key: 'shipped',
    id: getPostPublishSectionId('shipped'),
    title: 'Completed Shipments',
    description: '',
  },
];

function formatLifecycleDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsedDate);
}

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
  showSectionTitles = true,
  focusedBucket = null,
  onOpenOperationalRecord,
  onOpenListingsRecord,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  sortMode: controlledSortMode,
  onSortModeChange,
  sectionDefinitions = POST_PUBLISH_SECTION_DEFINITIONS,
  overviewSectionId = POST_PUBLISH_OVERVIEW_SECTION_ID,
  queueTitle = 'Post-Publish Queue',
  queueNoun = 'post-publish queue',
  focusedBucketNotice = 'Dashboard shortcut opened the post-publish page and jumped to the selected lifecycle section.',
  emptyStateTitle = 'No post-publish operational rows',
  emptyStateMessage = 'The used-gear workflow currently has no listed, stale, sold-ready, or shipped operational rows.',
  nextRouteMessage = 'Next route: open Listings for newly approved publish work, then return here when a live item needs stale, sold-ready, or shipped follow-through.',
  searchPlaceholder = 'Search by status, SKU, model, or lifecycle date',
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
      const focusedSection = sectionDefinitions.find((section) => section.key === focusedBucket);
      const targetId = focusedSection?.id ?? overviewSectionId;
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [focusedBucket, overviewSectionId, sectionDefinitions]);

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
    const entries = sectionDefinitions.map((section) => [section.key, [] as AirtableRecord[]] as const);
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
  }, [filteredRecords, sectionDefinitions, sortMode]);

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

  const getSectionColumns = (sectionKey: UsedGearWorkflowPostPublishBucket): IntakeItemsMatrixColumn<AirtableRecord>[] => {
    const baseColumns: IntakeItemsMatrixColumn<AirtableRecord>[] = [
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
          const channelLabel = snapshot?.channel || snapshot?.bucket || 'Workflow';
          const itemMetaLabel = sectionKey === 'shipped' ? null : channelLabel;

          return (
            <div className="min-w-0">
              <div className="truncate text-sm text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</div>
              {itemMetaLabel ? (
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  <span>{itemMetaLabel}</span>
                </div>
              ) : null}
            </div>
          );
        },
      },
    ];

    if (sectionKey === 'shipped') {
      return [
        ...baseColumns,
        {
          key: 'ship-date',
          label: 'Ship Date',
          width: '9rem',
          renderCell: (record) => {
            const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
            return <span className="block text-xs text-[var(--muted)]">{formatLifecycleDate(snapshot?.shippedAt)}</span>;
          },
        },
        {
          key: 'actions',
          label: 'Actions',
          width: '10rem',
          align: 'center',
          headerClassName: 'border-l border-[var(--line)]/60',
          cellClassName: 'border-l border-[var(--line)]/60',
          renderCell: (record) => {
            const recordBusy = updatingRecordIds.includes(record.id);

            return (
              <div className="flex min-h-[4.5rem] w-full items-center justify-center gap-1.5">
                <CompactIconActionButton
                  label="Open Workflow Snapshot"
                  onClick={() => onOpenOperationalRecord(record.id)}
                  disabled={recordBusy}
                />
              </div>
            );
          },
        },
      ];
    }

    return [
      ...baseColumns,
      {
        key: 'status',
        label: 'Status',
        width: '14rem',
        renderCell: (record) => {
          const statusLabel = getUsedGearWorkflowPostPublishSnapshot(record)?.status ?? 'Unknown';

          return <span className={getWorkflowStatusChipClasses(statusLabel)}>{statusLabel}</span>;
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
  };

  return (
    <section id={overviewSectionId} ref={sectionRef} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 scroll-mt-24">
      <div className="flex flex-col gap-4">
        {showSectionIntro ? (
          <AppSectionTitle title={queueTitle} />
        ) : null}
        <QueueSearchToolbar
          searchAriaLabel={`Search used gear ${queueNoun}`}
          searchPlaceholder={searchPlaceholder}
          searchValue={searchTerm}
          onSearchChange={handleSearchTermChange}
          refreshLabel={`Refresh ${queueNoun}`}
          refreshLoadingLabel={`Refreshing ${queueNoun}`}
          refreshing={refreshing}
          onRefresh={() => {
            void refreshQueue();
          }}
          sortAriaLabel={`Sort used gear ${queueNoun}. Current order: ${getPostPublishSortLabel(sortMode)}`}
          sortValue={sortMode}
          onSortChange={(value) => handleSortModeChange(value as UsedGearWorkflowPostPublishSortMode)}
          sortOptions={[
            { value: 'latest-activity', label: 'Latest Activity' },
            { value: 'oldest-activity', label: 'Oldest Activity' },
            { value: 'sku', label: 'SKU' },
          ]}
        />
      </div>

      {focusedBucket && focusedBucketNotice ? (
        <div className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          {focusedBucketNotice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {!loading && filteredRecords.length === 0 ? (
        <EmptySurface title={emptyStateTitle} message={emptyStateMessage}>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {nextRouteMessage}
          </p>
        </EmptySurface>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            {`Loading used-gear ${queueNoun}...`}
          </div>
        ) : sectionDefinitions.map((section) => {
          const sectionRecords = recordsBySection.get(section.key) ?? [];

          return (
            <AppPageSectionSurface id={section.id} key={section.key} className="scroll-mt-24 bg-[var(--bg)]/60 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
              {showSectionTitles ? (
                <AppSectionTitle
                  title={section.title}
                  className="mb-3"
                />
              ) : null}
              {section.description ? <p className="max-w-xl text-sm text-[var(--muted)]">{section.description}</p> : null}

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
            </AppPageSectionSurface>
          );
        })}
      </div>
    </section>
  );
}
