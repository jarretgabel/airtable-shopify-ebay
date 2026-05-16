import { useEffect, useMemo, useState } from 'react';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { RefreshIconButton } from '@/components/app/RefreshIconButton';
import { accentActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import { errorSurfaceClass, panelSurfaceClass } from '@/components/tabs/uiClasses';
import { isReadyForRequiredFields } from '@/components/approval/requiredFieldStatus';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import { displayValue } from '@/stores/approvalStore';
import { AirtableRecord } from '@/types/airtable';

type QueueQuickFilter = 'all' | 'pending' | 'ready' | 'needs-fields' | 'approved';
type QueueExtraFilter = 'all' | 'shopify-active' | 'shopify-draft' | 'shopify-archived' | 'ebay-live' | 'ebay-draft-offer' | 'ebay-approved-to-publish' | 'ebay-stale' | 'workflow-pre-listing-review' | 'workflow-approved-for-publish';

interface QueueExtraFilterDefinition {
  id: Exclude<QueueExtraFilter, 'all'>;
  label: string;
  matches: (record: AirtableRecord) => boolean;
}

const COMBINED_LISTING_GUIDANCE_CARDS = [
  {
    label: 'Listing Phase Entry',
    description: 'Rows first land here at Awaiting Pre-Listing Review after both testing and photography signoffs are complete.',
  },
  {
    label: 'Review And Correct Here',
    description: 'Use the selected listing record to resolve pricing, content, and readiness blockers instead of sending operators to a separate pre-listing page.',
  },
  {
    label: 'Publish After Approval',
    description: 'Approve for publish from the listing record first, then hand off into Shopify, eBay, or both from the same listing-phase surface.',
  },
] as const;

const searchInputClass = 'flex-1 min-w-[220px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.82rem] text-[var(--ink)] placeholder-[var(--muted)] outline-none transition-colors focus:border-[var(--accent)]';
const FILTER_STORAGE_PREFIX = 'approval-queue-filter';

function isApprovedRecord(record: AirtableRecord, approvedFieldName: string): boolean {
  const raw = record.fields[approvedFieldName];
  return raw === true || String(raw ?? '').toLowerCase() === 'true' || String(raw ?? '').toLowerCase() === 'yes';
}

function buildSearchableRecordText(
  record: AirtableRecord,
  fieldNames: string[],
): string {
  return fieldNames
    .filter((fieldName) => fieldName.trim().length > 0)
    .map((fieldName) => displayValue(record.fields[fieldName]))
    .join(' ')
    .toLowerCase();
}

function readStoredFilter<T extends string>(storageKey: string, fallback: T, allowedValues: readonly T[]): T {
  if (typeof window === 'undefined') return fallback;

  const raw = window.localStorage.getItem(storageKey);
  return raw && allowedValues.includes(raw as T) ? (raw as T) : fallback;
}

function writeStoredFilter(storageKey: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, value);
}

function getRecordFieldText(record: AirtableRecord, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    if (!fieldName.trim()) continue;
    const rawValue = record.fields[fieldName];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    const text = displayValue(rawValue).trim();
    if (text && text !== '—') return text;
  }

  return '';
}

function normalizeShopifyStatus(record: AirtableRecord, formatFieldName: string): string {
  return getRecordFieldText(record, [formatFieldName, 'Shopify REST Status', 'Shopify Status', 'Shopify GraphQL Status', 'Status']).trim().toLowerCase();
}

function normalizeEbayWorkflowStatus(record: AirtableRecord): string {
  return getRecordFieldText(record, ['Workflow Status']).trim().toLowerCase();
}

function normalizeEbayOfferStatus(record: AirtableRecord): string {
  return getRecordFieldText(record, ['eBay Offer Status', 'Offer Status', 'eBay Inventory Status']).trim().toLowerCase();
}

