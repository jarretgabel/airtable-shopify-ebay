import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppTabContent } from '@/app/AppTabContent';
import { displayValue, hasValue, recordTitle, type Tab } from '@/app/appNavigation';
import { AppFrame } from '@/components/app/AppFrame';
import { RequiredPasswordChangeModal } from '@/components/auth/RequiredPasswordChangeModal';
import { LoginScreen } from '@/components/LoginScreen';
import { ResetPasswordScreen } from '@/components/ResetPasswordScreen';
import { useAppData } from '@/app/useAppData';
import { useAuthSession } from '@/app/useAuthSession';
import { useAppNavigationHandlers } from '@/app/useAppNavigationHandlers';
import { useAppRouteState } from '@/app/useAppRouteState';
import { useAppShellControls } from '@/app/useAppShellControls';
import { useActionGuidanceNotifications } from '@/app/useActionGuidanceNotifications';
import { useAuthRouteGuard } from '@/app/useAuthRouteGuard';
import { requireEnv } from '@/config/runtimeEnv';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import { useAppUIStore } from '@/stores/appUIStore';
import { useAuthStore } from '@/stores/auth/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

function App() {
  const shopifyStoreDomain = requireEnv('VITE_SHOPIFY_STORE_DOMAIN');
  const navigate = useNavigate();
  const location = useLocation();
  const { users, usersLoading, usersReady, currentUser, requiresPasswordChange, accessiblePages, canAccessPage, logout } = useAuthSession();
  const {
    normalizedPath,
    isLoginPath,
    isResetPasswordPath,
    resetToken,
    incomingGearRecordId,
    testingRecordId,
    photosRecordId,
    inventoryRecordId,
    listingsRecordId,
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
  const completeRequiredPasswordChange = useAuthStore((state) => state.completeRequiredPasswordChange);
  const clearNotifications = useNotificationStore((state) => state.clear);
  const applyCurrentUserPreferences = useNotificationStore((state) => state.applyCurrentUserPreferences);
  const shellRef = useRef<HTMLElement>(null);
  const {
    navigateToTab,
    navigateToIncomingGearForm,
    navigateToTestingForm,
    navigateToPhotosForm,
    navigateToInventoryRecord,
    navigateToInventoryList,
    navigateToListingsRecord,
    navigateToListingsList,
    navigateToApprovalRecord,
    navigateToApprovalList,
    navigateToShopifyApprovalRecord,
    navigateToShopifyApprovalList,
    navigateToUserRecord,
    navigateToUsersList,
    handleLogout,
  } = useAppNavigationHandlers(navigate, logout);

  useAuthRouteGuard({
    authReady: usersReady,
    currentUser,
    requiresPasswordChange,
    isLoginPath,
    isResetPasswordPath,
    normalizedPath,
    firstAccessibleTab,
    canAccessPage,
    navigate,
  });
  const { airtable, shopify, market, ebay, approval, shopifyApproval, jotform, metrics, visibleTabs, totalNewSubmissions, aiProvider, adminCount, runtimeFeatures } = useAppData({
    activeTab,
    canAccessPage,
    users,
  });
  const { loading, onRefresh, onExportCurrentPage, onExportAllPages, tabs, ebayNavTabs, inventoryProcessingNavTabs, shopifyNavTabs, postEbayNavTabs, utilityNavTabs } = useAppShellControls({
    activeTab,
    visibleTabs,
    approvalPending: approval.pending,
    shopifyApprovalPending: shopifyApproval.pending,
    totalNewSubmissions,
    runtimeFeatures,
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

  useEffect(() => {
    if (!currentUser) return;
    trackWorkflowEvent('tab_viewed', {
      tab: activeTab,
      userId: currentUser.id,
      role: currentUser.role,
    });
  }, [activeTab, currentUser]);

  if (!usersReady) {
    return (
      <main className="min-h-screen px-5 py-8 text-slate-100">
        <section className="mx-auto w-full max-w-xl rounded-[1.4rem] border border-white/15 bg-slate-950/70 p-6 shadow-[0_24px_48px_rgba(6,13,23,0.45)] backdrop-blur">
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200/80">Listing Control Center</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Loading users</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {usersLoading ? 'Syncing account access from Airtable...' : 'Preparing account access...'}
          </p>
        </section>
      </main>
    );
  }

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

  const showRequiredPasswordModal = requiresPasswordChange;

  return (
    <>
      <div aria-hidden={showRequiredPasswordModal} className={showRequiredPasswordModal ? 'pointer-events-none select-none blur-[1.5px]' : ''}>
        <AppFrame
          shellRef={shellRef}
          currentUserLabel={`${currentUser.name} · ${currentUser.role}`}
          tabs={tabs}
          ebayTabs={ebayNavTabs}
          inventoryProcessingTabs={inventoryProcessingNavTabs}
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
            incomingGearRecordId={incomingGearRecordId}
            testingRecordId={testingRecordId}
            photosRecordId={photosRecordId}
            inventoryRecordId={inventoryRecordId}
            listingsRecordId={listingsRecordId}
            approvalRecordId={approvalRecordId}
            shopifyApprovalRecordId={shopifyApprovalRecordId}
            userRecordId={userRecordId}
            navigateToInventoryRecord={navigateToInventoryRecord}
            navigateToInventoryList={navigateToInventoryList}
            navigateToIncomingGearForm={navigateToIncomingGearForm}
            navigateToTestingForm={navigateToTestingForm}
            navigateToPhotosForm={navigateToPhotosForm}
            navigateToListingsRecord={navigateToListingsRecord}
            navigateToListingsList={navigateToListingsList}
            navigateToApprovalRecord={navigateToApprovalRecord}
            navigateToApprovalList={navigateToApprovalList}
            navigateToShopifyApprovalRecord={navigateToShopifyApprovalRecord}
            navigateToShopifyApprovalList={navigateToShopifyApprovalList}
            navigateToUserRecord={navigateToUserRecord}
            navigateToUsersList={navigateToUsersList}
            navigateToTab={navigateToTab}
            runtimeFeatures={runtimeFeatures}
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
            storeDomain={shopifyStoreDomain}
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
            ebayRuntimeConfig={ebay.runtimeConfig}
            ebayInventoryItems={ebay.inventoryItems}
            ebayOffers={ebay.offers}
            ebayRecentListings={ebay.recentListings}
            ebayTotal={ebay.total}
            ebayPublishedCount={ebay.publishedCount}
            ebayDraftCount={ebay.draftCount}
            ebayRefetch={ebay.refetch}
            sharkLoading={market.loading}
            sharkError={market.error}
            sharkListings={market.listings}
            sharkSearch={market.search}
            currentSlug={market.currentSlug}
          />
        </AppFrame>
      </div>

      {showRequiredPasswordModal && (
        <RequiredPasswordChangeModal
          userName={currentUser.name}
          onSubmit={completeRequiredPasswordChange}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

export default App;
