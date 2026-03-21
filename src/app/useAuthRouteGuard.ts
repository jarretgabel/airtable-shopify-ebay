import { useEffect } from 'react';
import { Tab, TAB_PATHS, isTab } from './appNavigation';

interface UseAuthRouteGuardInput {
  currentUser: unknown;
  isLoginPath: boolean;
  isResetPasswordPath: boolean;
  normalizedPath: string;
  firstAccessibleTab: Tab;
  canAccessPage: (tab: Tab) => boolean;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

export function useAuthRouteGuard({
  currentUser,
  isLoginPath,
  isResetPasswordPath,
  normalizedPath,
  firstAccessibleTab,
  canAccessPage,
  navigate,
}: UseAuthRouteGuardInput): void {
  useEffect(() => {
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
    const isApprovalDetailPath = /^\/ebay\/approval\/[^/]+$/.test(normalizedPath);
    const isShopifyApprovalDetailPath = /^\/shopify\/approval\/[^/]+$/.test(normalizedPath);
    const isUserDetailPath = /^\/users\/[^/]+$/.test(normalizedPath);
    const isKnownSubPath =
      normalizedPath === '/ebay/listings' ||
      normalizedPath === '/ebay/approval' ||
      isApprovalDetailPath ||
      normalizedPath === '/shopify/products' ||
      normalizedPath === '/shopify/approval' ||
      isShopifyApprovalDetailPath ||
      normalizedPath === '/users' ||
      isUserDetailPath;
    if (!isKnownTabPath && !isKnownSubPath) {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    const requestedTab: Tab | null =
      normalizedPath === '/ebay/approval' || isApprovalDetailPath
        ? 'approval'
        : normalizedPath === '/shopify/approval' || isShopifyApprovalDetailPath
          ? 'shopify-approval'
          : normalizedPath === '/ebay/listings'
            ? 'ebay'
            : normalizedPath === '/shopify/products'
              ? 'shopify'
              : normalizedPath === '/users' || isUserDetailPath
                ? 'users'
                : isKnownTabPath
                  ? (normalizedPath.slice(1) as Tab)
                  : null;

    if (requestedTab && !canAccessPage(requestedTab)) {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
    }
  }, [
    currentUser,
    isLoginPath,
    isResetPasswordPath,
    normalizedPath,
    navigate,
    firstAccessibleTab,
    canAccessPage,
  ]);
}
