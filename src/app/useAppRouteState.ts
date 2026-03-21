import type { Location } from 'react-router-dom';
import { type Tab, isTab } from '@/app/appNavigation';

interface AppRouteState {
  normalizedPath: string;
  isLoginPath: boolean;
  isResetPasswordPath: boolean;
  resetToken: string | null;
  approvalRecordId: string | null;
  shopifyApprovalRecordId: string | null;
  userRecordId: string | null;
  activeTab: Tab;
  firstAccessibleTab: Tab;
}

export function useAppRouteState(location: Location, accessiblePages: string[]): AppRouteState {
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isLoginPath = normalizedPath === '/login';
  const isResetPasswordPath = normalizedPath === '/reset-password';
  const resetToken = new URLSearchParams(location.search).get('token');
  const approvalRecordMatch = normalizedPath.match(/^\/ebay\/approval\/([^/]+)$/);
  const shopifyApprovalRecordMatch = normalizedPath.match(/^\/shopify\/approval\/([^/]+)$/);
  const userRecordMatch = normalizedPath.match(/^\/account\/users\/([^/]+)$/);
  const firstAccessibleTab = (accessiblePages[0] ?? 'dashboard') as Tab;

  const activeTab: Tab = (() => {
    if (normalizedPath === '/ebay/approval' || approvalRecordMatch) return 'approval';
    if (normalizedPath === '/shopify/approval' || shopifyApprovalRecordMatch) return 'shopify-approval';
    if (normalizedPath === '/ebay/listings') return 'ebay';
    if (normalizedPath === '/shopify/products') return 'shopify';
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
    approvalRecordId: approvalRecordMatch ? decodeURIComponent(approvalRecordMatch[1]) : null,
    shopifyApprovalRecordId: shopifyApprovalRecordMatch ? decodeURIComponent(shopifyApprovalRecordMatch[1]) : null,
    userRecordId: userRecordMatch ? decodeURIComponent(userRecordMatch[1]) : null,
    activeTab,
    firstAccessibleTab,
  };
}