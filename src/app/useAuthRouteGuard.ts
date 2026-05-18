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

    if (normalizedPath === '/testing') {
      navigate(canAccessPage('testing-queue') ? TAB_PATHS['testing-queue'] : TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    if (normalizedPath === '/photos') {
      navigate(canAccessPage('photography-queue') ? TAB_PATHS['photography-queue'] : TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    if (normalizedPath === '/inventory') {
      navigate('/workflow-hub', { replace: true });
      return;
    }

    if (normalizedPath === '/intake') {
      navigate('/manual-intake', { replace: true });
      return;
    }

    const legacyInventoryPriceEditorMatch = normalizedPath.match(/^\/inventory\/price\/([^/]+)$/);
    if (legacyInventoryPriceEditorMatch) {
      navigate(`/workflow-hub/price/${legacyInventoryPriceEditorMatch[1]}`, { replace: true });
      return;
    }

    const legacyInventoryDetailMatch = normalizedPath.match(/^\/inventory\/(?!price\/|manual-intake\/|workflow\/)([^/]+)$/);
    if (legacyInventoryDetailMatch) {
      navigate(`/workflow-hub/${legacyInventoryDetailMatch[1]}`, { replace: true });
      return;
    }

    const legacyManualIntakeDetailMatch = normalizedPath.match(/^\/manual-intake\/([^/]+)$/);
    if (legacyManualIntakeDetailMatch) {
      navigate(`/intake/${legacyManualIntakeDetailMatch[1]}`, { replace: true });
      return;
    }

    const legacyPendingReviewRecordMatch = normalizedPath.match(/^\/parking-lot-1\/review-record\/([^/]+)$/);
    if (legacyPendingReviewRecordMatch) {
      navigate(`/parking-lot-1/${legacyPendingReviewRecordMatch[1]}`, { replace: true });
      return;
    }

    const isKnownTabPath = isTab(normalizedPath.slice(1));
    const isJotformReviewRecordPath = /^\/parking-lot-1\/(?!review\/)[^/]+$/.test(normalizedPath);
    const isLotTwoReviewRecordPath = /^\/parking-lot-2\/(?!review\/)[^/]+$/.test(normalizedPath);
    const isTrashReviewRecordPath = /^\/trash-review\/review\/[^/]+$/.test(normalizedPath);
    const isManualIntakeDetailPath = /^\/manual-intake\/[^/]+$/.test(normalizedPath);
    const isIntakeDetailPath = /^\/intake\/[^/]+$/.test(normalizedPath);
    const isTestingDetailPath = /^\/testing\/[^/]+$/.test(normalizedPath);
    const isPhotosDetailPath = /^\/photos\/[^/]+$/.test(normalizedPath);
    const isInventoryPriceEditorPath = /^\/workflow-hub\/price\/[^/]+$/.test(normalizedPath);
    const isInventoryManualIntakePath = normalizedPath === '/manual-intake';
    const isInventoryDetailPath = /^\/workflow-hub\/[^/]+$/.test(normalizedPath);
    const isListingsDetailPath = /^\/listings\/[^/]+$/.test(normalizedPath);
    const isEbayListingsDetailPath = /^\/ebay\/listings\/[^/]+$/.test(normalizedPath);
    const isShopifyProductsDetailPath = /^\/shopify\/products\/[^/]+$/.test(normalizedPath);
    const isUserDetailPath = /^\/account\/users\/[^/]+$/.test(normalizedPath);
    const isKnownSubPath =
      normalizedPath === '/workflow-hub' ||
      isInventoryPriceEditorPath ||
      isInventoryManualIntakePath ||
      isManualIntakeDetailPath ||
      isIntakeDetailPath ||
      isInventoryDetailPath ||
      normalizedPath === '/listings' ||
      isListingsDetailPath ||
      normalizedPath === '/workflow/post-publish' ||
      normalizedPath === '/ebay/listings' ||
      isEbayListingsDetailPath ||
      normalizedPath === '/parking-lot-2' ||
      /^\/parking-lot-2\/group\/[^/]+$/.test(normalizedPath) ||
      isLotTwoReviewRecordPath ||
      normalizedPath === '/trash-review' ||
      isTrashReviewRecordPath ||
      normalizedPath === '/workflow/testing' ||
      normalizedPath === '/workflow/photography' ||
      normalizedPath === '/parking-lot-1' ||
      /^\/parking-lot-1\/group\/[^/]+$/.test(normalizedPath) ||
      isJotformReviewRecordPath ||
      isTestingDetailPath ||
      isPhotosDetailPath ||
      normalizedPath === '/shopify/products' ||
      isShopifyProductsDetailPath ||
      normalizedPath === '/account/settings' ||
      normalizedPath === '/account/notifications' ||
      normalizedPath === '/workflow-guide' ||
      normalizedPath === '/account/users' ||
      isUserDetailPath;
    if (!isKnownTabPath && !isKnownSubPath) {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    const requestedTab: Tab | null =
      normalizedPath === '/listings' || isListingsDetailPath
          ? 'listings'
        : normalizedPath === '/workflow/post-publish'
          ? 'post-publish'
        : normalizedPath === '/ebay/listings' || isEbayListingsDetailPath
            ? 'ebay'
            : normalizedPath === '/shopify/products' || isShopifyProductsDetailPath
              ? 'shopify'
                : normalizedPath === '/parking-lot-2' || isLotTwoReviewRecordPath || /^\/parking-lot-2\/review\/[^/]+$/.test(normalizedPath)
                  ? 'parking-lot-2'
                : normalizedPath === '/trash-review' || isTrashReviewRecordPath
                  ? 'trash-review'
                : normalizedPath === '/workflow/testing'
                  ? 'testing-queue'
                : normalizedPath === '/workflow/photography'
                  ? 'photography-queue'
              : normalizedPath === '/parking-lot-1' || /^\/parking-lot-1\/review\/[^/]+$/.test(normalizedPath) || isJotformReviewRecordPath
                ? 'parking-lot-1'
              : isInventoryManualIntakePath
                ? 'manual-intake'
              : isManualIntakeDetailPath
                ? 'manual-intake'
              : isIntakeDetailPath
                ? 'manual-intake'
              : isTestingDetailPath
                ? 'testing'
              : isPhotosDetailPath
                ? 'photos'
              : normalizedPath === '/workflow-hub' || isInventoryPriceEditorPath || isInventoryDetailPath
                ? 'inventory'
              : normalizedPath === '/account/settings'
                ? 'settings'
                : normalizedPath === '/account/notifications'
                  ? 'notifications'
                  : normalizedPath === '/workflow-guide'
                    ? 'workflow-guide'
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
