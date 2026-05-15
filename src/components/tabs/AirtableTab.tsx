import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AirtableTabViewModel } from '@/app/appTabViewModels';
import { RefreshIconButton } from '@/components/app/RefreshIconButton';
import { EmptySurface, PanelSurface } from '@/components/app/StateSurfaces';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { InventoryDirectoryListSection } from '@/components/tabs/airtable/InventoryDirectoryListSection';
import { UsedGearPendingReviewSection, type UsedGearPendingReviewSortMode } from '@/components/tabs/airtable/UsedGearPendingReviewSection';
import { UsedGearWorkflowPostPublishSection } from '@/components/tabs/airtable/UsedGearWorkflowPostPublishSection';
import { UsedGearWorkflowProgressSection, type UsedGearWorkflowProgressSortMode } from '@/components/tabs/airtable/UsedGearWorkflowProgressSection';
import { loadInventoryDirectory } from '@/services/inventoryDirectory';
import {
  deleteUsedGearWorkflowViewPreset,
  loadUsedGearWorkflowViewPresets,
  saveUsedGearWorkflowViewPreset,
  type UsedGearWorkflowViewPreset,
} from '@/services/usedGearWorkflowViewPresets';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';
import type { UsedGearWorkflowPostPublishHistoryFilter, UsedGearWorkflowPostPublishSortMode } from '@/components/tabs/airtable/UsedGearWorkflowPostPublishSection';
import { useNotificationStore } from '@/stores/notificationStore';
import type { UserRole } from '@/stores/auth/authTypes';
import type { AirtableRecord } from '@/types/airtable';

const INVENTORY_DIRECTORY_SEARCH_PARAM = 'inventoryDirectorySearch';
const INVENTORY_DIRECTORY_STATUS_PARAM = 'inventoryDirectoryStatus';
const WORKFLOW_PENDING_REVIEW_SEARCH_PARAM = 'workflowPendingReviewSearch';
const WORKFLOW_PROGRESS_SEARCH_PARAM = 'workflowProgressSearch';
const WORKFLOW_POST_PUBLISH_SEARCH_PARAM = 'workflowPostPublishSearch';
const WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM = 'workflowPendingReviewCollapsedGroups';
const WORKFLOW_PROGRESS_COLLAPSED_PARAM = 'workflowProgressCollapsedGroups';
const WORKFLOW_POST_PUBLISH_COLLAPSED_PARAM = 'workflowPostPublishCollapsedSections';
const WORKFLOW_PENDING_REVIEW_SORT_PARAM = 'workflowPendingReviewSort';
const WORKFLOW_PROGRESS_SORT_PARAM = 'workflowProgressSort';
const WORKFLOW_POST_PUBLISH_SORT_PARAM = 'workflowPostPublishSort';
const WORKFLOW_PENDING_REVIEW_GROUP_PARAM = 'workflowPendingReviewGroup';
const WORKFLOW_PROGRESS_GROUP_PARAM = 'workflowProgressGroup';
const WORKFLOW_POST_PUBLISH_HISTORY_PARAM = 'workflowPostPublishHistory';
const WORKFLOW_ROUTE_PARAMS = [
  WORKFLOW_PENDING_REVIEW_SEARCH_PARAM,
  WORKFLOW_PROGRESS_SEARCH_PARAM,
  WORKFLOW_POST_PUBLISH_SEARCH_PARAM,
  WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM,
  WORKFLOW_PROGRESS_COLLAPSED_PARAM,
  WORKFLOW_POST_PUBLISH_COLLAPSED_PARAM,
  WORKFLOW_PENDING_REVIEW_SORT_PARAM,
  WORKFLOW_PROGRESS_SORT_PARAM,
  WORKFLOW_POST_PUBLISH_SORT_PARAM,
  WORKFLOW_PENDING_REVIEW_GROUP_PARAM,
  WORKFLOW_PROGRESS_GROUP_PARAM,
  WORKFLOW_POST_PUBLISH_HISTORY_PARAM,
  'workflowPostPublishBucket',
] as const;

