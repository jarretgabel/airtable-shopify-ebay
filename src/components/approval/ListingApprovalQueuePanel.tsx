import { useEffect, useMemo, useState } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { AppPageStatSection } from '@/components/app/AppPageStatSection';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { accentActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import { errorSurfaceClass } from '@/components/tabs/uiClasses';
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

const queueFilterButtonClass = 'rounded-lg border px-3.5 py-2 text-[0.82rem] font-semibold transition';
const FILTER_STORAGE_PREFIX = 'approval-queue-filter';
const approvalQueueSurfaceClass = 'rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5';

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
  const supportsQuickFilters = approvalChannel !== 'combined';
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
    if (!supportsQuickFilters) return;
    writeStoredFilter(quickFilterStorageKey, activeQuickFilter);
  }, [activeQuickFilter, quickFilterStorageKey, supportsQuickFilters]);

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
      if (supportsQuickFilters) {
        const passesQuickFilter = matchesQuickFilter(record, approvedFieldName, requiredFieldNames, activeQuickFilter);
        if (!passesQuickFilter) return false;
      }

      const passesExtraFilter = activeExtraFilter === 'all'
        || extraFilterDefinitions.find((definition) => definition.id === activeExtraFilter)?.matches(record)
        || false;
      if (!passesExtraFilter) return false;
      if (!normalizedQuery) return true;

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
    supportsQuickFilters,
    titleFieldName,
    vendorFieldName,
  ]);

  const quickFilterCounts = useMemo(() => {
    if (!supportsQuickFilters) return null;

    return {
      all: records.length,
      pending: records.filter((record) => matchesQuickFilter(record, approvedFieldName, requiredFieldNames, 'pending')).length,
      ready: records.filter((record) => matchesQuickFilter(record, approvedFieldName, requiredFieldNames, 'ready')).length,
      'needs-fields': records.filter((record) => matchesQuickFilter(record, approvedFieldName, requiredFieldNames, 'needs-fields')).length,
      approved: records.filter((record) => matchesQuickFilter(record, approvedFieldName, requiredFieldNames, 'approved')).length,
    } satisfies Record<QueueQuickFilter, number>;
  }, [approvedFieldName, records, requiredFieldNames, supportsQuickFilters]);

  const extraFilterCounts = useMemo(() => {
    if (extraFilterDefinitions.length === 0) return null;

    return Object.fromEntries(
      extraFilterDefinitions.map((definition) => [definition.id, records.filter((record) => definition.matches(record)).length]),
    ) as Record<Exclude<QueueExtraFilter, 'all'>, number>;
  }, [extraFilterDefinitions, records]);

  const isFiltered = supportsQuickFilters
    ? filteredRecords.length !== records.length
    : searchQuery.trim().length > 0 || (activeExtraFilter !== 'all' && filteredRecords.length !== records.length);
  const summaryStats = useMemo(() => {
    if (approvalChannel === 'combined') {
      return [
        { label: 'Loaded Rows', value: records.length },
        { label: 'Needs Review', value: extraFilterCounts?.['workflow-pre-listing-review'] ?? 0 },
        { label: 'Approved To Publish', value: extraFilterCounts?.['workflow-approved-for-publish'] ?? 0 },
        { label: 'Showing', value: filteredRecords.length },
      ];
    }

    return [
      { label: 'Loaded Rows', value: records.length },
      { label: 'Pending', value: quickFilterCounts?.pending ?? 0 },
      { label: 'Ready', value: quickFilterCounts?.ready ?? 0 },
      { label: 'Approved', value: quickFilterCounts?.approved ?? 0 },
    ];
  }, [approvalChannel, extraFilterCounts, filteredRecords.length, quickFilterCounts, records.length]);

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
        <section className={approvalQueueSurfaceClass}>
          <ListingApprovalQueueSkeleton />
        </section>
      ) : hasTableReference ? (
        <section className={approvalQueueSurfaceClass}>
          <AppPageStatSection
            stats={summaryStats}
            dividerBelow
            className="mb-4"
            actions={approvalChannel === 'shopify' ? (
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
            ) : undefined}
          />

          <QueueSearchToolbar
            searchAriaLabel={approvalChannel === 'shopify'
              ? 'Search Shopify listing queue'
              : approvalChannel === 'ebay'
                ? 'Search eBay listing queue'
                : 'Search combined listing queue'}
            searchPlaceholder={approvalChannel === 'shopify'
              ? 'Search Shopify listings, brand, vendor, or workflow status…'
              : approvalChannel === 'ebay'
                ? 'Search eBay listings, brand, vendor, or workflow status…'
                : 'Search combined listings, brand, vendor, or workflow status…'}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            refreshLabel={!supportsQuickFilters ? 'Refresh listing approval queue' : undefined}
            refreshLoadingLabel={!supportsQuickFilters ? 'Refreshing listing approval queue' : undefined}
            refreshing={!supportsQuickFilters ? loading : undefined}
            onRefresh={!supportsQuickFilters ? (() => {
              trackWorkflowEvent('approval_queue_refreshed', {
                tableReference,
              });
              void loadRecords(tableReference, tableName ?? '', true);
            }) : undefined}
            filters={!supportsQuickFilters && extraFilterDefinitions.length > 0
              ? [{
                ariaLabel: 'Filter combined listing queue',
                value: activeExtraFilter,
                options: [
                  { value: 'all', label: 'All Workflow Stages' },
                  ...extraFilterDefinitions.map((definition) => ({ value: definition.id, label: definition.label })),
                ],
                onChange: (value) => setActiveExtraFilter(value as QueueExtraFilter),
              }]
              : undefined}
            compactFilters={!supportsQuickFilters}
            className="mb-4"
          />

          {supportsQuickFilters ? (
            <div className="mb-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'ready', 'needs-fields', 'approved'] as const).map((filter) => {
                  const active = activeQuickFilter === filter;
                  const count = quickFilterCounts?.[filter] ?? 0;

                  return (
                    <button
                      key={filter}
                      type="button"
                      className={`${queueFilterButtonClass} ${active ? 'border-sky-400/35 bg-sky-500/15 text-sky-100' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-sky-400/25 hover:text-[var(--ink)]'}`}
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
                        className={`${queueFilterButtonClass} ${active ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-emerald-400/25 hover:text-[var(--ink)]'}`}
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

          <p className="m-0 mb-4 text-sm text-[var(--muted)]">
            <strong>{filteredRecords.length}</strong>
            {isFiltered ? ` of ${records.length}` : ''} listing rows {supportsQuickFilters || isFiltered ? 'shown' : 'loaded'}.
          </p>

          {(supportsQuickFilters || searchQuery.trim().length > 0 || activeExtraFilter !== 'all') && filteredRecords.length === 0 ? (
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
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow="Review"
        title="Combined Listings"
      />

      {queuePanel}
    </AppPageLayout>
  );
}