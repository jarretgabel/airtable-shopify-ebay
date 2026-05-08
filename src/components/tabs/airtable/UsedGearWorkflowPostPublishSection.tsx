import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  loadWorkflowPostPublishQueue,
  markWorkflowListingStale,
  markWorkflowShipped,
  markWorkflowSoldReadyToShip,
} from '@/services/usedGearQueue';
import {
  getUsedGearWorkflowPostPublishSnapshot,
  USED_GEAR_STALE_THRESHOLD_DAYS,
  type UsedGearWorkflowPostPublishBucket,
} from '@/services/usedGearWorkflowLifecycle';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearWorkflowPostPublishSectionProps {
  focusedBucket?: UsedGearWorkflowPostPublishBucket | null;
  onFocusedBucketChange?: (bucket: UsedGearWorkflowPostPublishBucket | 'all') => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  collapsedSectionKeys?: UsedGearWorkflowPostPublishBucket[];
  onCollapsedSectionKeysChange?: (keys: UsedGearWorkflowPostPublishBucket[]) => void;
  sortMode?: UsedGearWorkflowPostPublishSortMode;
  onSortModeChange?: (value: UsedGearWorkflowPostPublishSortMode) => void;
}

export type UsedGearWorkflowPostPublishSortMode = 'latest-activity' | 'oldest-activity' | 'sku';

interface PostPublishSectionDefinition {
  key: UsedGearWorkflowPostPublishBucket;
  title: string;
  description: string;
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
  focusedBucket = null,
  onFocusedBucketChange,
  onOpenWorkflowRecord,
  onOpenListingsRecord,
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
    if (!normalizedSearch) {
      return records;
    }

    return records.filter((record) => recordSearchText(record).includes(normalizedSearch));
  }, [records, searchTerm]);

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

  const visibleSections = useMemo(() => {
    if (selectedBucket === 'all') {
      return SECTION_DEFINITIONS;
    }

    return SECTION_DEFINITIONS.filter((section) => section.key === selectedBucket);
  }, [selectedBucket]);
  const visibleSectionKeys = useMemo(
    () => visibleSections.map((section) => section.key),
    [visibleSections],
  );
  const collapsedSectionKeySet = useMemo(() => new Set(collapsedSectionKeys), [collapsedSectionKeys]);
  const allVisibleSectionsCollapsed = visibleSectionKeys.length > 0
    && visibleSectionKeys.every((sectionKey) => collapsedSectionKeySet.has(sectionKey));

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

  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const handleSearchTermChange = (value: string) => {
    if (typeof controlledSearchTerm !== 'string') {
      setUncontrolledSearchTerm(value);
    }

    onSearchTermChange?.(value);
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

      {!loading && filteredRecords.length === 0 ? (
        <EmptySurface title="No post-publish workflow rows" message="The used-gear workflow currently has no listed, stale, sold-ready, or shipped rows." />
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading used-gear post-publish queue...
          </div>
        ) : visibleSections.map((section) => {
          const sectionRecords = recordsBySection.get(section.key) ?? [];
          const collapsed = collapsedSectionKeySet.has(section.key);

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
                </div>
              </div>

              {collapsed ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
                  This lifecycle bucket is collapsed in the current shared queue view.
                </div>
              ) : sectionRecords.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
                  No rows currently match this post-publish stage.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {sectionRecords.map((record) => {
                    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
                    if (!snapshot) return null;

                    const busy = actionRecordId === record.id;
                    const canMarkStale = snapshot.status === 'Listed, Shopify' || snapshot.status === 'Listed, eBay';
                    const canMarkSoldReady = snapshot.bucket === 'active-listing' || snapshot.bucket === 'stale-listing';
                    const canMarkShipped = snapshot.bucket === 'sold-ready';

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

                        <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                          <div>Listed At: {displayInventoryValue(snapshot.listedAt)}</div>
                          <div>Days Live: {snapshot.daysSinceListed ?? '—'}</div>
                          <div>Stale At: {displayInventoryValue(snapshot.staleListingAt)}</div>
                          <div>Sold Ready At: {displayInventoryValue(snapshot.soldReadyToShipAt)}</div>
                          <div>Shipped At: {displayInventoryValue(snapshot.shippedAt)}</div>
                          <div>Price: {displayInventoryValue(record.fields.Price || record.fields['Shopify Price'] || record.fields['eBay Price'])}</div>
                        </div>

                        {snapshot.bucket !== 'shipped' && snapshot.isPastStaleThreshold && snapshot.status !== 'Stale Listing, Shopify' && snapshot.status !== 'Stale Listing, eBay' ? (
                          <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
                            This listing has been live for {snapshot.daysSinceListed ?? 0} days and has crossed the {snapshot.staleThresholdDays}-day stale threshold.
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            onClick={() => onOpenWorkflowRecord(record.id)}
                          >
                            Workflow Detail
                          </button>
                          {snapshot.bucket !== 'sold-ready' && snapshot.bucket !== 'shipped' ? (
                            <button
                              type="button"
                              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              onClick={() => onOpenListingsRecord(record.id)}
                            >
                              Open Listings Approval
                            </button>
                          ) : null}
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
