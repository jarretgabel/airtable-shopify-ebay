import { useEffect, useMemo, useState } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { AppPageStatSection } from '@/components/app/AppPageStatSection';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
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
type CombinedQueueSectionKey = 'ready-for-publishing' | 'needs-further-work';
type CombinedQueueSortMode = 'default' | 'title-asc' | 'vendor-asc' | 'price-desc' | 'price-asc';

interface QueueExtraFilterDefinition {
  id: Exclude<QueueExtraFilter, 'all'>;
  label: string;
  matches: (record: AirtableRecord) => boolean;
}

const queueFilterButtonClass = 'rounded-lg border px-3.5 py-2 text-[0.82rem] font-semibold transition';
const FILTER_STORAGE_PREFIX = 'approval-queue-filter';
const approvalQueueSurfaceClass = 'rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5';
const COMBINED_QUEUE_SECTION_IDS: Record<CombinedQueueSectionKey, string> = {
  'ready-for-publishing': 'combined-listings-ready-for-publishing',
  'needs-further-work': 'combined-listings-needs-further-work',
};

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

function isCombinedRecordReadyForPublishing(
  record: AirtableRecord,
  approvedFieldName: string,
  combinedRequiredFieldNames: string[],
  shopifyRequiredFieldNames: string[],
  ebayRequiredFieldNames: string[],
): boolean {
  return isApprovedRecord(record, approvedFieldName)
    && isReadyForRequiredFields(record.fields, combinedRequiredFieldNames)
    && isReadyForRequiredFields(record.fields, shopifyRequiredFieldNames)
    && isReadyForRequiredFields(record.fields, ebayRequiredFieldNames);
}

function normalizeEbayOfferStatus(record: AirtableRecord): string {
  return getRecordFieldText(record, ['eBay Offer Status', 'Offer Status', 'eBay Inventory Status']).trim().toLowerCase();
}

function normalizeCombinedWorkflowStatus(record: AirtableRecord): string {
  return getRecordFieldText(record, ['Workflow Status']).trim();
}

function getCombinedSortLabel(mode: CombinedQueueSortMode): string {
  switch (mode) {
    case 'title-asc':
      return 'Title A-Z';
    case 'vendor-asc':
      return 'Vendor A-Z';
    case 'price-desc':
      return 'Highest Price';
    case 'price-asc':
      return 'Lowest Price';
    default:
      return 'Default Order';
  }
}

