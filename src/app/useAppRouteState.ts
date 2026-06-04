import type { Location } from 'react-router-dom';
import { type Tab, isTab } from '@/app/appNavigation';

export interface AppRouteState {
  normalizedPath: string;
  isLoginPath: boolean;
  isResetPasswordPath: boolean;
  resetToken: string | null;
  manualIntakeMode: boolean;
  jotformReviewGroupId: string | null;
  jotformReviewRecordId: string | null;
  jotformDirectoryRecordId: string | null;
  parkingLotArrivalGroupId: string | null;
  parkingLotArrivalRecordId: string | null;
  trashReviewGroupId: string | null;
  trashReviewRecordId: string | null;
  manualIntakeRecordId: string | null;
  testingRecordId: string | null;
  photosRecordId: string | null;
  inventoryRecordId: string | null;
  inventoryPriceEditorRecordId: string | null;
  listingsRecordId: string | null;
  soldReadyListingsRecordId: string | null;
  shopifyListingsRecordId: string | null;
  ebayListingsRecordId: string | null;
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
  const manualIntakeRecordMatch = normalizedPath.match(/^\/manual-intake\/([^/]+)$/);
  const jotformDirectoryRecordMatch = normalizedPath.match(/^\/jotform\/([^/]+)$/);
  const manualIntakeMode = normalizedPath === '/manual-intake' || normalizedPath === '/create-intake-item' || Boolean(manualIntakeRecordMatch);
  const jotformReviewGroupMatch = normalizedPath.match(/^\/parking-lot\/group\/([^/]+)$/);
  const jotformReviewRecordMatch = normalizedPath.match(/^\/parking-lot\/(?!group\/|arrival\/|review\/)([^/]+)$/);
  const parkingLotArrivalGroupMatch = normalizedPath.match(/^\/parking-lot\/arrival\/group\/([^/]+)$/);
  const parkingLotArrivalRecordMatch = normalizedPath.match(/^\/parking-lot\/arrival\/([^/]+)$/);
  const trashReviewGroupMatch = normalizedPath.match(/^\/trash-review\/group\/([^/]+)$/);
  const trashReviewRecordMatch = normalizedPath.match(/^\/trash-review\/review\/([^/]+)$/);
  const testingRecordMatch = normalizedPath.match(/^\/testing\/([^/]+)$/);
  const photosRecordMatch = normalizedPath.match(/^\/photography\/([^/]+)$/);
  const inventoryPriceEditorRecordMatch = normalizedPath.match(/^\/workflow-hub\/price\/([^/]+)$/);
  const inventoryRecordMatch = manualIntakeMode ? null : normalizedPath.match(/^\/workflow-hub\/(?!price\/)([^/]+)$/);
  const ebayListingsRecordMatch = normalizedPath.match(/^\/ebay\/(?!listings$)([^/]+)$/);
  const shopifyListingsRecordMatch = normalizedPath.match(/^\/shopify\/(?!products$)([^/]+)$/);
  const soldReadyListingsRecordMatch = normalizedPath.match(/^\/sold-ready\/([^/]+)$/);
  const listingsRecordMatch = soldReadyListingsRecordMatch
    ? null
    : normalizedPath.match(/^\/listings\/(?!sold-ready\/)([^/]+)$/);
  const userRecordMatch = normalizedPath.match(/^\/account\/users\/([^/]+)$/);
  const firstAccessibleTab = (accessiblePages[0] ?? 'dashboard') as Tab;

