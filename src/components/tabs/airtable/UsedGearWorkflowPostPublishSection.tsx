import { useEffect, useMemo, useRef, useState } from 'react';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { compactRowPrimaryActionButtonClass, compactRowSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { getWorkflowStatusChipClasses } from '@/components/app/workflowStatusChips';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  markWorkflowCancelled,
  markWorkflowPartialRefund,
  markWorkflowRefunded,
  markWorkflowReturnReceived,
  loadWorkflowPostPublishQueue,
  markWorkflowShipped,
  resolveWorkflowRestockDisposition,
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
  onOpenShipmentRecord: (recordId: string) => void;
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
  sectionSearchEnabled?: boolean;
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


function getPostSaleChipClassName(label: string): string {
  const normalizedLabel = label.trim().toLowerCase();

  if (normalizedLabel.includes('cancelled')) {
    return 'border-rose-400/35 bg-rose-500/15 text-rose-100';
  }

  if (normalizedLabel.includes('refunded')) {
    return 'border-sky-400/35 bg-sky-500/15 text-sky-100';
  }

  if (normalizedLabel.includes('returned')) {
    return 'border-amber-400/35 bg-amber-500/15 text-amber-100';
  }

  if (normalizedLabel.includes('partial refund')) {
    return 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100';
  }

  if (normalizedLabel.includes('resolved')) {
    return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100';
  }

  if (normalizedLabel.includes('disposition')) {
    return 'border-slate-300/20 bg-white/8 text-slate-100';
  }

  return 'border-slate-300/20 bg-white/8 text-slate-100';
}

function formatCurrency(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function buildPostSaleChipValues(snapshot: ReturnType<typeof getUsedGearWorkflowPostPublishSnapshot>) {
  if (!snapshot) {
    return [] as Array<{ label: string; className: string }>;
  }

  const chips: Array<{ label: string; className: string }> = [];

  if (snapshot.isPostSaleResolved) {
    chips.push({ label: 'Post-Sale Resolved', className: getPostSaleChipClassName('resolved') });
  }

  if (snapshot.postSaleOutcome) {
    chips.push({ label: `Outcome: ${snapshot.postSaleOutcome}`, className: getPostSaleChipClassName(snapshot.postSaleOutcome) });
  }

  if (snapshot.refundAmount !== null) {
    const formattedAmount = formatCurrency(snapshot.refundAmount);
    if (formattedAmount) {
      chips.push({ label: `Refund: ${formattedAmount}`, className: getPostSaleChipClassName('Refunded') });
    }
  }

  if (snapshot.refundReason) {
    chips.push({ label: 'Refund Reason', className: getPostSaleChipClassName('Disposition') });
  }

  if (snapshot.returnReceivedAt) {
    chips.push({ label: 'Return Received', className: getPostSaleChipClassName('Returned') });
  }

  if (snapshot.restockDisposition) {
    chips.push({ label: `Disposition: ${snapshot.restockDisposition}`, className: getPostSaleChipClassName('Disposition') });
  }

  if (snapshot.postSaleNotes) {
    chips.push({ label: 'Notes Added', className: getPostSaleChipClassName('Disposition') });
  }

  return chips;
}

export function UsedGearWorkflowPostPublishSection({
  showSectionIntro = true,
  showSectionTitles = true,
  focusedBucket = null,
  onOpenOperationalRecord,
  onOpenListingsRecord,
  onOpenShipmentRecord,
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
  sectionSearchEnabled = false,
}: UsedGearWorkflowPostPublishSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearWorkflowPostPublishSortMode>('latest-activity');
  const [updatingRecordIds, setUpdatingRecordIds] = useState<string[]>([]);
  const [sectionSearchTerms, setSectionSearchTerms] = useState<Record<UsedGearWorkflowPostPublishBucket, string>>({
    'active-listing': '',
    'stale-listing': '',
    'sold-ready': '',
    shipped: '',
  });
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const sortMode = controlledSortMode ?? uncontrolledSortMode;
  const useGlobalSearch = !sectionSearchEnabled;

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
    if (!useGlobalSearch) {
      return records;
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      if (!normalizedSearch) {
        return true;
      }

      return recordSearchText(record).includes(normalizedSearch);
    });
  }, [records, searchTerm, useGlobalSearch]);

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

  const handleSectionSearchChange = (bucket: UsedGearWorkflowPostPublishBucket, value: string) => {
    setSectionSearchTerms((current) => ({
      ...current,
      [bucket]: value,
    }));
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
          key: 'post-sale',
          label: 'Post-Sale',
          width: 'minmax(0,1.25fr)',
          renderCell: (record) => {
            const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
            const chips = buildPostSaleChipValues(snapshot);

            if (!snapshot || chips.length === 0) {
              return <span className="text-xs text-[var(--muted)]">—</span>;
            }

            return (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span key={chip.label} className={`${getWorkflowStatusChipClasses(chip.label)} ${chip.className}`}>
                    {chip.label}
                  </span>
                ))}
              </div>
            );
          },
        },
        {
          key: 'actions',
          label: 'Actions',
          width: '14rem',
          align: 'center',
          headerClassName: 'border-l border-[var(--line)]/60',
          cellClassName: 'border-l border-[var(--line)]/60',
          renderCell: (record: AirtableRecord) => {
            const recordBusy = updatingRecordIds.includes(record.id);

            return (
              <div className="flex min-h-[4.5rem] w-full flex-wrap items-center justify-center gap-1.5">
                <CompactIconActionButton
                  label="Open Completed Shipment"
                  icon="open"
                  variant="compact-secondary"
                  onClick={() => onOpenShipmentRecord(record.id)}
                  disabled={recordBusy}
                />
                <CompactIconActionButton
                  label="Open Workflow Snapshot"
                  icon="eye"
                  variant="compact-secondary"
                  onClick={() => onOpenOperationalRecord(record.id)}
                  disabled={recordBusy}
                />
              </div>
            );
          },
        },
      ];
    }

    const includePostSale = sectionKey === 'sold-ready';

    return [
      ...baseColumns,
      {
        key: 'status',
        label: 'Status',
        width: '14rem',
        renderCell: (record: AirtableRecord) => {
          const statusLabel = getUsedGearWorkflowPostPublishSnapshot(record)?.status ?? 'Unknown';

          return <span className={getWorkflowStatusChipClasses(statusLabel)}>{statusLabel}</span>;
        },
      },
      {
        key: 'overview',
        label: 'Days Live',
        width: '7rem',
        renderCell: (record: AirtableRecord) => {
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
        renderCell: (record: AirtableRecord) => {
          const lastTouchedSummary = buildPostPublishLastTouchedSummary(record);

          return (
            <span className="block text-xs text-[var(--muted)]">{lastTouchedSummary.timestamp}</span>
          );
        },
      },
      ...(includePostSale
        ? [
          {
            key: 'post-sale',
            label: 'Post-Sale',
            width: 'minmax(0,1.25fr)',
            renderCell: (record: AirtableRecord) => {
              const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
              const chips = buildPostSaleChipValues(snapshot);

              if (!snapshot || chips.length === 0) {
                return <span className="text-xs text-[var(--muted)]">—</span>;
              }

              return (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span key={chip.label} className={`${getWorkflowStatusChipClasses(chip.label)} ${chip.className}`}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              );
            },
          },
        ]
        : []),
      {
        key: 'actions',
        label: 'Actions',
        width: '14rem',
        align: 'center',
        headerClassName: 'border-l border-[var(--line)]/60',
        cellClassName: 'border-l border-[var(--line)]/60',
        renderCell: (record: AirtableRecord) => {
          const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
          const recordBusy = updatingRecordIds.includes(record.id);
          const hideTextActions = sectionKey === 'sold-ready';
          const showMarkShipped = snapshot?.bucket === 'sold-ready';
          const noOutcomeYet = !snapshot?.postSaleOutcome;
          const showMarkCancelled = (snapshot?.bucket === 'sold-ready' || snapshot?.bucket === 'shipped') && noOutcomeYet;
          const showMarkPartialRefund = (snapshot?.bucket === 'sold-ready' || snapshot?.bucket === 'shipped') && noOutcomeYet;
          const showMarkRefunded = (snapshot?.bucket === 'sold-ready' || snapshot?.bucket === 'shipped') && noOutcomeYet;
          const showMarkReturnReceived = snapshot?.bucket === 'shipped' && noOutcomeYet;
          const showDispositionActions = Boolean(snapshot?.postSaleOutcome) && !snapshot?.restockDisposition;

          return (
            <div className="flex min-h-[4.5rem] w-full flex-wrap items-center justify-center gap-1.5">
              {showMarkShipped && !hideTextActions ? (
                <button
                  type="button"
                  className={compactRowPrimaryActionButtonClass}
                  onClick={() => {
                    void handleRecordAction(record.id, markWorkflowShipped);
                  }}
                  disabled={recordBusy}
                >
                  Shipped
                </button>
              ) : null}
              {showMarkCancelled && !hideTextActions ? (
                <button
                  type="button"
                  className={compactRowSecondaryActionButtonClass}
                  onClick={() => {
                    void handleRecordAction(record.id, markWorkflowCancelled);
                  }}
                  disabled={recordBusy}
                >
                  Cancelled
                </button>
              ) : null}
              {showMarkPartialRefund && !hideTextActions ? (
                <button
                  type="button"
                  className={compactRowSecondaryActionButtonClass}
                  onClick={() => {
                    void handleRecordAction(record.id, markWorkflowPartialRefund);
                  }}
                  disabled={recordBusy}
                >
                  Partial Refund
                </button>
              ) : null}
              {showMarkRefunded && !hideTextActions ? (
                <button
                  type="button"
                  className={compactRowSecondaryActionButtonClass}
                  onClick={() => {
                    void handleRecordAction(record.id, markWorkflowRefunded);
                  }}
                  disabled={recordBusy}
                >
                  Refunded
                </button>
              ) : null}
              {showMarkReturnReceived && !hideTextActions ? (
                <button
                  type="button"
                  className={compactRowSecondaryActionButtonClass}
                  onClick={() => {
                    void handleRecordAction(record.id, markWorkflowReturnReceived);
                  }}
                  disabled={recordBusy}
                >
                  Return Received
                </button>
              ) : null}
              {showDispositionActions ? (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <CompactIconActionButton
                    label="Disposition: Relist Candidate"
                    variant="compact-secondary"
                    icon="form"
                    onClick={() => {
                      void handleRecordAction(record.id, (nextRecordId) => resolveWorkflowRestockDisposition(nextRecordId, { restockDisposition: 'Relist Candidate' }));
                    }}
                    disabled={recordBusy}
                  />
                  <CompactIconActionButton
                    label="Disposition: Needs Re-Intake"
                    variant="compact-secondary"
                    icon="form"
                    onClick={() => {
                      void handleRecordAction(record.id, (nextRecordId) => resolveWorkflowRestockDisposition(nextRecordId, { restockDisposition: 'Needs Re-Intake' }));
                    }}
                    disabled={recordBusy}
                  />
                  <CompactIconActionButton
                    label="Disposition: Parts / Damaged"
                    variant="compact-secondary"
                    icon="form"
                    onClick={() => {
                      void handleRecordAction(record.id, (nextRecordId) => resolveWorkflowRestockDisposition(nextRecordId, { restockDisposition: 'Parts / Damaged' }));
                    }}
                    disabled={recordBusy}
                  />
                  <CompactIconActionButton
                    label="Disposition: Archive Only"
                    variant="compact-secondary"
                    icon="form"
                    onClick={() => {
                      void handleRecordAction(record.id, (nextRecordId) => resolveWorkflowRestockDisposition(nextRecordId, { restockDisposition: 'Archive Only' }));
                    }}
                    disabled={recordBusy}
                  />
                </div>
              ) : null}
              <CompactIconActionButton
                label="Open Sold-Ready View"
                icon="open"
                variant="compact-secondary"
                onClick={() => onOpenListingsRecord(record.id)}
                disabled={recordBusy}
              />
              <CompactIconActionButton
                label="Open Workflow Snapshot"
                icon="eye"
                variant="compact-secondary"
                onClick={() => onOpenOperationalRecord(record.id)}
                disabled={recordBusy}
              />
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
        {!sectionSearchEnabled ? (
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
        ) : null}
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
          const sectionSearchTerm = sectionSearchEnabled ? sectionSearchTerms[section.key] ?? '' : searchTerm;
          const normalizedSectionSearch = sectionSearchTerm.trim().toLowerCase();
          const visibleSectionRecords = normalizedSectionSearch
            ? sectionRecords.filter((record) => recordSearchText(record).includes(normalizedSectionSearch))
            : sectionRecords;

          return (
            <AppPageSectionSurface id={section.id} key={section.key} className="scroll-mt-24 bg-[var(--bg)]/60 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
              {showSectionTitles ? (
                <AppSectionTitle
                  title={section.title}
                  className="mb-3"
                />
              ) : null}
              {section.description ? <p className="max-w-xl text-sm text-[var(--muted)]">{section.description}</p> : null}

              {sectionSearchEnabled ? (
                <div className="mt-4">
                  <QueueSearchToolbar
                    searchAriaLabel={`Search ${section.title}`}
                    searchPlaceholder={`Search ${section.title.toLowerCase()}...`}
                    searchValue={sectionSearchTerm}
                    onSearchChange={(value) => handleSectionSearchChange(section.key, value)}
                    refreshLabel={`Refresh ${section.title}`}
                    refreshLoadingLabel={`Refreshing ${section.title}`}
                    refreshing={refreshing}
                    onRefresh={() => {
                      void refreshQueue();
                    }}
                    sortAriaLabel={`Sort ${section.title}. Current order: ${getPostPublishSortLabel(sortMode)}`}
                    sortValue={sortMode}
                    onSortChange={(value) => handleSortModeChange(value as UsedGearWorkflowPostPublishSortMode)}
                    sortOptions={[
                      { value: 'latest-activity', label: 'Latest Activity' },
                      { value: 'oldest-activity', label: 'Oldest Activity' },
                      { value: 'sku', label: 'SKU' },
                    ]}
                  />
                </div>
              ) : null}

              {visibleSectionRecords.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
                  <p className="m-0">
                    {normalizedSectionSearch
                      ? 'No rows match the current search for this section.'
                      : 'No rows currently match this post-publish stage.'}
                  </p>
                  <p className="mt-2 mb-0">
                    {normalizedSectionSearch
                      ? 'Adjust the search terms or clear the filter to see all items in this section.'
                      : getPostPublishSectionEmptyGuidance(section.key)}
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <IntakeItemsMatrix
                    items={visibleSectionRecords}
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
