import { useEffect } from 'react';
import { Tab, TAB_PATHS, isTab } from './appNavigation';

interface UseAuthRouteGuardInput {
  authReady: boolean;
  currentUser: unknown;
  requiresPasswordChange: boolean;
  isLoginPath: boolean;
  isResetPasswordPath: boolean;
  normalizedPath: string;
  firstAccessibleTab: Tab;
  canAccessPage: (tab: Tab) => boolean;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

export function useAuthRouteGuard({
  authReady,
  currentUser,
  requiresPasswordChange,
  isLoginPath,
  isResetPasswordPath,
  normalizedPath,
  firstAccessibleTab,
  canAccessPage,
  navigate,
}: UseAuthRouteGuardInput): void {
  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!currentUser) {
      if (!isLoginPath && !isResetPasswordPath) {
        navigate('/login', { replace: true });
      }
      return;
    }

    if (isLoginPath || isResetPasswordPath || normalizedPath === '/') {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    const isKnownTabPath = isTab(normalizedPath.slice(1));
    const isIncomingGearDetailPath = /^\/incoming-gear\/[^/]+$/.test(normalizedPath);
    const isTestingDetailPath = /^\/testing\/[^/]+$/.test(normalizedPath);
    const isPhotosDetailPath = /^\/photos\/[^/]+$/.test(normalizedPath);
    const isInventoryDetailPath = /^\/inventory\/[^/]+$/.test(normalizedPath);
    const isApprovalDetailPath = /^\/ebay\/approval\/[^/]+$/.test(normalizedPath);
    const isShopifyApprovalDetailPath = /^\/shopify\/approval\/[^/]+$/.test(normalizedPath);
    const isListingsDetailPath = /^\/listings\/[^/]+$/.test(normalizedPath);
    const isUserDetailPath = /^\/account\/users\/[^/]+$/.test(normalizedPath);
    const isKnownSubPath =
      normalizedPath === '/inventory' ||
      isInventoryDetailPath ||
      normalizedPath === '/listings' ||
      isListingsDetailPath ||
      normalizedPath === '/ebay/listings' ||
      normalizedPath === '/incoming-gear' ||
      isIncomingGearDetailPath ||
      normalizedPath === '/testing' ||
      isTestingDetailPath ||
      normalizedPath === '/photos' ||
      isPhotosDetailPath ||
      normalizedPath === '/ebay/approval' ||
      isApprovalDetailPath ||
      normalizedPath === '/shopify/products' ||
      normalizedPath === '/shopify/approval' ||
      isShopifyApprovalDetailPath ||
      normalizedPath === '/account/settings' ||
      normalizedPath === '/account/notifications' ||
      normalizedPath === '/account/users' ||
      isUserDetailPath;
    if (!isKnownTabPath && !isKnownSubPath) {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    const requestedTab: Tab | null =
      normalizedPath === '/ebay/approval' || isApprovalDetailPath
        ? 'approval'
        : normalizedPath === '/listings' || isListingsDetailPath
          ? 'listings'
        : normalizedPath === '/shopify/approval' || isShopifyApprovalDetailPath
          ? 'shopify-approval'
          : normalizedPath === '/ebay/listings'
            ? 'ebay'
            : normalizedPath === '/shopify/products'
              ? 'shopify'
              : normalizedPath === '/incoming-gear' || isIncomingGearDetailPath
                ? 'incoming-gear'
              : normalizedPath === '/testing' || isTestingDetailPath
                ? 'testing'
              : normalizedPath === '/photos' || isPhotosDetailPath
                ? 'photos'
              : normalizedPath === '/inventory' || isInventoryDetailPath
                ? 'inventory'
              : normalizedPath === '/account/settings'
                ? 'settings'
                : normalizedPath === '/account/notifications'
                  ? 'notifications'
                  : normalizedPath === '/account/users' || isUserDetailPath
                ? 'users'
                : isKnownTabPath
                  ? (normalizedPath.slice(1) as Tab)
                  : null;

    if (requestedTab && !canAccessPage(requestedTab)) {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
    }
  }, [
    authReady,
    currentUser,
    requiresPasswordChange,
    isLoginPath,
    isResetPasswordPath,
    normalizedPath,
    navigate,
    firstAccessibleTab,
    canAccessPage,
  ]);
}
