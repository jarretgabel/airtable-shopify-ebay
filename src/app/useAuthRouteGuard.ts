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

    if (normalizedPath === '/ebay/approval' || normalizedPath.startsWith('/ebay/approval/') || normalizedPath === '/shopify/approval' || normalizedPath.startsWith('/shopify/approval/')) {
      const legacyApprovalRecordMatch = normalizedPath.match(/^\/(?:ebay|shopify)\/approval\/([^/]+)$/);
      navigate(
        legacyApprovalRecordMatch
          ? `${TAB_PATHS.listings}/${encodeURIComponent(decodeURIComponent(legacyApprovalRecordMatch[1]))}`
          : TAB_PATHS.listings,
        { replace: true },
      );
      return;
    }

    const isKnownTabPath = isTab(normalizedPath.slice(1));
    const isJotformReviewRecordPath = /^\/parking-lot-1\/review-record\/[^/]+$/.test(normalizedPath);
    const isTrashReviewRecordPath = /^\/trash-review\/review\/[^/]+$/.test(normalizedPath);
    const isIncomingGearDetailPath = /^\/incoming-gear\/[^/]+$/.test(normalizedPath);
    const isTestingDetailPath = /^\/testing\/[^/]+$/.test(normalizedPath);
    const isPhotosDetailPath = /^\/photos\/[^/]+$/.test(normalizedPath);
    const isWorkflowPriceEditorPath = /^\/inventory\/workflow\/[^/]+\/price$/.test(normalizedPath);
    const isInventoryWorkflowDetailPath = /^\/inventory\/workflow\/[^/]+$/.test(normalizedPath);
    const isInventoryDetailPath = /^\/inventory\/[^/]+$/.test(normalizedPath);
    const isListingsDetailPath = /^\/listings\/[^/]+$/.test(normalizedPath);
    const isEbayListingsDetailPath = /^\/ebay\/listings\/[^/]+$/.test(normalizedPath);
    const isShopifyProductsDetailPath = /^\/shopify\/products\/[^/]+$/.test(normalizedPath);
    const isUserDetailPath = /^\/account\/users\/[^/]+$/.test(normalizedPath);
    const isKnownSubPath =
      normalizedPath === '/inventory' ||
      isWorkflowPriceEditorPath ||
      isInventoryWorkflowDetailPath ||
      isInventoryDetailPath ||
      normalizedPath === '/listings' ||
      isListingsDetailPath ||
      normalizedPath === '/ebay/listings' ||
      isEbayListingsDetailPath ||
      normalizedPath === '/parking-lot-2' ||
      normalizedPath === '/trash-review' ||
      isTrashReviewRecordPath ||
      normalizedPath === '/workflow/testing' ||
      normalizedPath === '/workflow/photography' ||
      normalizedPath === '/workflow/pre-listing' ||
      normalizedPath === '/parking-lot-1' ||
      /^\/parking-lot-1\/review\/[^/]+$/.test(normalizedPath) ||
      isJotformReviewRecordPath ||
      normalizedPath === '/incoming-gear' ||
      isIncomingGearDetailPath ||
      normalizedPath === '/testing' ||
      isTestingDetailPath ||
      normalizedPath === '/photos' ||
      isPhotosDetailPath ||
      normalizedPath === '/shopify/products' ||
      isShopifyProductsDetailPath ||
      normalizedPath === '/account/settings' ||
      normalizedPath === '/account/notifications' ||
      normalizedPath === '/account/users' ||
      isUserDetailPath;
    if (!isKnownTabPath && !isKnownSubPath) {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    const requestedTab: Tab | null =
      normalizedPath === '/listings' || isListingsDetailPath
          ? 'listings'
        : normalizedPath === '/ebay/listings' || isEbayListingsDetailPath
            ? 'ebay'
            : normalizedPath === '/shopify/products' || isShopifyProductsDetailPath
              ? 'shopify'
                : normalizedPath === '/parking-lot-2'
                  ? 'parking-lot-2'
                : normalizedPath === '/trash-review' || isTrashReviewRecordPath
                  ? 'trash-review'
                : normalizedPath === '/workflow/testing'
                  ? 'testing-queue'
                : normalizedPath === '/workflow/photography'
                  ? 'photography-queue'
                : normalizedPath === '/workflow/pre-listing'
                  ? 'pre-listing-queue'
              : normalizedPath === '/parking-lot-1' || /^\/parking-lot-1\/review\/[^/]+$/.test(normalizedPath) || isJotformReviewRecordPath
                ? 'jotform'
              : normalizedPath === '/incoming-gear' || isIncomingGearDetailPath
                ? 'incoming-gear'
              : normalizedPath === '/testing' || isTestingDetailPath
                ? 'testing'
              : normalizedPath === '/photos' || isPhotosDetailPath
                ? 'photos'
              : normalizedPath === '/inventory' || isWorkflowPriceEditorPath || isInventoryWorkflowDetailPath || isInventoryDetailPath
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
