import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AirtableTabViewModel } from '@/app/appTabViewModels';
import { navLabel } from '@/app/appNavigation';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { InventoryDirectoryListSection } from '@/components/tabs/airtable/InventoryDirectoryListSection';
import { UsedGearPendingReviewSection, type UsedGearPendingReviewSortMode } from '@/components/tabs/airtable/UsedGearPendingReviewSection';
import { UsedGearWorkflowProgressSection, type UsedGearWorkflowProgressSortMode } from '@/components/tabs/airtable/UsedGearWorkflowProgressSection';
import {
  getInventoryDirectoryItemLabel,
  getInventoryDirectorySku,
  getInventoryDirectoryStatus,
  loadInventoryDirectory,
} from '@/services/inventoryDirectory';
import { useNotificationStore } from '@/stores/notificationStore';
import type { UserRole } from '@/stores/auth/authTypes';
import type { AirtableRecord } from '@/types/airtable';

const INVENTORY_DIRECTORY_SEARCH_PARAM = 'inventoryDirectorySearch';
const INVENTORY_DIRECTORY_STATUS_PARAM = 'inventoryDirectoryStatus';
const WORKFLOW_PENDING_REVIEW_SEARCH_PARAM = 'workflowPendingReviewSearch';
const WORKFLOW_PROGRESS_SEARCH_PARAM = 'workflowProgressSearch';
const WORKFLOW_PENDING_REVIEW_GROUP_PARAM = 'workflowPendingReviewGroup';
const WORKFLOW_PROGRESS_GROUP_PARAM = 'workflowProgressGroup';
const WORKFLOW_PENDING_REVIEW_SORT_PARAM = 'workflowPendingReviewSort';
const WORKFLOW_PROGRESS_SORT_PARAM = 'workflowProgressSort';
const WORKFLOW_ROUTE_PARAMS = [
  WORKFLOW_PENDING_REVIEW_SEARCH_PARAM,
  WORKFLOW_PROGRESS_SEARCH_PARAM,
  WORKFLOW_PENDING_REVIEW_GROUP_PARAM,
  WORKFLOW_PROGRESS_GROUP_PARAM,
  WORKFLOW_PENDING_REVIEW_SORT_PARAM,
  WORKFLOW_PROGRESS_SORT_PARAM,
] as const;
const INVENTORY_PENDING_REVIEW_SECTION_ID = 'used-gear-pending-review';
const INVENTORY_PROGRESS_SECTION_ID = 'used-gear-progress-queue';
const INVENTORY_DIRECTORY_SECTION_ID = 'inventory-directory-list';

interface WorkflowStateChip {
  key: string;
  label: string;
  clearLabel: string;
  onClear: () => void;
}

type WorkflowChipFocusTarget = string | '__reset__';
type InventoryWorkflowSectionKey = 'pending-review' | 'processing' | 'directory';

function formatWorkflowChipValue(value: string): string {
  return value.length > 28 ? `${value.slice(0, 28)}...` : value;
}

function formatWorkflowGroupChipValue(value: string): string {
  return formatWorkflowChipValue(value.replace(/^(pickup|submission|record):/i, ''));
}

function parsePendingReviewSortMode(search: string): UsedGearPendingReviewSortMode {
  const value = new URLSearchParams(search).get(WORKFLOW_PENDING_REVIEW_SORT_PARAM);
  return value === 'newest' || value === 'oldest' || value === 'arrival-date' || value === 'make-model' ? value : 'group-label';
}

function parseProgressSortMode(search: string): UsedGearWorkflowProgressSortMode {
  const value = new URLSearchParams(search).get(WORKFLOW_PROGRESS_SORT_PARAM);
  return value === 'newest' || value === 'oldest' ? value : 'group-label';
}

function pendingSortLabel(value: UsedGearPendingReviewSortMode): string {
  return value === 'newest'
    ? 'Pending sort: Newest First'
    : value === 'oldest'
      ? 'Pending sort: Oldest First'
      : value === 'arrival-date'
        ? 'Pending sort: Arrival Date'
        : value === 'make-model'
          ? 'Pending sort: Make Then Model'
          : 'Pending sort: Group Label';
}