const POST_PUBLISH_BUCKET_LABELS: Record<UsedGearWorkflowPostPublishBucket, string> = {
  'active-listing': 'Active Listings',
  'stale-listing': 'Stale Listings',
  'sold-ready': 'Sold Ready To Ship',
  shipped: 'Shipped History',
};

interface WorkflowStateChip {
  key: string;
  label: string;
  clearLabel: string;
  onClear: () => void;
}

type WorkflowChipFocusTarget = string | '__reset__';

const WORKFLOW_SHORTCUT_HINTS = [
  { label: 'g then 1', description: 'Pending Review' },
  { label: 'g then 2', description: 'Progress' },
  { label: 'g then 3', description: 'Post-Publish' },
  { label: 'g then 0', description: 'Directory' },
] as const;

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || target.isContentEditable;
}

function parseWorkflowGroupIds(search: string, paramName: string): string[] {
  const params = new URLSearchParams(search);
  const value = params.get(paramName) ?? '';

  return value
    .split(',')
    .map((groupId) => groupId.trim())
    .filter((groupId) => groupId.length > 0);
}

function formatWorkflowChipValue(value: string): string {
  return value.length > 28 ? `${value.slice(0, 28)}...` : value;
}

function parsePendingReviewSortMode(search: string): UsedGearPendingReviewSortMode {
  const value = new URLSearchParams(search).get(WORKFLOW_PENDING_REVIEW_SORT_PARAM);
  return value === 'newest' || value === 'oldest' || value === 'arrival-date' || value === 'make-model' ? value : 'group-label';
}

function parseProgressSortMode(search: string): UsedGearWorkflowProgressSortMode {
  const value = new URLSearchParams(search).get(WORKFLOW_PROGRESS_SORT_PARAM);
  return value === 'newest' || value === 'oldest' ? value : 'group-label';
}

function parsePostPublishSortMode(search: string): UsedGearWorkflowPostPublishSortMode {
  const value = new URLSearchParams(search).get(WORKFLOW_POST_PUBLISH_SORT_PARAM);
  return value === 'oldest-activity' || value === 'sku' ? value : 'latest-activity';
}

function parseFocusedWorkflowGroup(search: string, paramName: string): string | null {
  const value = new URLSearchParams(search).get(paramName)?.trim() ?? '';
  return value ? value : null;
}

