import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { TAB_PATHS, type Tab } from '@/app/appNavigation';
import { loadUsedGearOperationalRecord } from '@/services/usedGearQueue';
import { resolveUsedGearOperationalPath } from '@/services/usedGearOperationalRouting';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';

type InventoryWorkflowQueueView = 'pending-review' | 'progress';

interface AppNavigationHandlers {
  navigateToTab: (tab: Tab, replace?: boolean) => void;
  navigateToPath: (path: string, replace?: boolean) => void;
  navigateToInventorySection: (sectionId: string, replace?: boolean) => void;
  navigateToJotformReviewGroup: (groupId: string, replace?: boolean) => void;
  navigateToManualIntake: (replace?: boolean) => void;
  navigateToIncomingGearForm: (recordId?: string | null, replace?: boolean) => void;
  navigateToTestingForm: (recordId?: string | null, replace?: boolean) => void;
  navigateToPhotosForm: (recordId?: string | null, replace?: boolean) => void;
  navigateToInventoryRecord: (recordId: string, replace?: boolean) => void;
  navigateToInventoryPriceEditor: (recordId: string, replace?: boolean) => void;
  navigateToUsedGearOperationalRecord: (recordId: string, replace?: boolean) => void;
  navigateToInventoryList: (replace?: boolean) => void;
  navigateToInventoryWorkflowView: (
    view: InventoryWorkflowQueueView,
    options?: { replace?: boolean; focusedGroupId?: string | null },
  ) => void;
  navigateToInventoryPostPublishBucket: (
    bucket: UsedGearWorkflowPostPublishBucket,
    options?: { replace?: boolean },
  ) => void;
  navigateToListingsRecord: (recordId: string, replace?: boolean) => void;
  navigateToListingsList: (replace?: boolean) => void;
  navigateToShopifyRecord: (recordId: string, replace?: boolean) => void;
  navigateToShopifyList: (replace?: boolean) => void;
  navigateToEbayRecord: (recordId: string, replace?: boolean) => void;
  navigateToEbayList: (replace?: boolean) => void;
  navigateToUserRecord: (userId: string, replace?: boolean) => void;
  navigateToUsersList: (replace?: boolean) => void;
  handleLogout: () => void;
}

function scrollToPageTop(): void {
  if (typeof window === 'undefined') return;
  // Defer until after React commits the new route, but avoid animating route
  // transitions because late-loading dashboard content can cause visible
  // scroll-anchor churn during a smooth scroll.
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0 });
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

  const navigateToManualIntake = useCallback((replace = false): void => {
    navigate('/inventory/manual-intake', { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToJotformReviewGroup = useCallback((groupId: string, replace = false): void => {
    navigate(`/parking-lot-1/review/${encodeURIComponent(groupId)}`, { replace });
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

  const navigateToInventoryPriceEditor = useCallback((recordId: string, replace = false): void => {
    navigate(`/inventory/price/${encodeURIComponent(recordId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToUsedGearOperationalRecord = useCallback((recordId: string, replace = false): void => {
    void loadUsedGearOperationalRecord(recordId)
      .then((record) => {
        navigate(resolveUsedGearOperationalPath(recordId, record.fields), { replace });
        scrollToPageTop();
      })
      .catch(() => {
        navigate(`/inventory/${encodeURIComponent(recordId)}`, { replace });
        scrollToPageTop();
      });
  }, [navigate]);

  const navigateToInventoryList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.inventory, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToInventoryWorkflowView = useCallback((
    view: InventoryWorkflowQueueView,
    options?: { replace?: boolean; focusedGroupId?: string | null },
  ): void => {
    const params = new URLSearchParams();

    if (view === 'pending-review') {
      if (options?.focusedGroupId) {
        params.set('workflowPendingReviewGroup', options.focusedGroupId);
      }

      navigate(`${TAB_PATHS.inventory}${params.toString() ? `?${params.toString()}` : ''}#used-gear-pending-review`, {
        replace: options?.replace ?? false,
      });
      scrollToPageTop();
      return;
    }

    if (options?.focusedGroupId) {
      params.set('workflowProgressGroup', options.focusedGroupId);
    }

    navigate(`${TAB_PATHS.inventory}${params.toString() ? `?${params.toString()}` : ''}#used-gear-workflow-progress`, {
      replace: options?.replace ?? false,
    });
    scrollToPageTop();
  }, [navigate]);

  const navigateToInventoryPostPublishBucket = useCallback((
    bucket: UsedGearWorkflowPostPublishBucket,
    options?: { replace?: boolean },
  ): void => {
    const params = new URLSearchParams();
    params.set('workflowPostPublishBucket', bucket);

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

  const navigateToShopifyRecord = useCallback((recordId: string, replace = false): void => {
    navigate(`/shopify/products/${encodeURIComponent(recordId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToShopifyList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.shopify, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToEbayRecord = useCallback((recordId: string, replace = false): void => {
    navigate(`/ebay/listings/${encodeURIComponent(recordId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToEbayList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.ebay, { replace });
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
    navigateToManualIntake,
    navigateToIncomingGearForm,
    navigateToTestingForm,
    navigateToPhotosForm,
    navigateToInventoryRecord,
    navigateToInventoryPriceEditor,
    navigateToUsedGearOperationalRecord,
    navigateToInventoryList,
    navigateToInventoryWorkflowView,
    navigateToInventoryPostPublishBucket,
    navigateToListingsRecord,
    navigateToListingsList,
    navigateToShopifyRecord,
    navigateToShopifyList,
    navigateToEbayRecord,
    navigateToEbayList,
    navigateToUserRecord,
    navigateToUsersList,
    handleLogout,
  };
}