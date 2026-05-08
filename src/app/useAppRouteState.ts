import type { Location } from 'react-router-dom';
import { type Tab, isTab } from '@/app/appNavigation';

interface AppRouteState {
  normalizedPath: string;
  isLoginPath: boolean;
  isResetPasswordPath: boolean;
  resetToken: string | null;
  jotformReviewGroupId: string | null;
  incomingGearRecordId: string | null;
  testingRecordId: string | null;
  photosRecordId: string | null;
  inventoryRecordId: string | null;
  usedGearWorkflowRecordId: string | null;
  listingsRecordId: string | null;
  userRecordId: string | null;
  activeTab: Tab;
  firstAccessibleTab: Tab;
}

export function useAppRouteState(location: Location, accessiblePages: string[]): AppRouteState {
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(location.search);
  const isLoginPath = normalizedPath === '/login';
  const isResetPasswordPath = normalizedPath === '/reset-password';
  const resetToken = searchParams.get('token');
  const jotformReviewGroupMatch = normalizedPath.match(/^\/jotform\/review\/([^/]+)$/);
  const incomingGearRecordMatch = normalizedPath.match(/^\/incoming-gear\/([^/]+)$/);
  const testingRecordMatch = normalizedPath.match(/^\/testing\/([^/]+)$/);
  const photosRecordMatch = normalizedPath.match(/^\/photos\/([^/]+)$/);
  const usedGearWorkflowRecordMatch = normalizedPath.match(/^\/inventory\/workflow\/([^/]+)$/);
  const inventoryRecordMatch = normalizedPath.match(/^\/inventory\/([^/]+)$/);
  const legacyEbayApprovalRecordMatch = normalizedPath.match(/^\/ebay\/approval\/([^/]+)$/);
  const legacyShopifyApprovalRecordMatch = normalizedPath.match(/^\/shopify\/approval\/([^/]+)$/);
  const listingsRecordMatch = normalizedPath.match(/^\/listings\/([^/]+)$/);
  const userRecordMatch = normalizedPath.match(/^\/account\/users\/([^/]+)$/);
  const firstAccessibleTab = (accessiblePages[0] ?? 'dashboard') as Tab;

  const activeTab: Tab = (() => {
    if (normalizedPath === '/ebay/approval' || normalizedPath.startsWith('/ebay/approval/')) return 'listings';
    if (normalizedPath === '/shopify/approval' || normalizedPath.startsWith('/shopify/approval/')) return 'listings';
    if (normalizedPath === '/listings' || listingsRecordMatch) return 'listings';
    if (normalizedPath === '/ebay/listings') return 'ebay';
    if (normalizedPath === '/shopify/products') return 'shopify';
    if (normalizedPath === '/parking-lot-2') return 'parking-lot-2';
    if (normalizedPath === '/trash-review') return 'trash-review';
    if (normalizedPath === '/workflow/testing') return 'testing-queue';
    if (normalizedPath === '/workflow/photography') return 'photography-queue';
    if (normalizedPath === '/workflow/pre-listing') return 'pre-listing-queue';
    if (normalizedPath === '/incoming-gear' || incomingGearRecordMatch) return 'incoming-gear';
    if (normalizedPath === '/testing' || testingRecordMatch) return 'testing';
    if (normalizedPath === '/photos' || photosRecordMatch) return 'photos';
    if (normalizedPath === '/inventory' || usedGearWorkflowRecordMatch || inventoryRecordMatch) return 'inventory';
    if (normalizedPath === '/jotform' || jotformReviewGroupMatch) return 'jotform';
    if (normalizedPath === '/account/users' || userRecordMatch) return 'users';
    if (normalizedPath === '/account/settings') return 'settings';
    if (normalizedPath === '/account/notifications') return 'notifications';

    const tabFromPath = normalizedPath.slice(1);
    return isTab(tabFromPath) ? tabFromPath : 'dashboard';
  })();

  return {
    normalizedPath,
    isLoginPath,
    isResetPasswordPath,
    resetToken,
    jotformReviewGroupId: jotformReviewGroupMatch ? decodeURIComponent(jotformReviewGroupMatch[1]) : null,
    incomingGearRecordId: incomingGearRecordMatch ? decodeURIComponent(incomingGearRecordMatch[1]) : null,
    testingRecordId: testingRecordMatch ? decodeURIComponent(testingRecordMatch[1]) : null,
    photosRecordId: photosRecordMatch ? decodeURIComponent(photosRecordMatch[1]) : null,
    usedGearWorkflowRecordId: usedGearWorkflowRecordMatch ? decodeURIComponent(usedGearWorkflowRecordMatch[1]) : null,
    inventoryRecordId: inventoryRecordMatch ? decodeURIComponent(inventoryRecordMatch[1]) : null,
    listingsRecordId: listingsRecordMatch
      ? decodeURIComponent(listingsRecordMatch[1])
      : legacyEbayApprovalRecordMatch
        ? decodeURIComponent(legacyEbayApprovalRecordMatch[1])
        : legacyShopifyApprovalRecordMatch
          ? decodeURIComponent(legacyShopifyApprovalRecordMatch[1])
          : null,
    userRecordId: userRecordMatch ? decodeURIComponent(userRecordMatch[1]) : null,
    activeTab,
    firstAccessibleTab,
  };
}