function parsePostPublishHistoryFilter(search: string): UsedGearWorkflowPostPublishHistoryFilter {
  const value = new URLSearchParams(search).get(WORKFLOW_POST_PUBLISH_HISTORY_PARAM);
  return value === 'active-only' || value === 'history-only' ? value : 'all';
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

function postPublishSortLabel(value: UsedGearWorkflowPostPublishSortMode): string {
  return value === 'oldest-activity' ? 'Post-publish sort: Oldest Activity' : value === 'sku' ? 'Post-publish sort: SKU' : 'Post-publish sort: Latest Activity';
}

interface AirtableTabProps {
  viewModel: AirtableTabViewModel;
  currentUserRole: UserRole;
  currentUserName: string;
  onAddNewRecord: () => void;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onSelectRecord: (recordId: string) => void;
}

export function AirtableTab({
  viewModel,
  currentUserRole,
  currentUserName,
  onAddNewRecord,
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenWorkflowRecord,
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
  const [workflowViewPresetName, setWorkflowViewPresetName] = useState('');
  const [workflowViewPresets, setWorkflowViewPresets] = useState<UsedGearWorkflowViewPreset[]>([]);
  const [pendingWorkflowChipFocusTarget, setPendingWorkflowChipFocusTarget] = useState<WorkflowChipFocusTarget | null>(null);
  const [awaitingWorkflowShortcut, setAwaitingWorkflowShortcut] = useState(false);
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
  const workflowPostPublishSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_POST_PUBLISH_SEARCH_PARAM) ?? '';
  }, [location.search]);
  const workflowPendingReviewCollapsedGroups = useMemo(
    () => parseWorkflowGroupIds(location.search, WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM),
    [location.search],
  );
  const workflowProgressCollapsedGroups = useMemo(
    () => parseWorkflowGroupIds(location.search, WORKFLOW_PROGRESS_COLLAPSED_PARAM),
    [location.search],
  );
  const workflowPostPublishCollapsedSections = useMemo(
    () => parseWorkflowGroupIds(location.search, WORKFLOW_POST_PUBLISH_COLLAPSED_PARAM) as UsedGearWorkflowPostPublishBucket[],
    [location.search],
  );
  const workflowPendingReviewSort = useMemo(() => parsePendingReviewSortMode(location.search), [location.search]);
  const workflowProgressSort = useMemo(() => parseProgressSortMode(location.search), [location.search]);
  const workflowPostPublishSort = useMemo(() => parsePostPublishSortMode(location.search), [location.search]);
  const workflowPendingReviewGroup = useMemo(() => parseFocusedWorkflowGroup(location.search, WORKFLOW_PENDING_REVIEW_GROUP_PARAM), [location.search]);
  const workflowProgressGroup = useMemo(() => parseFocusedWorkflowGroup(location.search, WORKFLOW_PROGRESS_GROUP_PARAM), [location.search]);
  const workflowPostPublishHistoryFilter = useMemo(() => parsePostPublishHistoryFilter(location.search), [location.search]);
  const focusedPostPublishBucket = useMemo<UsedGearWorkflowPostPublishBucket | null>(() => {
    const params = new URLSearchParams(location.search);
    const bucket = params.get('workflowPostPublishBucket');

    return bucket === 'active-listing'
      || bucket === 'stale-listing'
      || bucket === 'sold-ready'
      || bucket === 'shipped'
      ? bucket
      : null;
  }, [location.search]);

  const hasWorkflowViewState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return WORKFLOW_ROUTE_PARAMS.some((paramName) => params.has(paramName));
  }, [location.search]);

  const defaultInventoryWorkflowHash = currentUserRole === 'processor' ? '#used-gear-pending-review' : '';

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

  const buildWorkflowPresetSearch = () => {
    const currentParams = new URLSearchParams(location.search);
    const nextParams = new URLSearchParams();

    WORKFLOW_ROUTE_PARAMS.forEach((paramName) => {
      const value = currentParams.get(paramName);
      if (value !== null) {
        nextParams.set(paramName, value);
      }
    });

    return nextParams.toString();
  };

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

  const updateCollapsedWorkflowGroups = useCallback((paramName: string, groupIds: string[], hash: string) => {
    updateWorkflowRouteState((params) => {
      if (groupIds.length === 0) {
        params.delete(paramName);
      } else {
        params.set(paramName, groupIds.join(','));
      }
    }, hash);
  }, [updateWorkflowRouteState]);

  const resetWorkflowViewState = () => {
    updateWorkflowRouteState((params) => {
      WORKFLOW_ROUTE_PARAMS.forEach((paramName) => params.delete(paramName));
    }, '');
  };

  const handlePostPublishBucketChange = useCallback((bucket: UsedGearWorkflowPostPublishBucket | 'all') => {
    updateWorkflowRouteState((params) => {
      if (bucket === 'all') {
        params.delete('workflowPostPublishBucket');
      } else {
        params.set('workflowPostPublishBucket', bucket);
      }
    }, bucket === 'all' ? '' : '#used-gear-post-publish');
  }, [updateWorkflowRouteState]);

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

  const saveCurrentWorkflowPreset = () => {
    const name = workflowViewPresetName.trim();
    const presetSearch = buildWorkflowPresetSearch();
    if (!name || !presetSearch) {
      return;
    }

    setWorkflowViewPresets(saveUsedGearWorkflowViewPreset({
      name,
      search: presetSearch,
      hash: location.hash,
    }));
    setWorkflowViewPresetName('');
    pushNotification({
      tone: 'success',
      title: 'Workflow view saved',
      message: `Saved the current workflow filters as ${name}.`,
    });
  };

  const applyWorkflowPreset = (preset: UsedGearWorkflowViewPreset) => {
    updateWorkflowRouteState((params) => {
      WORKFLOW_ROUTE_PARAMS.forEach((paramName) => params.delete(paramName));

      const presetParams = new URLSearchParams(preset.search);
      presetParams.forEach((value, key) => {
        params.set(key, value);
      });
    }, preset.hash);
  };

  const removeWorkflowPreset = (presetId: string, presetName: string) => {
    setWorkflowViewPresets(deleteUsedGearWorkflowViewPreset(presetId));
    pushNotification({
      tone: 'success',
      title: 'Workflow view removed',
      message: `${presetName} was removed from saved Inventory views.`,
    });
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
    if (workflowPostPublishSearch) {
      chips.push({
        key: 'post-publish-search',
        label: `Post-publish: ${formatWorkflowChipValue(workflowPostPublishSearch)}`,
        clearLabel: 'Clear post-publish queue search',
        onClear: () => updateWorkflowQueueSearch(WORKFLOW_POST_PUBLISH_SEARCH_PARAM, '', '#used-gear-post-publish'),
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
    if (workflowPostPublishSort !== 'latest-activity') {
      chips.push({
        key: 'post-publish-sort',
        label: postPublishSortLabel(workflowPostPublishSort),
        clearLabel: 'Clear post-publish queue sort',
        onClear: () => updateWorkflowRouteState((params) => {
          params.delete(WORKFLOW_POST_PUBLISH_SORT_PARAM);
        }, '#used-gear-post-publish'),
      });
    }
    if (workflowPendingReviewCollapsedGroups.length > 0) {
      chips.push({
        key: 'pending-collapsed',
        label: `Pending groups collapsed: ${workflowPendingReviewCollapsedGroups.length}`,
        clearLabel: 'Clear pending review collapsed groups',
        onClear: () => updateCollapsedWorkflowGroups(WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM, [], '#used-gear-pending-review'),
      });
    }
    if (workflowPendingReviewGroup) {
      chips.push({
        key: 'pending-group',
        label: `Pending group: ${formatWorkflowChipValue(workflowPendingReviewGroup)}`,
        clearLabel: 'Clear pending review group focus',
        onClear: () => updateWorkflowRouteState((params) => {
          params.delete(WORKFLOW_PENDING_REVIEW_GROUP_PARAM);
        }, '#used-gear-pending-review'),
      });
    }
    if (workflowProgressCollapsedGroups.length > 0) {
      chips.push({
        key: 'progress-collapsed',
        label: `Progress groups collapsed: ${workflowProgressCollapsedGroups.length}`,
        clearLabel: 'Clear progress queue collapsed groups',
        onClear: () => updateCollapsedWorkflowGroups(WORKFLOW_PROGRESS_COLLAPSED_PARAM, [], '#used-gear-progress-queue'),
      });
    }
    if (workflowProgressGroup) {
      chips.push({
        key: 'progress-group',
        label: `Progress group: ${formatWorkflowChipValue(workflowProgressGroup)}`,
        clearLabel: 'Clear progress queue group focus',
        onClear: () => updateWorkflowRouteState((params) => {
          params.delete(WORKFLOW_PROGRESS_GROUP_PARAM);
        }, '#used-gear-progress-queue'),
      });
    }
    if (focusedPostPublishBucket) {
      chips.push({
        key: 'post-publish-bucket',
        label: `Bucket: ${POST_PUBLISH_BUCKET_LABELS[focusedPostPublishBucket]}`,
        clearLabel: 'Clear post-publish bucket filter',
        onClear: () => handlePostPublishBucketChange('all'),
      });
    }
    if (workflowPostPublishCollapsedSections.length > 0) {
      chips.push({
        key: 'post-publish-collapsed',
        label: `Buckets collapsed: ${workflowPostPublishCollapsedSections.length}`,
        clearLabel: 'Clear post-publish collapsed buckets',
        onClear: () => updateCollapsedWorkflowGroups(WORKFLOW_POST_PUBLISH_COLLAPSED_PARAM, [], '#used-gear-post-publish'),
      });
    }
    if (workflowPostPublishHistoryFilter !== 'all') {
      chips.push({
        key: 'post-publish-history',
        label: workflowPostPublishHistoryFilter === 'history-only' ? 'History: Shipped Only' : 'History: Active Only',
        clearLabel: 'Clear post-publish history filter',
        onClear: () => updateWorkflowRouteState((params) => {
          params.delete(WORKFLOW_POST_PUBLISH_HISTORY_PARAM);
        }, '#used-gear-post-publish'),
      });
    }
    return chips;
  }, [
    focusedPostPublishBucket,
    handlePostPublishBucketChange,
    updateCollapsedWorkflowGroups,
    updateWorkflowQueueSearch,
    updateWorkflowRouteState,
    workflowPendingReviewGroup,
    workflowPendingReviewCollapsedGroups.length,
    workflowPendingReviewSearch,
    workflowPendingReviewSort,
    workflowPostPublishHistoryFilter,
    workflowPostPublishCollapsedSections.length,
    workflowPostPublishSearch,
    workflowPostPublishSort,
    workflowProgressGroup,
    workflowProgressCollapsedGroups.length,
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
    setWorkflowViewPresets(loadUsedGearWorkflowViewPresets());
  }, []);

  useEffect(() => {
    if (!awaitingWorkflowShortcut) {
      return;
    }

    const timeoutHandle = window.setTimeout(() => {
      setAwaitingWorkflowShortcut(false);
    }, 1600);

    return () => window.clearTimeout(timeoutHandle);
  }, [awaitingWorkflowShortcut]);

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
    const focusSection = (sectionId: string, hash: string) => {
      navigate({
        pathname: location.pathname,
        search: location.search,
        hash,
      }, { replace: true });

      window.requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isEditableShortcutTarget(event.target)) {
        return;
      }

      const normalizedKey = event.key.toLowerCase();

      if (awaitingWorkflowShortcut) {
        if (normalizedKey === '1') {
          event.preventDefault();
          setAwaitingWorkflowShortcut(false);
          focusSection('used-gear-pending-review', '#used-gear-pending-review');
          return;
        }

        if (normalizedKey === '2') {
          event.preventDefault();
          setAwaitingWorkflowShortcut(false);
          focusSection('used-gear-progress-queue', '#used-gear-progress-queue');
          return;
        }

        if (normalizedKey === '3') {
          event.preventDefault();
          setAwaitingWorkflowShortcut(false);
          focusSection('used-gear-post-publish', '#used-gear-post-publish');
          return;
        }

        if (normalizedKey === '0') {
          event.preventDefault();
          setAwaitingWorkflowShortcut(false);
          focusSection('inventory-directory-list', '#inventory-directory-list');
          return;
        }

        setAwaitingWorkflowShortcut(false);
        return;
      }

      if (normalizedKey === 'g') {
        event.preventDefault();
        setAwaitingWorkflowShortcut(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [awaitingWorkflowShortcut, location.hash, location.pathname, location.search, navigate]);

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
      .map((record) => record.fields.Status)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)))
      .sort((left, right) => left.localeCompare(right)),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = inventoryDirectorySearch.trim().toLowerCase();

    return records.filter((record) => {
      const status = typeof record.fields.Status === 'string' ? record.fields.Status : '';
      if (inventoryDirectoryStatusFilter !== 'all' && status !== inventoryDirectoryStatusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        record.fields.SKU,
        record.fields.Make,
        record.fields.Model,
        record.fields['Component Type'],
        record.fields.Status,
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
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SB Inventory</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Directory</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Browse existing SB Inventory records, filter the table, and jump directly into the Incoming Gear, Testing, Photos, or full record editor flows.</p>
        </div>

        {directoryError ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {directoryError}
          </div>
        ) : null}

        {hasWorkflowViewState || workflowViewPresets.length > 0 ? (
          <div className="sticky top-3 z-20 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[linear-gradient(180deg,rgba(7,17,28,0.94),rgba(7,17,28,0.82))] px-5 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="m-0 text-sm font-semibold text-[var(--ink)]">Workflow views</p>
              <div className="mt-2 max-w-2xl">
                <CollapsibleHelperText label="Workflow views">
                  {hasWorkflowViewState
                    ? 'Shared filters are active across the workflow queues.'
                    : 'Use a saved view when you need to restore a common filter setup across the workflow queues.'}
                </CollapsibleHelperText>
              </div>
              {hasWorkflowViewState ? (
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
              ) : null}

              <details className="mt-4 rounded-2xl border border-[var(--line)]/70 bg-[var(--bg)]/50 px-4 py-3 text-sm text-[var(--muted)]">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">
                  More workflow tools
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {WORKFLOW_SHORTCUT_HINTS.map((shortcut) => (
                    <span key={shortcut.label} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      <span>{shortcut.label}</span>
                      <span className="text-[var(--ink)]">{shortcut.description}</span>
                    </span>
                  ))}
                  {awaitingWorkflowShortcut ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                      Awaiting jump key
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
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
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <label className="min-w-[240px] flex-1">
                    <span className="sr-only">Workflow view preset name</span>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      value={workflowViewPresetName}
                      onChange={(event) => setWorkflowViewPresetName(event.currentTarget.value.slice(0, 48))}
                      placeholder="Save current workflow view as..."
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={saveCurrentWorkflowPreset}
                    disabled={!hasWorkflowViewState || workflowViewPresetName.trim().length === 0}
                  >
                    Save Workflow View
                  </button>
                </div>

                {workflowViewPresets.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {workflowViewPresets.map((preset) => (
                      <div key={preset.id} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        <button
                          type="button"
                          className="transition hover:text-[var(--accent)]"
                          onClick={() => applyWorkflowPreset(preset)}
                        >
                          {preset.name}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] leading-none transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          aria-label={`Delete ${preset.name} workflow view`}
                          onClick={() => removeWorkflowPreset(preset.id, preset.name)}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 mb-0 text-sm text-[var(--muted)]">No saved workflow views yet.</p>
                )}
              </details>
            </div>
            <div className="flex flex-wrap gap-3">
              {hasWorkflowViewState ? (
                <button
                  ref={resetWorkflowViewButtonRef}
                  type="button"
                  className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={resetWorkflowViewState}
                >
                  Reset Workflow View
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <UsedGearPendingReviewSection
          currentUserName={currentUserName}
          onOpenReviewRecord={(recordId) => onOpenIncomingGearForm(recordId)}
          onOpenWorkflowRecord={onOpenWorkflowRecord}
          focusedGroupId={workflowPendingReviewGroup}
          onFocusedGroupIdChange={(groupId) => updateWorkflowRouteState((params) => {
            if (groupId) {
              params.set(WORKFLOW_PENDING_REVIEW_GROUP_PARAM, groupId);
            } else {
              params.delete(WORKFLOW_PENDING_REVIEW_GROUP_PARAM);
            }
          }, '#used-gear-pending-review')}
          searchTerm={workflowPendingReviewSearch}
          onSearchTermChange={(value) => updateWorkflowQueueSearch(
            WORKFLOW_PENDING_REVIEW_SEARCH_PARAM,
            value,
            '#used-gear-pending-review',
          )}
          collapsedGroupIds={workflowPendingReviewCollapsedGroups}
          onCollapsedGroupIdsChange={(groupIds) => updateCollapsedWorkflowGroups(
            WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM,
            groupIds,
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
          onOpenIncomingGearForm={onOpenIncomingGearForm}
          onOpenTestingForm={onOpenTestingForm}
          onOpenPhotosForm={onOpenPhotosForm}
          onOpenWorkflowRecord={onOpenWorkflowRecord}
          onOpenListingsRecord={onOpenListingsRecord}
          focusedGroupId={workflowProgressGroup}
          onFocusedGroupIdChange={(groupId) => updateWorkflowRouteState((params) => {
            if (groupId) {
              params.set(WORKFLOW_PROGRESS_GROUP_PARAM, groupId);
            } else {
              params.delete(WORKFLOW_PROGRESS_GROUP_PARAM);
            }
          }, '#used-gear-progress-queue')}
          searchTerm={workflowProgressSearch}
          onSearchTermChange={(value) => updateWorkflowQueueSearch(
            WORKFLOW_PROGRESS_SEARCH_PARAM,
            value,
            '#used-gear-progress-queue',
          )}
          collapsedGroupIds={workflowProgressCollapsedGroups}
          onCollapsedGroupIdsChange={(groupIds) => updateCollapsedWorkflowGroups(
            WORKFLOW_PROGRESS_COLLAPSED_PARAM,
            groupIds,
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

        <UsedGearWorkflowPostPublishSection
          currentUserName={currentUserName}
          focusedBucket={focusedPostPublishBucket}
          onFocusedBucketChange={handlePostPublishBucketChange}
          onOpenWorkflowRecord={onOpenWorkflowRecord}
          onOpenListingsRecord={onOpenListingsRecord}
          historyFilter={workflowPostPublishHistoryFilter}
          onHistoryFilterChange={(value) => updateWorkflowRouteState((params) => {
            if (value === 'all') {
              params.delete(WORKFLOW_POST_PUBLISH_HISTORY_PARAM);
            } else {
              params.set(WORKFLOW_POST_PUBLISH_HISTORY_PARAM, value);
            }
          }, '#used-gear-post-publish')}
          searchTerm={workflowPostPublishSearch}
          onSearchTermChange={(value) => updateWorkflowQueueSearch(
            WORKFLOW_POST_PUBLISH_SEARCH_PARAM,
            value,
            '#used-gear-post-publish',
          )}
          collapsedSectionKeys={workflowPostPublishCollapsedSections}
          onCollapsedSectionKeysChange={(keys) => updateCollapsedWorkflowGroups(
            WORKFLOW_POST_PUBLISH_COLLAPSED_PARAM,
            keys,
            '#used-gear-post-publish',
          )}
          sortMode={workflowPostPublishSort}
          onSortModeChange={(value) => updateWorkflowRouteState((params) => {
            if (value === 'latest-activity') {
              params.delete(WORKFLOW_POST_PUBLISH_SORT_PARAM);
            } else {
              params.set(WORKFLOW_POST_PUBLISH_SORT_PARAM, value);
            }
          }, '#used-gear-post-publish')}
        />

        <section id="inventory-directory-list" className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Find a Record</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use search and status filters to find a row, then choose Edit Record to move into the dedicated inventory form page.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={onAddNewRecord}
              >
                Add New
              </button>
              <RefreshIconButton
                onClick={() => {
                  void loadDirectoryData();
                }}
                disabled={directoryRefreshing}
                loading={directoryRefreshing}
                label="Refresh inventory directory"
                loadingLabel="Refreshing inventory directory"
              />
            </div>
          </div>

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
                Next route: start in Parking Lot 1 for customer-submitted intake, or open Incoming Gear when staff needs to create the first manual workflow row inside the app.
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
              onSearchTermChange={handleInventoryDirectorySearchChange}
              onStatusFilterChange={handleInventoryDirectoryStatusFilterChange}
              onOpenIncomingGearForm={onOpenIncomingGearForm}
              onOpenTestingForm={onOpenTestingForm}
              onOpenPhotosForm={onOpenPhotosForm}
              onSelectRecord={onSelectRecord}
            />
          ) : null}
        </section>
      </div>
    </PanelSurface>
  );
}
