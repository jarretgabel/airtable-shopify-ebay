import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { TAB_PATHS, type Tab } from '@/app/appNavigation';

interface AppNavigationHandlers {
  navigateToTab: (tab: Tab, replace?: boolean) => void;
  navigateToApprovalRecord: (recordId: string, replace?: boolean) => void;
  navigateToApprovalList: (replace?: boolean) => void;
  navigateToShopifyApprovalRecord: (recordId: string, replace?: boolean) => void;
  navigateToShopifyApprovalList: (replace?: boolean) => void;
  navigateToUserRecord: (userId: string, replace?: boolean) => void;
  navigateToUsersList: (replace?: boolean) => void;
  handleLogout: () => void;
}

function scrollToPageTop(): void {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  // Ensure position is reset after route paint as well.
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
}

export function useAppNavigationHandlers(navigate: NavigateFunction, logout: () => void): AppNavigationHandlers {
  const navigateToTab = useCallback((tab: Tab, replace = false): void => {
    navigate(TAB_PATHS[tab], { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToApprovalRecord = useCallback((recordId: string, replace = false): void => {
    navigate(`/ebay/approval/${encodeURIComponent(recordId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToApprovalList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.approval, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToShopifyApprovalRecord = useCallback((recordId: string, replace = false): void => {
    navigate(`/shopify/approval/${encodeURIComponent(recordId)}`, { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToShopifyApprovalList = useCallback((replace = false): void => {
    navigate(TAB_PATHS['shopify-approval'], { replace });
    scrollToPageTop();
  }, [navigate]);

  const navigateToUserRecord = useCallback((userId: string, replace = false): void => {
    navigate(`/users/${encodeURIComponent(userId)}`, { replace });
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
    navigateToApprovalRecord,
    navigateToApprovalList,
    navigateToShopifyApprovalRecord,
    navigateToShopifyApprovalList,
    navigateToUserRecord,
    navigateToUsersList,
    handleLogout,
  };
}