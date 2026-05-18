import type { Location } from 'react-router-dom';
import { type Tab, isTab } from '@/app/appNavigation';

interface AppRouteState {
  normalizedPath: string;
  isLoginPath: boolean;
  isResetPasswordPath: boolean;
  resetToken: string | null;
  manualIntakeMode: boolean;
  jotformReviewGroupId: string | null;
  jotformReviewRecordId: string | null;
  lotTwoReviewGroupId: string | null;
  trashReviewRecordId: string | null;
  manualIntakeRecordId: string | null;
  testingRecordId: string | null;
  photosRecordId: string | null;
  inventoryRecordId: string | null;
  inventoryPriceEditorRecordId: string | null;
  listingsRecordId: string | null;
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
  const intakeRecordMatch = normalizedPath.match(/^\/intake\/([^/]+)$/);
  const manualIntakeMode = normalizedPath === '/manual-intake' || Boolean(manualIntakeRecordMatch) || Boolean(intakeRecordMatch);
  const jotformReviewGroupMatch = normalizedPath.match(/^\/parking-lot-1\/review\/([^/]+)$/);
  const jotformReviewRecordMatch = normalizedPath.match(/^\/parking-lot-1\/review-record\/([^/]+)$/);
  const lotTwoReviewGroupMatch = normalizedPath.match(/^\/parking-lot-2\/review\/([^/]+)$/);
  const trashReviewRecordMatch = normalizedPath.match(/^\/trash-review\/review\/([^/]+)$/);
  const testingRecordMatch = normalizedPath.match(/^\/testing\/([^/]+)$/);
  const photosRecordMatch = normalizedPath.match(/^\/photos\/([^/]+)$/);
  const inventoryPriceEditorRecordMatch = normalizedPath.match(/^\/workflow-hub\/price\/([^/]+)$/);
  const inventoryRecordMatch = manualIntakeMode ? null : normalizedPath.match(/^\/workflow-hub\/(?!price\/)([^/]+)$/);
  const ebayListingsRecordMatch = normalizedPath.match(/^\/ebay\/listings\/([^/]+)$/);
  const shopifyListingsRecordMatch = normalizedPath.match(/^\/shopify\/products\/([^/]+)$/);
  const listingsRecordMatch = normalizedPath.match(/^\/listings\/([^/]+)$/);
  const userRecordMatch = normalizedPath.match(/^\/account\/users\/([^/]+)$/);
  const firstAccessibleTab = (accessiblePages[0] ?? 'dashboard') as Tab;

  const activeTab: Tab = (() => {
    if (normalizedPath === '/listings' || listingsRecordMatch) return 'listings';
    if (normalizedPath === '/workflow/post-publish') return 'post-publish';
    if (normalizedPath === '/ebay/listings' || ebayListingsRecordMatch) return 'ebay';
    if (normalizedPath === '/shopify/products' || shopifyListingsRecordMatch) return 'shopify';
    if (normalizedPath === '/parking-lot-1' || jotformReviewGroupMatch || jotformReviewRecordMatch) return 'parking-lot-1';
    if (normalizedPath === '/parking-lot-2' || lotTwoReviewGroupMatch) return 'parking-lot-2';
    if (normalizedPath === '/trash-review' || trashReviewRecordMatch) return 'trash-review';
    if (normalizedPath === '/workflow/testing') return 'testing-queue';
    if (normalizedPath === '/workflow/photography') return 'photography-queue';
    if (manualIntakeMode) return 'manual-intake';
    if (normalizedPath === '/testing' || testingRecordMatch) return 'testing';
    if (normalizedPath === '/photos' || photosRecordMatch) return 'photos';
    if (normalizedPath === '/workflow-hub' || inventoryPriceEditorRecordMatch || inventoryRecordMatch) return 'inventory';
    if (normalizedPath === '/account/users' || userRecordMatch) return 'users';
    if (normalizedPath === '/account/settings') return 'settings';
    if (normalizedPath === '/account/notifications') return 'notifications';
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
    lotTwoReviewGroupId: lotTwoReviewGroupMatch ? decodeURIComponent(lotTwoReviewGroupMatch[1]) : null,
    trashReviewRecordId: trashReviewRecordMatch ? decodeURIComponent(trashReviewRecordMatch[1]) : null,
    manualIntakeRecordId: manualIntakeRecordMatch
      ? decodeURIComponent(manualIntakeRecordMatch[1])
      : intakeRecordMatch
        ? decodeURIComponent(intakeRecordMatch[1])
        : null,
    testingRecordId: testingRecordMatch ? decodeURIComponent(testingRecordMatch[1]) : null,
    photosRecordId: photosRecordMatch ? decodeURIComponent(photosRecordMatch[1]) : null,
    inventoryPriceEditorRecordId: inventoryPriceEditorRecordMatch ? decodeURIComponent(inventoryPriceEditorRecordMatch[1]) : null,
    inventoryRecordId: inventoryRecordMatch ? decodeURIComponent(inventoryRecordMatch[1]) : null,
    listingsRecordId: listingsRecordMatch ? decodeURIComponent(listingsRecordMatch[1]) : null,
    shopifyListingsRecordId: shopifyListingsRecordMatch ? decodeURIComponent(shopifyListingsRecordMatch[1]) : null,
    ebayListingsRecordId: ebayListingsRecordMatch ? decodeURIComponent(ebayListingsRecordMatch[1]) : null,
    userRecordId: userRecordMatch ? decodeURIComponent(userRecordMatch[1]) : null,
    activeTab,
    firstAccessibleTab,
  };
}