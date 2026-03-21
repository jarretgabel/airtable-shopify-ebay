import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { TAB_PATHS, type Tab } from '@/app/appNavigation';

interface AppNavigationHandlers {
  navigateToTab: (tab: Tab, replace?: boolean) => void;
  navigateToApprovalRecord: (recordId: string, replace?: boolean) => void;
  navigateToApprovalList: (replace?: boolean) => void;
  navigateToUserRecord: (userId: string, replace?: boolean) => void;
  navigateToUsersList: (replace?: boolean) => void;
  handleLogout: () => void;
}

export function useAppNavigationHandlers(navigate: NavigateFunction, logout: () => void): AppNavigationHandlers {
  const navigateToTab = useCallback((tab: Tab, replace = false): void => {
    navigate(TAB_PATHS[tab], { replace });
  }, [navigate]);

  const navigateToApprovalRecord = useCallback((recordId: string, replace = false): void => {
    navigate(`/approval/${encodeURIComponent(recordId)}`, { replace });
  }, [navigate]);

  const navigateToApprovalList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.approval, { replace });
  }, [navigate]);

  const navigateToUserRecord = useCallback((userId: string, replace = false): void => {
    navigate(`/users/${encodeURIComponent(userId)}`, { replace });
  }, [navigate]);

  const navigateToUsersList = useCallback((replace = false): void => {
    navigate(TAB_PATHS.users, { replace });
  }, [navigate]);

  const handleLogout = useCallback((): void => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return {
    navigateToTab,
    navigateToApprovalRecord,
    navigateToApprovalList,
    navigateToUserRecord,
    navigateToUsersList,
    handleLogout,
  };
}