function buildExtraFilterDefinitions(
  approvalChannel: 'shopify' | 'ebay' | 'combined',
  records: AirtableRecord[],
  formatFieldName: string,
): QueueExtraFilterDefinition[] {
  if (approvalChannel === 'shopify') {
    const definitions: QueueExtraFilterDefinition[] = [
      {
        id: 'shopify-active',
        label: 'Active',
        matches: (record) => normalizeShopifyStatus(record, formatFieldName) === 'active',
      },
      {
        id: 'shopify-draft',
        label: 'Draft',
        matches: (record) => normalizeShopifyStatus(record, formatFieldName) === 'draft',
      },
      {
        id: 'shopify-archived',
        label: 'Archived',
        matches: (record) => normalizeShopifyStatus(record, formatFieldName) === 'archived',
      },
    ];

    return definitions.filter((definition) => records.some((record) => definition.matches(record)));
  }

  if (approvalChannel === 'ebay') {
    const definitions: QueueExtraFilterDefinition[] = [
      {
        id: 'ebay-live',
        label: 'Live Offer',
        matches: (record) => {
          const offerStatus = normalizeEbayOfferStatus(record);
          const workflowStatus = normalizeEbayWorkflowStatus(record);
          return offerStatus === 'active' || offerStatus === 'published' || offerStatus === 'live' || workflowStatus === 'listed, ebay';
        },
      },
      {
        id: 'ebay-draft-offer',
        label: 'Draft Offer',
        matches: (record) => normalizeEbayOfferStatus(record) === 'draft',
      },
      {
        id: 'ebay-approved-to-publish',
        label: 'Approved to Publish',
        matches: (record) => normalizeEbayWorkflowStatus(record) === 'approved for publish',
      },
      {
        id: 'ebay-stale',
        label: 'Stale',
        matches: (record) => normalizeEbayWorkflowStatus(record) === 'stale listing, ebay',
      },
    ];

    return definitions.filter((definition) => records.some((record) => definition.matches(record)));
  }

  if (approvalChannel === 'combined') {
    const definitions: QueueExtraFilterDefinition[] = [
      {
        id: 'workflow-pre-listing-review',
        label: 'Needs Review',
        matches: (record) => normalizeEbayWorkflowStatus(record) === 'awaiting pre-listing review',
      },
      {
        id: 'workflow-approved-for-publish',
        label: 'Approved to Publish',
        matches: (record) => normalizeEbayWorkflowStatus(record) === 'approved for publish',
      },
    ];

    return definitions.filter((definition) => records.some((record) => definition.matches(record)));
  }

  return [];
}

function matchesQuickFilter(
  record: AirtableRecord,
  approvedFieldName: string,
  requiredFieldNames: string[],
  filter: QueueQuickFilter,
): boolean {
  const approved = isApprovedRecord(record, approvedFieldName);
  const missingRequiredFields = !isReadyForRequiredFields(record.fields, requiredFieldNames);

  switch (filter) {
    case 'approved':
      return approved;
    case 'needs-fields':
      return missingRequiredFields;
    case 'ready':
      return !approved && !missingRequiredFields;
    case 'pending':
      return !approved;
    default:
      return true;
  }
}

function quickFilterLabel(filter: QueueQuickFilter): string {
  switch (filter) {
    case 'pending':
      return 'Pending';
    case 'ready':
      return 'Ready';
    case 'needs-fields':
      return 'Needs Fields';
    case 'approved':
      return 'Approved';
    default:
      return 'All';
  }
}

function defaultQuickFilterForChannel(channel: 'shopify' | 'ebay' | 'combined'): QueueQuickFilter {
  if (channel === 'shopify') return 'pending';
  if (channel === 'ebay') return 'ready';
  return 'all';
}

function ListingApprovalQueueSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded-md bg-white/10" />
          <div className="h-6 w-52 animate-pulse rounded-md bg-white/10" />
          <div className="h-4 w-40 animate-pulse rounded-md bg-white/10" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-xl bg-white/10" />
      </div>
      <div className="h-4 w-36 animate-pulse rounded-md bg-white/10" />
      <div className="overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--bg)]">
        <div className="grid grid-cols-4 gap-3 border-b border-[var(--line)] px-4 py-3 max-md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={`header-${index}`} className="h-3 animate-pulse rounded-md bg-white/10" />
          ))}
        </div>
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={`row-${index}`} className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
              {Array.from({ length: 4 }, (_, columnIndex) => (
                <div key={`cell-${index}-${columnIndex}`} className="h-4 animate-pulse rounded-md bg-white/10" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ListingApprovalQueuePanelProps {
  hasTableReference: boolean;
  error: string | null;
  loading: boolean;
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  creatingShopifyListing: boolean;
  saving: boolean;
  tableReference: string;
  tableName?: string;
  records: AirtableRecord[];
  approvedFieldName: string;
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
  combinedRequiredFieldNames: string[];
  titleFieldName: string;
  formatFieldName: string;
  priceFieldName: string;
  vendorFieldName: string;
  qtyFieldName: string;
  openRecord: (record: AirtableRecord) => void;
  onSelectRecord: (recordId: string) => void;
  createNewShopifyListing: () => Promise<void>;
  loadRecords: (tableReference: string, tableName?: string, force?: boolean) => Promise<void>;
}

export function ListingApprovalQueuePanel({
  hasTableReference,
  error,
  loading,
  approvalChannel,
  creatingShopifyListing,
  saving,
  tableReference,
  tableName,
  records,
  approvedFieldName,
  shopifyRequiredFieldNames,
  ebayRequiredFieldNames,
  combinedRequiredFieldNames,
  titleFieldName,
  formatFieldName,
  priceFieldName,
  vendorFieldName,
  qtyFieldName,
  openRecord,
  onSelectRecord,
  createNewShopifyListing,
  loadRecords,
}: ListingApprovalQueuePanelProps) {
  const isCombinedApproval = approvalChannel === 'combined';
  const supportsSearchAndQuickFilters = approvalChannel !== 'combined';
  const quickFilterStorageKey = `${FILTER_STORAGE_PREFIX}:${approvalChannel}:quick`;
  const extraFilterStorageKey = `${FILTER_STORAGE_PREFIX}:${approvalChannel}:extra`;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuickFilter, setActiveQuickFilter] = useState<QueueQuickFilter>(() => readStoredFilter(quickFilterStorageKey, defaultQuickFilterForChannel(approvalChannel), ['all', 'pending', 'ready', 'needs-fields', 'approved'] as const));
  const [activeExtraFilter, setActiveExtraFilter] = useState<QueueExtraFilter>(() => readStoredFilter(extraFilterStorageKey, 'all', ['all', 'shopify-active', 'shopify-draft', 'shopify-archived', 'ebay-live', 'ebay-draft-offer', 'ebay-approved-to-publish', 'ebay-stale', 'workflow-pre-listing-review', 'workflow-approved-for-publish'] as const));
  const requiredFieldNames = approvalChannel === 'shopify'
    ? shopifyRequiredFieldNames
    : approvalChannel === 'ebay'
      ? ebayRequiredFieldNames
      : combinedRequiredFieldNames;
  const extraFilterDefinitions = useMemo(
    () => buildExtraFilterDefinitions(approvalChannel, records, formatFieldName),
    [approvalChannel, formatFieldName, records],
  );

  useEffect(() => {
    if (!supportsSearchAndQuickFilters) return;
    writeStoredFilter(quickFilterStorageKey, activeQuickFilter);
  }, [activeQuickFilter, quickFilterStorageKey, supportsSearchAndQuickFilters]);

  useEffect(() => {
    if (extraFilterDefinitions.length === 0) return;
    const allowedExtraFilters = new Set<QueueExtraFilter>(['all', ...extraFilterDefinitions.map((definition) => definition.id)]);
    if (!allowedExtraFilters.has(activeExtraFilter)) {
      setActiveExtraFilter('all');
      return;
    }

    writeStoredFilter(extraFilterStorageKey, activeExtraFilter);
  }, [activeExtraFilter, extraFilterDefinitions, extraFilterStorageKey]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchableFieldNames = [
      titleFieldName,
      vendorFieldName,
      formatFieldName,
      priceFieldName,
      qtyFieldName,
      'Workflow Status',
      'SKU',
      'Model',
      'Brand',
    ];

    return records.filter((record) => {
      if (supportsSearchAndQuickFilters) {
        const passesQuickFilter = matchesQuickFilter(record, approvedFieldName, requiredFieldNames, activeQuickFilter);
        if (!passesQuickFilter) return false;
      }

      const passesExtraFilter = activeExtraFilter === 'all'
        || extraFilterDefinitions.find((definition) => definition.id === activeExtraFilter)?.matches(record)
        || false;
      if (!passesExtraFilter) return false;
      if (!supportsSearchAndQuickFilters || !normalizedQuery) return true;

      return buildSearchableRecordText(record, searchableFieldNames).includes(normalizedQuery);
    });
  }, [
    activeExtraFilter,
    activeQuickFilter,
    approvedFieldName,
    extraFilterDefinitions,
    formatFieldName,
    priceFieldName,
    qtyFieldName,
    records,
    requiredFieldNames,
    searchQuery,
    supportsSearchAndQuickFilters,
    titleFieldName,
    vendorFieldName,
  ]);

  const quickFilterCounts = useMemo(() => {
    if (!supportsSearchAndQuickFilters) return null;

    return {
      all: records.length,
      pending: records.filter((record) => matchesQuickFilter(record, approvedFieldName, requiredFieldNames, 'pending')).length,
      ready: records.filter((record) => matchesQuickFilter(record, approvedFieldName, requiredFieldNames, 'ready')).length,
      'needs-fields': records.filter((record) => matchesQuickFilter(record, approvedFieldName, requiredFieldNames, 'needs-fields')).length,
      approved: records.filter((record) => matchesQuickFilter(record, approvedFieldName, requiredFieldNames, 'approved')).length,
    } satisfies Record<QueueQuickFilter, number>;
  }, [approvedFieldName, records, requiredFieldNames, supportsSearchAndQuickFilters]);

  const extraFilterCounts = useMemo(() => {
    if (extraFilterDefinitions.length === 0) return null;

    return Object.fromEntries(
      extraFilterDefinitions.map((definition) => [definition.id, records.filter((record) => definition.matches(record)).length]),
    ) as Record<Exclude<QueueExtraFilter, 'all'>, number>;
  }, [extraFilterDefinitions, records]);

  const isFiltered = supportsSearchAndQuickFilters
    ? filteredRecords.length !== records.length
    : activeExtraFilter !== 'all' && filteredRecords.length !== records.length;

  const queuePanel = (
    <>
      {!hasTableReference && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Listing approval source is not configured</p>
          <p className="mt-2 text-[var(--error-text)]/85">
            Set the Airtable table reference env variable for this page and refresh.
          </p>
        </section>
      )}

      {error && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Error loading approval workflow</p>
          <p className="mt-2 text-[var(--error-text)]/85">{error}</p>
        </section>
      )}

      {hasTableReference && loading ? (
        <section className={panelSurfaceClass}>
          <ListingApprovalQueueSkeleton />
        </section>
      ) : hasTableReference ? (
        <section className={panelSurfaceClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow</p>
              <h3 className="m-0 mt-1 text-[1.08rem] font-semibold text-[var(--ink)]">Listing Update & Approval</h3>
              <p className="m-0 mt-1 text-sm text-[var(--muted)]">
                Source: <code>{tableReference}</code>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {approvalChannel === 'shopify' && (
                <button
                  type="button"
                  className={accentActionButtonClass}
                  onClick={() => {
                    void createNewShopifyListing();
                  }}
                  disabled={loading || saving || creatingShopifyListing}
                >
                  {creatingShopifyListing ? 'Creating Listing...' : 'New Shopify Listing'}
                </button>
              )}
              <RefreshIconButton
                onClick={() => {
                  trackWorkflowEvent('approval_queue_refreshed', {
                    tableReference,
                  });
                  void loadRecords(tableReference, tableName ?? '', true);
                }}
                disabled={loading}
                loading={loading}
                label="Refresh listing approval queue"
                loadingLabel="Refreshing listing approval queue"
              />
            </div>
          </div>

          {supportsSearchAndQuickFilters ? (
            <div className="mb-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className={searchInputClass}
                  placeholder={approvalChannel === 'shopify' ? 'Search Shopify listings, brand, vendor, or workflow status…' : 'Search eBay listings, brand, vendor, or workflow status…'}
                  aria-label={approvalChannel === 'shopify' ? 'Search Shopify listing queue' : 'Search eBay listing queue'}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'ready', 'needs-fields', 'approved'] as const).map((filter) => {
                  const active = activeQuickFilter === filter;
                  const count = quickFilterCounts?.[filter] ?? 0;

                  return (
                    <button
                      key={filter}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-sky-400/35 bg-sky-500/15 text-sky-100' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-sky-400/25 hover:text-[var(--ink)]'}`}
                      onClick={() => setActiveQuickFilter(filter)}
                      aria-pressed={active}
                    >
                      {quickFilterLabel(filter)} · {count}
                    </button>
                  );
                })}
              </div>

              {extraFilterDefinitions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {extraFilterDefinitions.map((definition) => {
                    const active = activeExtraFilter === definition.id;
                    const count = extraFilterCounts?.[definition.id] ?? 0;

                    return (
                      <button
                        key={definition.id}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-emerald-400/25 hover:text-[var(--ink)]'}`}
                        onClick={() => setActiveExtraFilter(active ? 'all' : definition.id)}
                        aria-pressed={active}
                      >
                        {definition.label} · {count}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {!supportsSearchAndQuickFilters && extraFilterDefinitions.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {extraFilterDefinitions.map((definition) => {
                const active = activeExtraFilter === definition.id;
                const count = extraFilterCounts?.[definition.id] ?? 0;

                return (
                  <button
                    key={definition.id}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-cyan-400/25 hover:text-[var(--ink)]'}`}
                    onClick={() => setActiveExtraFilter(active ? 'all' : definition.id)}
                    aria-pressed={active}
                  >
                    {definition.label} · {count}
                  </button>
                );
              })}
            </div>
          ) : null}

          <p className="m-0 mb-4 text-sm text-[var(--muted)]">
            <strong>{filteredRecords.length}</strong>
            {isFiltered ? ` of ${records.length}` : ''} listing rows {supportsSearchAndQuickFilters || isFiltered ? 'shown' : 'loaded'}.
          </p>

          {(supportsSearchAndQuickFilters || activeExtraFilter !== 'all') && filteredRecords.length === 0 ? (
            <section className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              No listing rows match the current filters.
            </section>
          ) : null}

          {filteredRecords.length > 0 ? (
            <ApprovalQueueTable
              records={filteredRecords}
              approvedFieldName={approvedFieldName}
              requiredFieldNames={requiredFieldNames}
              readinessColumns={approvalChannel === 'combined' ? [
                { key: 'shopify', label: 'Shopify Ready', requiredFieldNames: shopifyRequiredFieldNames },
                { key: 'ebay', label: 'eBay Ready', requiredFieldNames: ebayRequiredFieldNames },
              ] : []}
              titleFieldName={titleFieldName}
              conditionFieldName=""
              formatFieldName={approvalChannel === 'ebay' || approvalChannel === 'combined' ? '' : formatFieldName}
              priceFieldName={approvalChannel === 'shopify' ? '' : priceFieldName}
              vendorFieldName={vendorFieldName}
              qtyFieldName={approvalChannel === 'ebay' ? '' : qtyFieldName}
              openRecord={openRecord}
              onSelectRecord={onSelectRecord}
            />
          ) : null}
        </section>
      ) : null}
    </>
  );

  if (!isCombinedApproval) {
    return queuePanel;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <WorkflowPageHeader
        eyebrow="Used Gear Workflow"
        title="Combined Listings"
        description="Listings is the first listing-phase directory after testing and photography complete. Review listing readiness, correct marketplace data, approve for publish, and manage live lifecycle work from this one surface."
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Listing-Phase Entry Point</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <p className="m-0">Awaiting Pre-Listing Review is the first listing-phase state shown here. Rows should not appear on this page while testing or photography is still in progress.</p>
            <p className="m-0">Use the queue to find listing-ready work, open the selected record for pricing and content review, and keep publish approval on the listing page instead of routing through a separate workflow review destination.</p>
            <p className="m-0">The queue chips divide incoming review work from approved-to-publish rows so listing operators can separate final QA from publish execution and later lifecycle follow-through.</p>
          </div>
        </div>

        <aside className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Working Rules</p>
          <div className="mt-4 space-y-3">
            {COMBINED_LISTING_GUIDANCE_CARDS.map((card) => (
              <div key={card.label} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                <p className="m-0 text-sm font-semibold text-[var(--ink)]">{card.label}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{card.description}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <div className="max-w-3xl">
        <CollapsibleHelperText label="Listing-phase guide">
          Use the combined queue for discovery and the selected record for the actual review gate. If a blocker points back to intake, testing, photos, or pricing source data, open the upstream record from the listing page, fix the source, then return here to approve and publish.
        </CollapsibleHelperText>
      </div>

      {queuePanel}
    </div>
  );
}