  const activeTab: Tab = (() => {
    if (normalizedPath === '/listings' || listingsRecordMatch || soldReadyListingsRecordMatch) return 'listings';
    if (normalizedPath === '/post-publish') return 'post-publish';
    if (normalizedPath === '/completed-shipments') return 'archive';
    if (normalizedPath === '/ebay' || ebayListingsRecordMatch) return 'ebay';
    if (normalizedPath === '/shopify' || shopifyListingsRecordMatch) return 'shopify';
    if (normalizedPath === '/parking-lot' || jotformReviewGroupMatch || jotformReviewRecordMatch || parkingLotArrivalGroupMatch || parkingLotArrivalRecordMatch) return 'parking-lot';
    if (normalizedPath === '/trash-review' || trashReviewGroupMatch || trashReviewRecordMatch) return 'trash-review';
    if (normalizedPath === '/workflow/testing') return 'testing-queue';
    if (normalizedPath === '/workflow/photography') return 'photography-queue';
    if (normalizedPath === '/create-intake-item') return 'create-intake-item';
    if (normalizedPath === '/manual-intake' || manualIntakeRecordMatch) return 'manual-intake';
    if (normalizedPath === '/jotform-audit') return 'jotform-audit';
    if (normalizedPath === '/jotform' || jotformDirectoryRecordMatch) return 'jotform';
    if (normalizedPath === '/testing') return 'testing-queue';
    if (testingRecordMatch) return 'testing';
    if (normalizedPath === '/photography') return 'photography-queue';
    if (photosRecordMatch) return 'photos';
    if (normalizedPath === '/workflow-hub' || inventoryPriceEditorRecordMatch || inventoryRecordMatch) return 'inventory';
    if (normalizedPath === '/account/users' || userRecordMatch) return 'users';
    if (normalizedPath === '/account/settings') return 'settings';
    if (normalizedPath === '/account/notifications') return 'notifications';
    if (normalizedPath === '/workflow-guide/edit') return 'workflow-guide-editor';
    if (normalizedPath === '/workflow-guide') return 'workflow-guide';
    const tabFromPath = normalizedPath.slice(1);
    return isTab(tabFromPath) ? tabFromPath : 'dashboard';
  })();

  return {
    normalizedPath,
    isLoginPath,
    isResetPasswordPath,
    resetToken,
    manualIntakeMode,
    jotformReviewGroupId: jotformReviewGroupMatch ? decodeURIComponent(jotformReviewGroupMatch[1]) : null,
    jotformReviewRecordId: jotformReviewRecordMatch ? decodeURIComponent(jotformReviewRecordMatch[1]) : null,
    jotformDirectoryRecordId: jotformDirectoryRecordMatch ? decodeURIComponent(jotformDirectoryRecordMatch[1]) : null,
    parkingLotArrivalGroupId: parkingLotArrivalGroupMatch ? decodeURIComponent(parkingLotArrivalGroupMatch[1]) : null,
    parkingLotArrivalRecordId: parkingLotArrivalRecordMatch ? decodeURIComponent(parkingLotArrivalRecordMatch[1]) : null,
    trashReviewGroupId: trashReviewGroupMatch ? decodeURIComponent(trashReviewGroupMatch[1]) : null,
    trashReviewRecordId: trashReviewRecordMatch ? decodeURIComponent(trashReviewRecordMatch[1]) : null,
    manualIntakeRecordId: manualIntakeRecordMatch
      ? decodeURIComponent(manualIntakeRecordMatch[1])
      : null,
    testingRecordId: testingRecordMatch ? decodeURIComponent(testingRecordMatch[1]) : null,
    photosRecordId: photosRecordMatch ? decodeURIComponent(photosRecordMatch[1]) : null,
    inventoryPriceEditorRecordId: inventoryPriceEditorRecordMatch ? decodeURIComponent(inventoryPriceEditorRecordMatch[1]) : null,
    inventoryRecordId: inventoryRecordMatch ? decodeURIComponent(inventoryRecordMatch[1]) : null,
    listingsRecordId: listingsRecordMatch ? decodeURIComponent(listingsRecordMatch[1]) : null,
    soldReadyListingsRecordId: soldReadyListingsRecordMatch ? decodeURIComponent(soldReadyListingsRecordMatch[1]) : null,
    shopifyListingsRecordId: shopifyListingsRecordMatch ? decodeURIComponent(shopifyListingsRecordMatch[1]) : null,
    ebayListingsRecordId: ebayListingsRecordMatch ? decodeURIComponent(ebayListingsRecordMatch[1]) : null,
    userRecordId: userRecordMatch ? decodeURIComponent(userRecordMatch[1]) : null,
    activeTab,
    firstAccessibleTab,
  };
}