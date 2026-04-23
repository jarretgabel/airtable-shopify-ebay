import type { Location } from 'react-router-dom';
import { type Tab, isTab } from '@/app/appNavigation';

interface AppRouteState {
  normalizedPath: string;
  isLoginPath: boolean;
  isResetPasswordPath: boolean;
  resetToken: string | null;
  incomingGearRecordId: string | null;
  testingRecordId: string | null;
  photosRecordId: string | null;
  inventoryRecordId: string | null;
  approvalRecordId: string | null;
  shopifyApprovalRecordId: string | null;
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
  const incomingGearRecordMatch = normalizedPath.match(/^\/incoming-gear\/([^/]+)$/);
  const testingRecordMatch = normalizedPath.match(/^\/testing\/([^/]+)$/);
  const photosRecordMatch = normalizedPath.match(/^\/photos\/([^/]+)$/);
  const inventoryRecordMatch = normalizedPath.match(/^\/inventory\/([^/]+)$/);
  const approvalRecordMatch = normalizedPath.match(/^\/ebay\/approval\/([^/]+)$/);
  const shopifyApprovalRecordMatch = normalizedPath.match(/^\/shopify\/approval\/([^/]+)$/);
  const listingsRecordMatch = normalizedPath.match(/^\/listings\/([^/]+)$/);
  const userRecordMatch = normalizedPath.match(/^\/account\/users\/([^/]+)$/);
  const firstAccessibleTab = (accessiblePages[0] ?? 'dashboard') as Tab;

  const activeTab: Tab = (() => {
    if (normalizedPath === '/ebay/approval' || approvalRecordMatch) return 'approval';
    if (normalizedPath === '/shopify/approval' || shopifyApprovalRecordMatch) return 'shopify-approval';
    if (normalizedPath === '/listings' || listingsRecordMatch) return 'listings';
    if (normalizedPath === '/ebay/listings') return 'ebay';
    if (normalizedPath === '/shopify/products') return 'shopify';
    if (normalizedPath === '/incoming-gear' || incomingGearRecordMatch) return 'incoming-gear';
    if (normalizedPath === '/testing' || testingRecordMatch) return 'testing';
    if (normalizedPath === '/photos' || photosRecordMatch) return 'photos';
    if (normalizedPath === '/inventory' || inventoryRecordMatch) return 'inventory';
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
    incomingGearRecordId: incomingGearRecordMatch ? decodeURIComponent(incomingGearRecordMatch[1]) : null,
    testingRecordId: testingRecordMatch ? decodeURIComponent(testingRecordMatch[1]) : null,
    photosRecordId: photosRecordMatch ? decodeURIComponent(photosRecordMatch[1]) : null,
    inventoryRecordId: inventoryRecordMatch ? decodeURIComponent(inventoryRecordMatch[1]) : null,
    approvalRecordId: approvalRecordMatch ? decodeURIComponent(approvalRecordMatch[1]) : null,
    shopifyApprovalRecordId: shopifyApprovalRecordMatch ? decodeURIComponent(shopifyApprovalRecordMatch[1]) : null,
    listingsRecordId: listingsRecordMatch ? decodeURIComponent(listingsRecordMatch[1]) : null,
    userRecordId: userRecordMatch ? decodeURIComponent(userRecordMatch[1]) : null,
    activeTab,
    firstAccessibleTab,
  };
}