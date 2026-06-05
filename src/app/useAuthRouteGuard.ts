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
    const isJotformReviewRecordPath = /^\/parking-lot\/(?!group\/|arrival\/|review\/)[^/]+$/.test(normalizedPath);
    const isParkingLotArrivalRecordPath = /^\/parking-lot\/arrival\/[^/]+$/.test(normalizedPath);
    const isParkingLotArrivalGroupPath = /^\/parking-lot\/arrival\/group\/[^/]+$/.test(normalizedPath);
    const isTrashReviewGroupPath = /^\/trash-review\/group\/[^/]+$/.test(normalizedPath);
    const isTrashReviewRecordPath = /^\/trash-review\/review\/[^/]+$/.test(normalizedPath);
    const isCreateIntakeItemPath = normalizedPath === '/create-intake-item';
    const isManualIntakeDetailPath = /^\/manual-intake\/[^/]+$/.test(normalizedPath);
    const isJotformAuditPath = normalizedPath === '/jotform-audit';
    const isJotformDirectoryPath = normalizedPath === '/jotform';
    const isJotformDirectoryDetailPath = /^\/jotform\/[^/]+$/.test(normalizedPath);
    const isTestingDetailPath = /^\/testing\/[^/]+$/.test(normalizedPath);
    const isPhotosDetailPath = /^\/photography\/[^/]+$/.test(normalizedPath);
    const isInventoryPriceEditorPath = /^\/workflow-hub\/price\/[^/]+$/.test(normalizedPath);
    const isInventoryManualIntakePath = normalizedPath === '/manual-intake';
    const isInventoryDetailPath = /^\/workflow-hub\/[^/]+$/.test(normalizedPath);
    const isListingsDetailPath = /^\/listings\/[^/]+$/.test(normalizedPath);
    const isSoldReadyListingsDetailPath = /^\/sold-ready\/[^/]+$/.test(normalizedPath);
    const isCompletedShipmentsDetailPath = /^\/completed-shipments\/[^/]+$/.test(normalizedPath);
    const isEbayListingsDetailPath = /^\/ebay\/(?!listings$)[^/]+$/.test(normalizedPath);
    const isShopifyProductsDetailPath = /^\/shopify\/(?!products$)[^/]+$/.test(normalizedPath);
    const isUserDetailPath = /^\/account\/users\/[^/]+$/.test(normalizedPath);
    const isKnownSubPath =
      normalizedPath === '/workflow-hub' ||
      isInventoryPriceEditorPath ||
      isInventoryManualIntakePath ||
      isCreateIntakeItemPath ||
      isManualIntakeDetailPath ||
      isJotformAuditPath ||
      isJotformDirectoryPath ||
      isJotformDirectoryDetailPath ||
      isInventoryDetailPath ||
      normalizedPath === '/listings' ||
      isListingsDetailPath ||
      isSoldReadyListingsDetailPath ||
      normalizedPath === '/post-publish' ||
      normalizedPath === '/completed-shipments' ||
      isCompletedShipmentsDetailPath ||
      normalizedPath === '/ebay' ||
      isEbayListingsDetailPath ||
      normalizedPath === '/trash-review' ||
      isTrashReviewGroupPath ||
      isTrashReviewRecordPath ||
      normalizedPath === '/workflow/testing' ||
      normalizedPath === '/workflow/photography' ||
      normalizedPath === '/parking-lot' ||
      /^\/parking-lot\/group\/[^/]+$/.test(normalizedPath) ||
      isParkingLotArrivalGroupPath ||
      isJotformReviewRecordPath ||
      isParkingLotArrivalRecordPath ||
      normalizedPath === '/testing' ||
      isTestingDetailPath ||
      normalizedPath === '/photography' ||
      isPhotosDetailPath ||
      normalizedPath === '/shopify' ||
      isShopifyProductsDetailPath ||
      normalizedPath === '/account/settings' ||
      normalizedPath === '/account/notifications' ||
      normalizedPath === '/workflow-guide/edit' ||
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
        : normalizedPath === '/post-publish' || isSoldReadyListingsDetailPath
          ? 'post-publish'
        : normalizedPath === '/completed-shipments' || isCompletedShipmentsDetailPath
          ? 'archive'
        : normalizedPath === '/ebay' || isEbayListingsDetailPath
            ? 'ebay'
            : normalizedPath === '/shopify' || isShopifyProductsDetailPath
              ? 'shopify'
                : normalizedPath === '/trash-review' || isTrashReviewGroupPath || isTrashReviewRecordPath
                  ? 'trash-review'
                : normalizedPath === '/workflow/testing'
                  ? 'testing-queue'
                : normalizedPath === '/workflow/photography'
                  ? 'photography-queue'
              : normalizedPath === '/parking-lot' || /^\/parking-lot\/group\/[^/]+$/.test(normalizedPath) || isParkingLotArrivalGroupPath || /^\/parking-lot\/review\/[^/]+$/.test(normalizedPath) || isJotformReviewRecordPath || isParkingLotArrivalRecordPath
                ? 'parking-lot'
              : isInventoryManualIntakePath
                ? 'manual-intake'
              : isCreateIntakeItemPath
                ? 'create-intake-item'
              : isManualIntakeDetailPath
                ? 'manual-intake'
              : isJotformAuditPath
                ? 'jotform-audit'
              : isJotformDirectoryPath || isJotformDirectoryDetailPath
                ? 'jotform'
              : normalizedPath === '/testing'
                ? 'testing-queue'
              : isTestingDetailPath
                ? 'testing'
              : normalizedPath === '/photography'
                ? 'photography-queue'
              : isPhotosDetailPath
                ? 'photos'
              : normalizedPath === '/workflow-hub' || isInventoryPriceEditorPath || isInventoryDetailPath
                ? 'inventory'
              : normalizedPath === '/account/settings'
                ? 'settings'
                : normalizedPath === '/account/notifications'
                  ? 'notifications'
                  : normalizedPath === '/workflow-guide/edit'
                    ? 'workflow-guide-editor'
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