function progressSortLabel(value: UsedGearWorkflowProgressSortMode): string {
  return value === 'newest' ? 'Progress sort: Newest First' : value === 'oldest' ? 'Progress sort: Oldest First' : 'Progress sort: Group Label';
}

interface AirtableTabProps {
  viewModel: AirtableTabViewModel;
  currentUserRole: UserRole;
  currentUserName: string;
  onAddNewRecord: () => void;
  onOpenManualIntake: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onSelectRecord: (recordId: string) => void;
}

export function AirtableTab({
  viewModel,
  currentUserRole,
  currentUserName,
  onOpenManualIntake,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenOperationalRecord,
  onOpenListingsRecord,
  onSelectRecord,
}: AirtableTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pushNotification = useNotificationStore((state) => state.push);
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(viewModel.error?.message ?? null);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryRefreshing, setDirectoryRefreshing] = useState(false);
  const [copyingWorkflowView, setCopyingWorkflowView] = useState(false);
  const [copiedWorkflowView, setCopiedWorkflowView] = useState(false);
  const [pendingWorkflowChipFocusTarget, setPendingWorkflowChipFocusTarget] = useState<WorkflowChipFocusTarget | null>(null);
  const workflowChipButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const resetWorkflowViewButtonRef = useRef<HTMLButtonElement | null>(null);
  const inventoryDirectorySearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(INVENTORY_DIRECTORY_SEARCH_PARAM) ?? '';
  }, [location.search]);
  const inventoryDirectoryStatusFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(INVENTORY_DIRECTORY_STATUS_PARAM) ?? 'all';
  }, [location.search]);
  const workflowPendingReviewSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_PENDING_REVIEW_SEARCH_PARAM) ?? '';
  }, [location.search]);
  const workflowProgressSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_PROGRESS_SEARCH_PARAM) ?? '';
  }, [location.search]);
  const focusedPendingReviewGroupId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_PENDING_REVIEW_GROUP_PARAM);
  }, [location.search]);
  const focusedProgressGroupId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_PROGRESS_GROUP_PARAM);
  }, [location.search]);
  const workflowPendingReviewSort = useMemo(() => parsePendingReviewSortMode(location.search), [location.search]);
  const workflowProgressSort = useMemo(() => parseProgressSortMode(location.search), [location.search]);

  const hasWorkflowViewState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return WORKFLOW_ROUTE_PARAMS.some((paramName) => params.has(paramName));
  }, [location.search]);

  const defaultInventoryWorkflowHash = currentUserRole === 'processor' ? '#used-gear-pending-review' : '';
  const sectionItems = useMemo(() => [
    { id: INVENTORY_PENDING_REVIEW_SECTION_ID, key: 'pending-review' as const, label: 'Pending Review' },
    { id: INVENTORY_PROGRESS_SECTION_ID, key: 'processing' as const, label: 'Processing' },
    { id: INVENTORY_DIRECTORY_SECTION_ID, key: 'directory' as const, label: 'Record Directory' },
  ], []);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, INVENTORY_PENDING_REVIEW_SECTION_ID);
  const activeSectionKey = useMemo<InventoryWorkflowSectionKey>(
    () => sectionItems.find((item) => item.id === activeSectionId)?.key ?? 'pending-review',
    [activeSectionId, sectionItems],
  );

  const updateWorkflowRouteState = useCallback((
    update: (params: URLSearchParams) => void,
    hash: string,
  ) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash,
    }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const updateInventoryDirectoryRouteState = useCallback((update: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: location.hash,
    }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  const updateWorkflowQueueSearch = useCallback((paramName: string, value: string, hash: string) => {
    updateWorkflowRouteState((params) => {
      if (value.trim().length === 0) {
        params.delete(paramName);
      } else {
        params.set(paramName, value);
      }
    }, hash);
  }, [updateWorkflowRouteState]);

  const resetWorkflowViewState = () => {
    updateWorkflowRouteState((params) => {
      WORKFLOW_ROUTE_PARAMS.forEach((paramName) => params.delete(paramName));
    }, '');
  };

  const handleInventoryDirectorySearchChange = (value: string) => {
    updateInventoryDirectoryRouteState((params) => {
      if (value.trim().length === 0) {
        params.delete(INVENTORY_DIRECTORY_SEARCH_PARAM);
      } else {
        params.set(INVENTORY_DIRECTORY_SEARCH_PARAM, value);
      }
    });
  };

  const handleInventoryDirectoryStatusFilterChange = (value: string) => {
    updateInventoryDirectoryRouteState((params) => {
      if (value === 'all') {
        params.delete(INVENTORY_DIRECTORY_STATUS_PARAM);
      } else {
        params.set(INVENTORY_DIRECTORY_STATUS_PARAM, value);
      }
    });
  };

  const copyCurrentWorkflowView = async () => {
    if (typeof window === 'undefined' || !navigator.clipboard) {
      pushNotification({
        tone: 'error',
        title: 'Clipboard unavailable',
        message: 'This browser cannot copy the current workflow view automatically.',
      });
      return;
    }

    setCopyingWorkflowView(true);

    try {
      const currentViewUrl = new URL(window.location.origin);
      currentViewUrl.pathname = location.pathname;
      currentViewUrl.search = location.search;
      currentViewUrl.hash = location.hash;

      await navigator.clipboard.writeText(currentViewUrl.toString());
      setCopiedWorkflowView(true);
      window.setTimeout(() => setCopiedWorkflowView(false), 1800);
      pushNotification({
        tone: 'success',
        title: 'Workflow view copied',
        message: 'The current Inventory workflow view link is ready to share.',
      });
    } catch {
      pushNotification({
        tone: 'error',
        title: 'Copy failed',
        message: 'The current workflow view link could not be copied. Try again or copy the URL from the browser address bar.',
      });
    } finally {
      setCopyingWorkflowView(false);
    }
  };

  const workflowStateChips = useMemo(() => {
    const chips: WorkflowStateChip[] = [];

    if (workflowPendingReviewSearch) {
      chips.push({
        key: 'pending-search',
        label: `Pending review: ${formatWorkflowChipValue(workflowPendingReviewSearch)}`,
        clearLabel: 'Clear pending review search',
        onClear: () => updateWorkflowQueueSearch(WORKFLOW_PENDING_REVIEW_SEARCH_PARAM, '', '#used-gear-pending-review'),
      });
    }
    if (workflowProgressSearch) {
      chips.push({
        key: 'progress-search',
        label: `Progress: ${formatWorkflowChipValue(workflowProgressSearch)}`,
        clearLabel: 'Clear progress queue search',
        onClear: () => updateWorkflowQueueSearch(WORKFLOW_PROGRESS_SEARCH_PARAM, '', '#used-gear-progress-queue'),
      });
    }
    if (focusedPendingReviewGroupId) {
      chips.push({
        key: 'pending-group',
        label: `Pending group: ${formatWorkflowGroupChipValue(focusedPendingReviewGroupId)}`,
        clearLabel: 'Clear pending review group focus',
        onClear: () => updateWorkflowRouteState((params) => {
          params.delete(WORKFLOW_PENDING_REVIEW_GROUP_PARAM);
        }, '#used-gear-pending-review'),
      });
    }
    if (focusedProgressGroupId) {
      chips.push({
        key: 'progress-group',
        label: `Progress group: ${formatWorkflowGroupChipValue(focusedProgressGroupId)}`,
        clearLabel: 'Clear progress queue group focus',
        onClear: () => updateWorkflowRouteState((params) => {
          params.delete(WORKFLOW_PROGRESS_GROUP_PARAM);
        }, '#used-gear-progress-queue'),
      });
    }
    if (workflowPendingReviewSort !== 'group-label') {
      chips.push({
        key: 'pending-sort',
        label: pendingSortLabel(workflowPendingReviewSort),
        clearLabel: 'Clear pending review sort',
        onClear: () => updateWorkflowRouteState((params) => {
          params.delete(WORKFLOW_PENDING_REVIEW_SORT_PARAM);
        }, '#used-gear-pending-review'),
      });
    }
    if (workflowProgressSort !== 'group-label') {
      chips.push({
        key: 'progress-sort',
        label: progressSortLabel(workflowProgressSort),
        clearLabel: 'Clear progress queue sort',
        onClear: () => updateWorkflowRouteState((params) => {
          params.delete(WORKFLOW_PROGRESS_SORT_PARAM);
        }, '#used-gear-progress-queue'),
      });
    }
    return chips;
  }, [
    focusedPendingReviewGroupId,
    focusedProgressGroupId,
    updateWorkflowQueueSearch,
    updateWorkflowRouteState,
    workflowPendingReviewSearch,
    workflowPendingReviewSort,
    workflowProgressSearch,
    workflowProgressSort,
  ]);

  useEffect(() => {
    if (!pendingWorkflowChipFocusTarget) {
      return;
    }

    const focusHandle = window.requestAnimationFrame(() => {
      const nextButton = pendingWorkflowChipFocusTarget === '__reset__'
        ? resetWorkflowViewButtonRef.current
        : workflowChipButtonRefs.current[pendingWorkflowChipFocusTarget];

      (nextButton ?? resetWorkflowViewButtonRef.current)?.focus();
      setPendingWorkflowChipFocusTarget(null);
    });

    return () => window.cancelAnimationFrame(focusHandle);
  }, [pendingWorkflowChipFocusTarget, workflowStateChips]);

  useEffect(() => {
    if (!defaultInventoryWorkflowHash || hasWorkflowViewState || location.hash) {
      return;
    }

    navigate({
      pathname: location.pathname,
      search: location.search,
      hash: defaultInventoryWorkflowHash,
    }, { replace: true });
  }, [defaultInventoryWorkflowHash, hasWorkflowViewState, location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadDirectoryData = async () => {
      setDirectoryLoading(true);
      setDirectoryError(null);

      try {
        const data = await loadInventoryDirectory();
        if (cancelled) return;
        setRecords(data.records);
      } catch (error) {
        if (cancelled) return;
        setDirectoryError(error instanceof Error ? error.message : 'Unable to load SB Inventory directory.');
      } finally {
        if (!cancelled) {
          setDirectoryLoading(false);
        }
      }
    };

    void loadDirectoryData();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusOptions = useMemo(
    () => Array.from(new Set(records
      .map((record) => getInventoryDirectoryStatus(record.fields))
      .filter((value): value is string => value.trim().length > 0)))
      .sort((left, right) => left.localeCompare(right)),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = inventoryDirectorySearch.trim().toLowerCase();

    return records.filter((record) => {
      const status = getInventoryDirectoryStatus(record.fields);
      if (inventoryDirectoryStatusFilter !== 'all' && status !== inventoryDirectoryStatusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        getInventoryDirectorySku(record.fields),
        getInventoryDirectoryItemLabel(record.fields),
        record.fields['Component Type'],
        status,
      ]
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [inventoryDirectorySearch, inventoryDirectoryStatusFilter, records]);

  const handleWorkflowChipClear = (chip: WorkflowStateChip, index: number) => {
    const nextChip = workflowStateChips[index + 1]?.key ?? workflowStateChips[index - 1]?.key ?? '__reset__';
    setPendingWorkflowChipFocusTarget(nextChip);
    chip.onClear();
  };

  const loadDirectoryData = async () => {
    setDirectoryRefreshing(true);
    setDirectoryError(null);

    try {
      const data = await loadInventoryDirectory();
      setRecords(data.records);
    } catch (error) {
      setDirectoryError(error instanceof Error ? error.message : 'Unable to refresh SB Inventory directory.');
    } finally {
      setDirectoryRefreshing(false);
    }
  };

  return (
      <AppPageLayout>
        <WorkflowPageHeader
          eyebrow="Processing"
          title={navLabel('inventory')}
        />

        <MainPageSectionNav
          ariaLabel="Workflow hub sections"
          items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
          activeKey={activeSectionKey}
          onSelect={(sectionKey) => {
            const sectionId = sectionItems.find((item) => item.key === sectionKey)?.id;
            if (sectionId) {
              requestAnimationFrame(() => {
                scrollToSection(sectionId);
              });
            }
          }}
        />

        {directoryError ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {directoryError}
          </div>
        ) : null}

        {hasWorkflowViewState ? (
          <div className="sticky top-16 z-10 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[linear-gradient(180deg,rgba(7,17,28,0.94),rgba(7,17,28,0.82))] px-5 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="m-0 text-sm font-semibold text-[var(--ink)]">Workflow filters</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {workflowStateChips.map((chip) => (
                  <span key={chip.key} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      ref={(element) => {
                        workflowChipButtonRefs.current[chip.key] = element;
                      }}
                      className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] leading-none transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      aria-label={chip.clearLabel}
                      onClick={() => handleWorkflowChipClear(chip, workflowStateChips.findIndex((currentChip) => currentChip.key === chip.key))}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void copyCurrentWorkflowView();
                }}
                disabled={copyingWorkflowView}
              >
                {copyingWorkflowView ? 'Copying...' : copiedWorkflowView ? 'View Copied' : 'Copy Current Workflow View'}
              </button>
              <button
                ref={resetWorkflowViewButtonRef}
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={resetWorkflowViewState}
              >
                Reset Workflow View
              </button>
            </div>
          </div>
        ) : null}

        <UsedGearPendingReviewSection
          currentUserName={currentUserName}
          onOpenReviewRecord={(recordId) => onOpenManualIntake(recordId)}
          focusedGroupId={focusedPendingReviewGroupId}
          searchTerm={workflowPendingReviewSearch}
          onSearchTermChange={(value) => updateWorkflowQueueSearch(
            WORKFLOW_PENDING_REVIEW_SEARCH_PARAM,
            value,
            '#used-gear-pending-review',
          )}
          sortMode={workflowPendingReviewSort}
          onSortModeChange={(value) => updateWorkflowRouteState((params) => {
            if (value === 'group-label') {
              params.delete(WORKFLOW_PENDING_REVIEW_SORT_PARAM);
            } else {
              params.set(WORKFLOW_PENDING_REVIEW_SORT_PARAM, value);
            }
          }, '#used-gear-pending-review')}
        />

        <UsedGearWorkflowProgressSection
          currentUserName={currentUserName}
          onOpenManualIntake={onOpenManualIntake}
          onOpenTestingForm={onOpenTestingForm}
          onOpenPhotosForm={onOpenPhotosForm}
          onOpenOperationalRecord={onOpenOperationalRecord}
          onOpenListingsRecord={onOpenListingsRecord}
          focusedGroupId={focusedProgressGroupId}
          searchTerm={workflowProgressSearch}
          onSearchTermChange={(value) => updateWorkflowQueueSearch(
            WORKFLOW_PROGRESS_SEARCH_PARAM,
            value,
            '#used-gear-progress-queue',
          )}
          sortMode={workflowProgressSort}
          onSortModeChange={(value) => updateWorkflowRouteState((params) => {
            if (value === 'group-label') {
              params.delete(WORKFLOW_PROGRESS_SORT_PARAM);
            } else {
              params.set(WORKFLOW_PROGRESS_SORT_PARAM, value);
            }
          }, '#used-gear-progress-queue')}
        />
        <section id="inventory-directory-list" className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <AppSectionTitle title="Record Directory" />

          {directoryLoading && records.length === 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              Loading SB Inventory directory...
            </div>
          ) : null}

          {directoryError && records.length === 0 ? (
            <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-4 text-sm text-amber-200">
              <p className="m-0 font-semibold">SB Inventory directory is currently unavailable.</p>
              <p className="mt-2 mb-0">{directoryError}</p>
            </div>
          ) : null}

          {!directoryLoading && !directoryError && records.length === 0 ? (
            <EmptySurface title="No inventory rows found" message="SB Inventory currently has no editable rows in this table.">
              <p className="mt-3 text-sm text-[var(--muted)]">
                Next route: start in Parking Lot 1 for customer-submitted intake, or open Manual Intake when staff needs to create the first manual operational row inside the app.
              </p>
            </EmptySurface>
          ) : null}

          {records.length > 0 ? (
            <InventoryDirectoryListSection
              records={filteredRecords}
              totalCount={records.length}
              searchTerm={inventoryDirectorySearch}
              statusFilter={inventoryDirectoryStatusFilter}
              statusOptions={statusOptions}
              refreshing={directoryRefreshing}
              onSearchTermChange={handleInventoryDirectorySearchChange}
              onStatusFilterChange={handleInventoryDirectoryStatusFilterChange}
              onRefresh={() => {
                void loadDirectoryData();
              }}
              onOpenManualIntake={onOpenManualIntake}
              onSelectRecord={onSelectRecord}
            />
          ) : null}
        </section>
      </AppPageLayout>
  );
}
