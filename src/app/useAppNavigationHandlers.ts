import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { TAB_PATHS, type Tab } from '@/app/appNavigation';
import type { UsedGearWorkflowPostPublishBucket, UsedGearWorkflowPostPublishOwnerFilter } from '@/services/usedGearWorkflowLifecycle';

interface AppNavigationHandlers {
  navigateToTab: (tab: Tab, replace?: boolean) => void;
  navigateToPath: (path: string, replace?: boolean) => void;
  navigateToInventorySection: (sectionId: string, replace?: boolean) => void;
  navigateToJotformReviewGroup: (groupId: string, replace?: boolean) => void;
  navigateToIncomingGearForm: (recordId?: string | null, replace?: boolean) => void;
  navigateToTestingForm: (recordId?: string | null, replace?: boolean) => void;
  navigateToPhotosForm: (recordId?: string | null, replace?: boolean) => void;
  navigateToInventoryRecord: (recordId: string, replace?: boolean) => void;
  navigateToUsedGearWorkflowRecord: (recordId: string, replace?: boolean) => void;
  navigateToInventoryList: (replace?: boolean) => void;
  navigateToInventoryPostPublishBucket: (
    bucket: UsedGearWorkflowPostPublishBucket,
    options?: { replace?: boolean; ownerFilter?: UsedGearWorkflowPostPublishOwnerFilter },
  ) => void;
  navigateToListingsRecord: (recordId: string, replace?: boolean) => void;
  navigateToListingsList: (replace?: boolean) => void;
  navigateToUserRecord: (userId: string, replace?: boolean) => void;
  navigateToUsersList: (replace?: boolean) => void;
  handleLogout: () => void;
}

function scrollToPageTop(): void {
  if (typeof window === 'undefined') return;
  // Defer until after React commits the new route so the scroll animates
  // over the incoming content rather than snapping over the outgoing one.
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  });
}

export function useAppNavigationHandlers(navigate: NavigateFunction, logout: () => void): AppNavigationHandlers {
  const navigateToTab = useCallback((tab: Tab, replace = false): void => {
    navigate(TAB_PATHS[tab], { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToPath = useCallback((path: string, replace = false): void => {
    navigate(path, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToInventorySection = useCallback((sectionId: string, replace = false): void => {
    navigate(`${TAB_PATHS.inventory}#${encodeURIComponent(sectionId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToIncomingGearForm = useCallback((recordId?: string | null, replace = false): void => {
    const path = recordId
      ? `${TAB_PATHS['incoming-gear']}/${encodeURIComponent(recordId)}`
      : TAB_PATHS['incoming-gear'];
    navigate(path, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToJotformReviewGroup = useCallback((groupId: string, replace = false): void => {
    navigate(`/jotform/review/${encodeURIComponent(groupId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToTestingForm = useCallback((recordId?: string | null, replace = false): void => {
    const path = recordId
      ? `${TAB_PATHS.testing}/${encodeURIComponent(recordId)}`
      : TAB_PATHS.testing;
    navigate(path, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToPhotosForm = useCallback((recordId?: string | null, replace = false): void => {
    const path = recordId
      ? `${TAB_PATHS.photos}/${encodeURIComponent(recordId)}`
      : TAB_PATHS.photos;
    navigate(path, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToInventoryRecord = useCallback((recordId: string, replace = false): void => {
    navigate(`/inventory/${encodeURIComponent(recordId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToUsedGearWorkflowRecord = useCallback((recordId: string, replace = false): void => {
    navigate(`/inventory/workflow/${encodeURIComponent(recordId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToInventoryList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.inventory, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToInventoryPostPublishBucket = useCallback((
    bucket: UsedGearWorkflowPostPublishBucket,
    options?: { replace?: boolean; ownerFilter?: UsedGearWorkflowPostPublishOwnerFilter },
  ): void => {
    const params = new URLSearchParams();
    params.set('workflowPostPublishBucket', bucket);
    if (options?.ownerFilter && options.ownerFilter !== 'all') {
      params.set('workflowPostPublishOwner', options.ownerFilter);
    }

    navigate(`${TAB_PATHS.inventory}?${params.toString()}#used-gear-post-publish`, { replace: options?.replace ?? false });
    scrollToPageTop();
  }, [navigate]);

  const navigateToListingsRecord = useCallback((recordId: string, replace = false): void => {
    navigate(`/listings/${encodeURIComponent(recordId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToListingsList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.listings, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToUserRecord = useCallback((userId: string, replace = false): void => {
    navigate(`/account/users/${encodeURIComponent(userId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToUsersList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.users, { replace });
    scrollToPageTop();
  }, [navigate]);

  const handleLogout = useCallback((): void => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return {
    navigateToTab,
    navigateToPath,
    navigateToInventorySection,
    navigateToJotformReviewGroup,
    navigateToIncomingGearForm,
    navigateToTestingForm,
    navigateToPhotosForm,
    navigateToInventoryRecord,
    navigateToUsedGearWorkflowRecord,
    navigateToInventoryList,
    navigateToInventoryPostPublishBucket,
    navigateToListingsRecord,
    navigateToListingsList,
    navigateToUserRecord,
    navigateToUsersList,
    handleLogout,
  };
}