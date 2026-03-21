import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppTabContent } from '@/app/AppTabContent';
import { displayValue, hasValue, recordTitle, type Tab } from '@/app/appNavigation';
import { AppFrame } from '@/components/app/AppFrame';
import { LoginScreen } from '@/components/LoginScreen';
import { ResetPasswordScreen } from '@/components/ResetPasswordScreen';
import { useAppData } from '@/app/useAppData';
import { useAuthSession } from '@/app/useAuthSession';
import { useAppNavigationHandlers } from '@/app/useAppNavigationHandlers';
import { useAppRouteState } from '@/app/useAppRouteState';
import { useAppShellControls } from '@/app/useAppShellControls';
import { useActionGuidanceNotifications } from '@/app/useActionGuidanceNotifications';
import { useAuthRouteGuard } from '@/app/useAuthRouteGuard';
import { useAppUIStore } from '@/stores/appUIStore';
import { useNotificationStore } from '@/stores/notificationStore';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { users, currentUser, accessiblePages, canAccessPage, logout } = useAuthSession();
  const {
    normalizedPath,
    isLoginPath,
    isResetPasswordPath,
    resetToken,
    approvalRecordId,
    shopifyApprovalRecordId,
    userRecordId,
    activeTab,
    firstAccessibleTab,
  } = useAppRouteState(location, accessiblePages);

  const exportingPdf = useAppUIStore((s) => s.exportingPdf);
  const dashboardRefreshing = useAppUIStore((s) => s.dashboardRefreshing);
  const exportProgress = useAppUIStore((s) => s.exportProgress);
  const setExportingPdf = useAppUIStore((s) => s.setExportingPdf);
  const setDashboardRefreshing = useAppUIStore((s) => s.setDashboardRefreshing);
  const setExportProgress = useAppUIStore((s) => s.setExportProgress);
  const clearNotifications = useNotificationStore((state) => state.clear);
  const applyCurrentUserPreferences = useNotificationStore((state) => state.applyCurrentUserPreferences);
  const shellRef = useRef<HTMLElement>(null);
  const {
    navigateToTab,
    navigateToApprovalRecord,
    navigateToApprovalList,
    navigateToShopifyApprovalRecord,
    navigateToShopifyApprovalList,
    navigateToUserRecord,
    navigateToUsersList,
    handleLogout,
  } = useAppNavigationHandlers(navigate, logout);

  useAuthRouteGuard({
    currentUser,
    isLoginPath,
    isResetPasswordPath,
    normalizedPath,
    firstAccessibleTab,
    canAccessPage,
    navigate,
  });
  const { airtable, shopify, market, ebay, approval, shopifyApproval, jotform, metrics, visibleTabs, totalNewSubmissions, aiProvider, adminCount } = useAppData({
    canAccessPage,
    users,
  });
  const { loading, onRefresh, onExportCurrentPage, onExportAllPages, tabs, ebayNavTabs, shopifyNavTabs, postEbayNavTabs, utilityNavTabs } = useAppShellControls({
    activeTab,
    visibleTabs,
    approvalPending: approval.pending,
    shopifyApprovalPending: shopifyApproval.pending,
    totalNewSubmissions,
    exportingPdf,
    dashboardRefreshing,
    setExportingPdf,
    setDashboardRefreshing,
    setExportProgress,
    canAccessPage: canAccessPage as (tab: Tab) => boolean,
    shellRef,
    navigateToTab,
    navigateToApprovalList,
    navigateToUsersList,
    airtableRefetch: airtable.refetch,
    shopifyRefetch: shopify.refetch,
    jotformRefetch: jotform.refetch,
    ebayRefetch: ebay.refetch,
    approvalRefetch: approval.refetch,
    shopifyApprovalRefetch: shopifyApproval.refetch,
    sharkSearch: market.search,
    currentSlug: market.currentSlug,
    atLoading: airtable.loading,
    spLoading: shopify.loading,
    jfLoading: jotform.loading,
  });

  useActionGuidanceNotifications({
    canAccessPage: canAccessPage as (tab: Tab) => boolean,
    navigateToTab,
    onRefresh,
    approvalPending: approval.pending,
    shopifyApprovalPending: shopifyApproval.pending,
    totalNewSubmissions,
    ebayAuthenticated: ebay.authenticated,
    atError: airtable.error,
    spError: shopify.error,
    jfError: jotform.error,
    ebayError: ebay.error,
  });

  useEffect(() => {
    clearNotifications();
    applyCurrentUserPreferences();
  }, [applyCurrentUserPreferences, clearNotifications, currentUser?.id]);

  if (!currentUser && isResetPasswordPath) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onResetSuccess={() => navigate('/login', { replace: true })}
        onBackToLogin={() => navigate('/login', { replace: true })}
      />
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoggedIn={() => navigate('/dashboard', { replace: true })} />;
  }

  return (
    <AppFrame
      shellRef={shellRef}
      currentUserLabel={`${currentUser.name} · ${currentUser.role}`}
      tabs={tabs}
      ebayTabs={ebayNavTabs}
      shopifyTabs={shopifyNavTabs}
      postEbayTabs={postEbayNavTabs}
      utilityTabs={utilityNavTabs}
      refreshLabel={loading ? 'Refreshing...' : 'Refresh'}
      refreshDisabled={loading || exportingPdf}
      onRefresh={onRefresh}
      exportDisabled={exportingPdf}
      onExportCurrentPage={onExportCurrentPage}
      onExportAllPages={onExportAllPages}
      onOpenNotifications={() => navigateToTab('notifications')}
      onOpenSettings={() => navigate('/account/settings')}
      onOpenUserManagement={() => navigateToTab('users')}
      canManageUsers={currentUser.role === 'admin'}
      onLogout={handleLogout}
      exportProgress={exportingPdf ? exportProgress : null}
      exporting={exportingPdf}
    >
      <AppTabContent
        activeTab={activeTab}
        approvalRecordId={approvalRecordId}
        shopifyApprovalRecordId={shopifyApprovalRecordId}
        userRecordId={userRecordId}
        navigateToApprovalRecord={navigateToApprovalRecord}
        navigateToApprovalList={navigateToApprovalList}
        navigateToShopifyApprovalRecord={navigateToShopifyApprovalRecord}
        navigateToShopifyApprovalList={navigateToShopifyApprovalList}
        navigateToUserRecord={navigateToUserRecord}
        navigateToUsersList={navigateToUsersList}
        navigateToTab={navigateToTab}
        metrics={metrics}
        accessiblePages={accessiblePages as Tab[]}
        aiProvider={aiProvider}
        usersCount={users.length}
        adminCount={adminCount}
        nonEmptyListings={airtable.nonEmptyListings}
        displayValue={displayValue}
        hasValue={hasValue}
        recordTitle={recordTitle}
        atLoading={airtable.loading}
        atError={airtable.error}
        products={shopify.products}
        storeDomain={import.meta.env.VITE_SHOPIFY_STORE_DOMAIN}
        spLoading={shopify.loading}
        spError={shopify.error}
        jfSubmissions={jotform.submissions}
        jfLoading={jotform.loading}
        jfPolling={jotform.polling}
        jfError={jotform.error}
        jfRefetch={jotform.refetch}
        jfLastUpdated={jotform.lastUpdated}
        jfFreshCount={jotform.freshCount}
        jfClearFresh={jotform.clearFresh}
        totalNewSubmissions={totalNewSubmissions}
        approvalLoading={approval.loading}
        approvalError={approval.error}
        approvalTotal={approval.total}
        approvalApproved={approval.approved}
        approvalPending={approval.pending}
        shopifyApprovalLoading={shopifyApproval.loading}
        shopifyApprovalError={shopifyApproval.error}
        shopifyApprovalTotal={shopifyApproval.total}
        shopifyApprovalApproved={shopifyApproval.approved}
        shopifyApprovalPending={shopifyApproval.pending}
        ebayAuthenticated={ebay.authenticated}
        ebayRestoringSession={ebay.restoringSession}
        ebayLoading={ebay.loading}
        ebayError={ebay.error}
        ebayInventoryItems={ebay.inventoryItems}
        ebayOffers={ebay.offers}
        ebayRecentListings={ebay.recentListings}
        ebayTotal={ebay.total}
        ebayPublishedCount={ebay.publishedCount}
        ebayDraftCount={ebay.draftCount}
        ebayRefetch={ebay.refetch}
        ebayDisconnect={ebay.disconnect}
        sharkLoading={market.loading}
        sharkError={market.error}
        sharkListings={market.listings}
        sharkSearch={market.search}
        currentSlug={market.currentSlug}
      />
    </AppFrame>
  );
}

export default App;