function parseSortableNumber(value: unknown): number | null {
  const raw = displayValue(value).replace(/[^0-9.-]+/g, '');
  if (!raw) return null;

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortCombinedRecords(
  records: AirtableRecord[],
  sortMode: CombinedQueueSortMode,
  titleFieldName: string,
  vendorFieldName: string,
  priceFieldName: string,
): AirtableRecord[] {
  if (sortMode === 'default') return records;

  const sortedRecords = [...records];
  sortedRecords.sort((left, right) => {
    if (sortMode === 'title-asc') {
      return getRecordFieldText(left, [titleFieldName]).localeCompare(getRecordFieldText(right, [titleFieldName]), undefined, { sensitivity: 'base' });
    }

    if (sortMode === 'vendor-asc') {
      return getRecordFieldText(left, [vendorFieldName]).localeCompare(getRecordFieldText(right, [vendorFieldName]), undefined, { sensitivity: 'base' });
    }

    const leftPrice = parseSortableNumber(left.fields[priceFieldName]);
    const rightPrice = parseSortableNumber(right.fields[priceFieldName]);
    if (leftPrice === null && rightPrice === null) return 0;
    if (leftPrice === null) return 1;
    if (rightPrice === null) return -1;

    return sortMode === 'price-desc' ? rightPrice - leftPrice : leftPrice - rightPrice;
  });

  return sortedRecords;
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
  const combinedSectionItems = useMemo(
    () => isCombinedApproval
      ? [
        { id: COMBINED_QUEUE_SECTION_IDS['ready-for-publishing'], key: 'ready-for-publishing' as const, label: 'Ready for Publishing' },
        { id: COMBINED_QUEUE_SECTION_IDS['needs-further-work'], key: 'needs-further-work' as const, label: 'Needs Further Work' },
      ]
      : [{ id: 'listing-approval-queue', key: 'needs-further-work' as const, label: 'Listing Queue' }],
    [isCombinedApproval],
  );
  const { activeSectionId, scrollToSection } = usePageSectionTracking(combinedSectionItems, combinedSectionItems[0]?.id ?? 'listing-approval-queue');
  const activeCombinedSectionKey = useMemo<CombinedQueueSectionKey>(
    () => combinedSectionItems.find((item) => item.id === activeSectionId)?.key ?? 'ready-for-publishing',
    [activeSectionId, combinedSectionItems],
  );
  const supportsQuickFilters = approvalChannel !== 'combined';
  const quickFilterStorageKey = `${FILTER_STORAGE_PREFIX}:${approvalChannel}:quick`;
  const extraFilterStorageKey = `${FILTER_STORAGE_PREFIX}:${approvalChannel}:extra`;
  const [searchQuery, setSearchQuery] = useState('');
  const [combinedReadySearchQuery, setCombinedReadySearchQuery] = useState('');
  const [combinedWorkSearchQuery, setCombinedWorkSearchQuery] = useState('');
  const [combinedReadySortMode, setCombinedReadySortMode] = useState<CombinedQueueSortMode>('default');
  const [combinedWorkSortMode, setCombinedWorkSortMode] = useState<CombinedQueueSortMode>('default');
  const [combinedReadyWorkflowFilter, setCombinedReadyWorkflowFilter] = useState('all');
  const [combinedWorkWorkflowFilter, setCombinedWorkWorkflowFilter] = useState('all');
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

      const passesExtraFilter = isCombinedApproval
        ? true
        : activeExtraFilter === 'all'
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
    isCombinedApproval,
    supportsQuickFilters,
    titleFieldName,
    vendorFieldName,
  ]);

  const combinedReadyForPublishingRecords = useMemo(
    () => isCombinedApproval
      ? filteredRecords.filter((record) => isCombinedRecordReadyForPublishing(
        record,
        approvedFieldName,
        combinedRequiredFieldNames,
        shopifyRequiredFieldNames,
        ebayRequiredFieldNames,
      ))
      : [],
    [
      approvedFieldName,
      combinedRequiredFieldNames,
      ebayRequiredFieldNames,
      filteredRecords,
      isCombinedApproval,
      shopifyRequiredFieldNames,
    ],
  );
  const combinedNeedsFurtherWorkRecords = useMemo(
    () => isCombinedApproval
      ? filteredRecords.filter((record) => !isCombinedRecordReadyForPublishing(
        record,
        approvedFieldName,
        combinedRequiredFieldNames,
        shopifyRequiredFieldNames,
        ebayRequiredFieldNames,
      ))
      : [],
    [
      approvedFieldName,
      combinedRequiredFieldNames,
      ebayRequiredFieldNames,
      filteredRecords,
      isCombinedApproval,
      shopifyRequiredFieldNames,
    ],
  );
  const combinedReadyWorkflowOptions = useMemo(() => {
    const statusValues = Array.from(
      new Set(
        combinedReadyForPublishingRecords
          .map((record) => normalizeCombinedWorkflowStatus(record))
          .filter((value) => value.length > 0),
      ),
    ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

    return [
      { value: 'all', label: 'All Statuses' },
      ...statusValues.map((value) => ({ value, label: value })),
    ];
  }, [combinedReadyForPublishingRecords]);
  const combinedWorkWorkflowOptions = useMemo(() => {
    const statusValues = Array.from(
      new Set(
        combinedNeedsFurtherWorkRecords
          .map((record) => normalizeCombinedWorkflowStatus(record))
          .filter((value) => value.length > 0),
      ),
    ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

    return [
      { value: 'all', label: 'All Statuses' },
      ...statusValues.map((value) => ({ value, label: value })),
    ];
  }, [combinedNeedsFurtherWorkRecords]);
  const filteredCombinedReadyForPublishingRecords = useMemo(() => {
    if (!isCombinedApproval) return [];
    const normalizedQuery = combinedReadySearchQuery.trim().toLowerCase();
    const readyRecords = combinedReadyForPublishingRecords.filter((record) => {
      const workflowStatus = normalizeCombinedWorkflowStatus(record);
      if (combinedReadyWorkflowFilter !== 'all' && workflowStatus !== combinedReadyWorkflowFilter) return false;
      if (!normalizedQuery) return true;

      return buildSearchableRecordText(record, [
        titleFieldName,
        vendorFieldName,
        priceFieldName,
        qtyFieldName,
        'Workflow Status',
        'SKU',
        'Model',
        'Brand',
      ]).includes(normalizedQuery);
    });

    return sortCombinedRecords(readyRecords, combinedReadySortMode, titleFieldName, vendorFieldName, priceFieldName);
  }, [
    combinedReadyForPublishingRecords,
    combinedReadySearchQuery,
    combinedReadySortMode,
    combinedReadyWorkflowFilter,
    isCombinedApproval,
    priceFieldName,
    qtyFieldName,
    titleFieldName,
    vendorFieldName,
  ]);
  const filteredCombinedNeedsFurtherWorkRecords = useMemo(() => {
    if (!isCombinedApproval) return [];
    const normalizedQuery = combinedWorkSearchQuery.trim().toLowerCase();
    const workRecords = combinedNeedsFurtherWorkRecords.filter((record) => {
      const workflowStatus = normalizeCombinedWorkflowStatus(record);
      if (combinedWorkWorkflowFilter !== 'all' && workflowStatus !== combinedWorkWorkflowFilter) return false;
      if (!normalizedQuery) return true;

      return buildSearchableRecordText(record, [
        titleFieldName,
        vendorFieldName,
        priceFieldName,
        qtyFieldName,
        'Workflow Status',
        'SKU',
        'Model',
        'Brand',
      ]).includes(normalizedQuery);
    });

    return sortCombinedRecords(workRecords, combinedWorkSortMode, titleFieldName, vendorFieldName, priceFieldName);
  }, [
    combinedNeedsFurtherWorkRecords,
    combinedWorkSearchQuery,
    combinedWorkSortMode,
    combinedWorkWorkflowFilter,
    isCombinedApproval,
    priceFieldName,
    qtyFieldName,
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
    : searchQuery.trim().length > 0;
  const summaryStats = useMemo(() => {
    return [
      { label: 'Loaded Rows', value: records.length },
      { label: 'Pending', value: quickFilterCounts?.pending ?? 0 },
      { label: 'Ready', value: quickFilterCounts?.ready ?? 0 },
      { label: 'Approved', value: quickFilterCounts?.approved ?? 0 },
    ];
  }, [quickFilterCounts, records.length]);

  const refreshQueue = () => {
    trackWorkflowEvent('approval_queue_refreshed', {
      tableReference,
    });
    void loadRecords(tableReference, tableName ?? '', true);
  };

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
        isCombinedApproval ? (
          <AppPageSectionSurface>
            <ListingApprovalQueueSkeleton />
          </AppPageSectionSurface>
        ) : (
          <section className={approvalQueueSurfaceClass}>
            <ListingApprovalQueueSkeleton />
          </section>
        )
      ) : hasTableReference ? (
        <section className={isCombinedApproval ? '' : approvalQueueSurfaceClass}>
          {!isCombinedApproval ? (
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
          ) : null}

          {!isCombinedApproval ? (
            <QueueSearchToolbar
              searchAriaLabel={approvalChannel === 'shopify'
                ? 'Search Shopify listing queue'
                : 'Search eBay listing queue'}
              searchPlaceholder={approvalChannel === 'shopify'
                ? 'Search Shopify listings, brand, vendor, or workflow status…'
                : 'Search eBay listings, brand, vendor, or workflow status…'}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              className="mb-4"
            />
          ) : null}

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

          {!isCombinedApproval ? (
            <p className="m-0 mb-4 text-sm text-[var(--muted)]">
              <strong>{filteredRecords.length}</strong>
              {isFiltered ? ` of ${records.length}` : ''} listing rows {supportsQuickFilters || isFiltered ? 'shown' : 'loaded'}.
            </p>
          ) : null}

          {(supportsQuickFilters || searchQuery.trim().length > 0) && filteredRecords.length === 0 ? (
            <section className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              No listing rows match the current filters.
            </section>
          ) : null}

          {filteredRecords.length > 0 && !isCombinedApproval ? (
            <ApprovalQueueTable
              records={filteredRecords}
              approvedFieldName={approvedFieldName}
              requiredFieldNames={requiredFieldNames}
              readinessColumns={[]}
              titleFieldName={titleFieldName}
              conditionFieldName=""
              formatFieldName={approvalChannel === 'ebay' ? '' : formatFieldName}
              priceFieldName={approvalChannel === 'shopify' ? '' : priceFieldName}
              vendorFieldName={vendorFieldName}
              qtyFieldName={approvalChannel === 'ebay' ? '' : qtyFieldName}
              openRecord={openRecord}
              onSelectRecord={onSelectRecord}
            />
          ) : null}

          {filteredRecords.length > 0 && isCombinedApproval ? (
            <div className="space-y-5">
              <AppPageSectionSurface id={COMBINED_QUEUE_SECTION_IDS['ready-for-publishing']} className="scroll-mt-24 bg-[var(--bg)]/60">
                <AppSectionTitle
                  title="Ready for Publishing"
                  className="mb-4"
                />
                <QueueSearchToolbar
                  className="mb-4"
                  searchAriaLabel="Search ready for publishing combined listings"
                  searchPlaceholder="Search ready items by title, vendor, SKU, brand, or workflow status…"
                  searchValue={combinedReadySearchQuery}
                  onSearchChange={setCombinedReadySearchQuery}
                  refreshLabel="Refresh listing approval queue"
                  refreshLoadingLabel="Refreshing listing approval queue"
                  refreshing={loading}
                  onRefresh={refreshQueue}
                  sortAriaLabel={`Sort ready-for-publishing combined listings. Current order: ${getCombinedSortLabel(combinedReadySortMode)}`}
                  sortValue={combinedReadySortMode}
                  onSortChange={(value) => setCombinedReadySortMode(value as CombinedQueueSortMode)}
                  sortOptions={[
                    { value: 'default', label: 'Default Order' },
                    { value: 'title-asc', label: 'Title A-Z' },
                    { value: 'vendor-asc', label: 'Vendor A-Z' },
                    { value: 'price-desc', label: 'Highest Price' },
                    { value: 'price-asc', label: 'Lowest Price' },
                  ]}
                  filters={combinedReadyWorkflowOptions.length > 1 ? [{
                    ariaLabel: 'Filter ready-for-publishing combined listings by workflow status',
                    value: combinedReadyWorkflowFilter,
                    options: combinedReadyWorkflowOptions,
                    onChange: setCombinedReadyWorkflowFilter,
                  }] : undefined}
                  compactFilters
                />
                {filteredCombinedReadyForPublishingRecords.length > 0 ? (
                  <ApprovalQueueTable
                    records={filteredCombinedReadyForPublishingRecords}
                    approvedFieldName={approvedFieldName}
                    requiredFieldNames={requiredFieldNames}
                    readinessColumns={[
                      { key: 'shopify', label: 'Shopify Ready', requiredFieldNames: shopifyRequiredFieldNames },
                      { key: 'ebay', label: 'eBay Ready', requiredFieldNames: ebayRequiredFieldNames },
                    ]}
                    titleFieldName={titleFieldName}
                    conditionFieldName=""
                    formatFieldName=""
                    priceFieldName={priceFieldName}
                    vendorFieldName={vendorFieldName}
                    qtyFieldName={qtyFieldName}
                    openRecord={openRecord}
                    onSelectRecord={onSelectRecord}
                  />
                ) : (
                  <section className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                    {combinedReadyForPublishingRecords.length === 0
                      ? 'No combined listing rows are currently ready for publishing.'
                      : 'No ready-for-publishing rows match this section search.'}
                  </section>
                )}
              </AppPageSectionSurface>

              <AppPageSectionSurface id={COMBINED_QUEUE_SECTION_IDS['needs-further-work']} className="scroll-mt-24 bg-[var(--bg)]/60">
                <AppSectionTitle
                  title="Needs Further Work"
                  className="mb-4"
                />
                <QueueSearchToolbar
                  className="mb-4"
                  searchAriaLabel="Search combined listings that need further work"
                  searchPlaceholder="Search rows needing work by title, vendor, SKU, brand, or workflow status…"
                  searchValue={combinedWorkSearchQuery}
                  onSearchChange={setCombinedWorkSearchQuery}
                  refreshLabel="Refresh listing approval queue"
                  refreshLoadingLabel="Refreshing listing approval queue"
                  refreshing={loading}
                  onRefresh={refreshQueue}
                  sortAriaLabel={`Sort combined listings that need further work. Current order: ${getCombinedSortLabel(combinedWorkSortMode)}`}
                  sortValue={combinedWorkSortMode}
                  onSortChange={(value) => setCombinedWorkSortMode(value as CombinedQueueSortMode)}
                  sortOptions={[
                    { value: 'default', label: 'Default Order' },
                    { value: 'title-asc', label: 'Title A-Z' },
                    { value: 'vendor-asc', label: 'Vendor A-Z' },
                    { value: 'price-desc', label: 'Highest Price' },
                    { value: 'price-asc', label: 'Lowest Price' },
                  ]}
                  filters={combinedWorkWorkflowOptions.length > 1 ? [{
                    ariaLabel: 'Filter combined listings that need further work by workflow status',
                    value: combinedWorkWorkflowFilter,
                    options: combinedWorkWorkflowOptions,
                    onChange: setCombinedWorkWorkflowFilter,
                  }] : undefined}
                  compactFilters
                />
                {filteredCombinedNeedsFurtherWorkRecords.length > 0 ? (
                  <ApprovalQueueTable
                    records={filteredCombinedNeedsFurtherWorkRecords}
                    approvedFieldName={approvedFieldName}
                    requiredFieldNames={requiredFieldNames}
                    readinessColumns={[
                      { key: 'shopify', label: 'Shopify Ready', requiredFieldNames: shopifyRequiredFieldNames },
                      { key: 'ebay', label: 'eBay Ready', requiredFieldNames: ebayRequiredFieldNames },
                    ]}
                    titleFieldName={titleFieldName}
                    conditionFieldName=""
                    formatFieldName=""
                    priceFieldName={priceFieldName}
                    vendorFieldName={vendorFieldName}
                    qtyFieldName={qtyFieldName}
                    openRecord={openRecord}
                    onSelectRecord={onSelectRecord}
                  />
                ) : (
                  <section className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                    {combinedNeedsFurtherWorkRecords.length === 0
                      ? 'No combined listing rows currently need additional listing work.'
                      : 'No needs-further-work rows match this section search.'}
                  </section>
                )}
              </AppPageSectionSurface>
            </div>
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

      <MainPageSectionNav
        ariaLabel="Combined listings sections"
        items={combinedSectionItems.map((item) => ({ key: item.key, label: item.label }))}
        activeKey={activeCombinedSectionKey}
        onSelect={(sectionKey) => {
          const sectionId = combinedSectionItems.find((item) => item.key === sectionKey)?.id;
          if (sectionId) {
            requestAnimationFrame(() => {
              scrollToSection(sectionId);
            });
          }
        }}
      />

      {queuePanel}
    </AppPageLayout>
  );
}