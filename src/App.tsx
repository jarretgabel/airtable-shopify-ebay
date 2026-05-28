import { useEffect, useRef, useState } from 'react';
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
import { useUsedGearWorkflowNotifications } from '@/app/useUsedGearWorkflowNotifications';
import { isDeveloperRole } from '@/auth/roleAccess';
import { requireEnv } from '@/config/runtimeEnv';
import { getLocalAppApiRoutingWarning } from '@/services/app-api/flags';
import { createEmptyUsedGearWorkflowNotificationSummary } from '@/services/usedGearQueue';
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
    manualIntakeMode,
    jotformReviewGroupId,
    jotformReviewRecordId,
    parkingLotArrivalGroupId,
    parkingLotArrivalRecordId,
    trashReviewGroupId,
    trashReviewRecordId,
    manualIntakeRecordId,
    testingRecordId,
    photosRecordId,
    inventoryRecordId,
    inventoryPriceEditorRecordId,
    listingsRecordId,
    shopifyListingsRecordId,
    ebayListingsRecordId,
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
  const [workflowNotificationSummary, setWorkflowNotificationSummary] = useState(createEmptyUsedGearWorkflowNotificationSummary);
  const shellRef = useRef<HTMLElement>(null);
  const {
    navigateToTab,
    navigateToPath,
    navigateToInventorySection,
    navigateToParkingLotPendingReviewGroup,
    navigateToManualIntake,
    navigateToManualIntakeForm,
    navigateToTestingForm,
    navigateToPhotosForm,
    navigateToInventoryRecord,
    navigateToInventoryPriceEditor,
    navigateToUsedGearOperationalRecord,
    navigateToInventoryList,
    navigateToInventoryWorkflowView,
    navigateToInventoryPostPublishBucket,
    navigateToListingsRecord,
    navigateToListingsList,
    navigateToShopifyRecord,
    navigateToShopifyList,
    navigateToEbayRecord,
    navigateToEbayList,
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
  const appDataEnabled = usersReady && Boolean(currentUser) && !isLoginPath && !isResetPasswordPath;
  const { airtable, shopify, market, ebay, approval, shopifyApproval, combinedListingsReadyForPublishing, usedGearWorkflowDashboardTargets, usedGearWorkflowAnalytics, usedGearWorkflowPostPublish, jotform, metrics, visibleTabs, aiProvider, adminCount, runtimeFeatures } = useAppData({
    enabled: appDataEnabled,
    activeTab,
    canAccessPage,
    currentUserName: currentUser?.name ?? '',
    users,
  });
  const { onRefresh, onExportCurrentPage, onExportAllPages, tabs, intakeNavTabs, listingsNavTabs, postPublishNavTabs, inventoryProcessingNavTabs, postEbayNavTabs, utilityNavTabs } = useAppShellControls({
    activeTab,
    visibleTabs,
    workflowInventoryBadgeCount: workflowNotificationSummary.workflowQueueBadgeCount,
    listingsBadgeCount: combinedListingsReadyForPublishing.count,
    runtimeFeatures,
    exportingPdf,
    dashboardRefreshing,
    setExportingPdf,
    setDashboardRefreshing,
    setExportProgress,
    canAccessPage: canAccessPage as (tab: Tab) => boolean,
    shellRef,
    navigateToTab,
    navigateToUsersList,
    airtableRefetch: airtable.refetch,
    shopifyRefetch: shopify.refetch,
    jotformRefetch: jotform.refetch,
    ebayRefetch: ebay.refetch,
    approvalRefetch: approval.refetch,
    shopifyApprovalRefetch: shopifyApproval.refetch,
    usedGearWorkflowAnalyticsRefetch: usedGearWorkflowAnalytics.refetch,
    usedGearWorkflowPostPublishRefetch: usedGearWorkflowPostPublish.refetch,
    sharkSearch: market.search,
    currentSlug: market.currentSlug,
    atLoading: airtable.loading,
    spLoading: shopify.loading,
    jfLoading: jotform.loading,
  });

  useActionGuidanceNotifications({
    canAccessPage: canAccessPage as (tab: Tab) => boolean,
    navigateToTab,
    navigateToInventoryPostPublishBucket,
    onRefresh,
    approvalPending: approval.pending,
    shopifyApprovalPending: shopifyApproval.pending,
    ebayAuthenticated: ebay.authenticated,
    workflowPostPublishStaleListingCount: usedGearWorkflowPostPublish.staleListingCount,
    workflowPostPublishSoldReadyCount: usedGearWorkflowPostPublish.soldReadyCount,
    atError: airtable.error,
    workflowError: usedGearWorkflowPostPublish.error,
    spError: shopify.error,
    jfError: jotform.error,
    ebayError: ebay.error,
  });

  useUsedGearWorkflowNotifications({
    currentUser,
    canAccessPage: canAccessPage as (tab: Tab) => boolean,
    navigateToTab,
    navigateToPath,
    navigateToInventorySection,
    navigateToUsedGearOperationalRecord,
    navigateToListingsRecord,
    enabled: appDataEnabled,
    onSummaryChange: setWorkflowNotificationSummary,
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
  const localApiRoutingWarning = import.meta.env.DEV && isDeveloperRole(currentUser.role)
    ? getLocalAppApiRoutingWarning()
    : null;

  return (
    <>
      <div aria-hidden={showRequiredPasswordModal} className={showRequiredPasswordModal ? 'pointer-events-none select-none blur-[1.5px]' : ''}>
        <AppFrame
          shellRef={shellRef}
          currentUserLabel={`${currentUser.name} · ${currentUser.role}`}
          tabs={tabs}
          intakeTabs={intakeNavTabs}
          listingsTabs={listingsNavTabs}
              postPublishTabs={postPublishNavTabs}
          inventoryProcessingTabs={inventoryProcessingNavTabs}
          postEbayTabs={postEbayNavTabs}
          utilityTabs={utilityNavTabs}
          exportDisabled={exportingPdf}
          onExportCurrentPage={onExportCurrentPage}
          onExportAllPages={onExportAllPages}
          onOpenNotifications={() => navigateToTab('notifications')}
          onOpenSettings={() => navigate('/account/settings')}
          onOpenUserManagement={() => navigateToTab('users')}
          canManageUsers={currentUser.role === 'admin' || currentUser.role === 'owner'}
          onLogout={handleLogout}
          exportProgress={exportingPdf ? exportProgress : null}
          exporting={exportingPdf}
        >
          {localApiRoutingWarning && (
            <section className="mb-5 rounded-[1.15rem] border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-amber-100 shadow-[0_14px_34px_rgba(120,53,15,0.18)]">
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-amber-200/85">Local API override active</p>
              <p className="mt-2 text-sm leading-6 text-amber-50">
                Localhost is pinned to the local app API and Lambda handlers on /api, so the configured remote API base URL is being ignored in this session.
              </p>
              <p className="mt-2 text-xs leading-5 text-amber-200/80">
                Configured value: {localApiRoutingWarning.configuredBaseUrl}
              </p>
            </section>
          )}
          <AppTabContent
            activeTab={activeTab}
            manualIntakeMode={manualIntakeMode}
            jotformReviewGroupId={jotformReviewGroupId}
            jotformReviewRecordId={jotformReviewRecordId}
            parkingLotArrivalGroupId={parkingLotArrivalGroupId}
            parkingLotArrivalRecordId={parkingLotArrivalRecordId}
            trashReviewGroupId={trashReviewGroupId}
            trashReviewRecordId={trashReviewRecordId}
            manualIntakeRecordId={manualIntakeRecordId}
            testingRecordId={testingRecordId}
            photosRecordId={photosRecordId}
            inventoryRecordId={inventoryRecordId}
            inventoryPriceEditorRecordId={inventoryPriceEditorRecordId}
            listingsRecordId={listingsRecordId}
            shopifyListingsRecordId={shopifyListingsRecordId}
            ebayListingsRecordId={ebayListingsRecordId}
            userRecordId={userRecordId}
            navigateToInventoryRecord={navigateToInventoryRecord}
            navigateToInventoryPriceEditor={navigateToInventoryPriceEditor}
            navigateToUsedGearOperationalRecord={navigateToUsedGearOperationalRecord}
            navigateToInventoryList={navigateToInventoryList}
            navigateToInventoryWorkflowView={navigateToInventoryWorkflowView}
            navigateToInventoryPostPublishBucket={navigateToInventoryPostPublishBucket}
            navigateToManualIntake={navigateToManualIntake}
            navigateToManualIntakeForm={navigateToManualIntakeForm}
            navigateToTestingForm={navigateToTestingForm}
            navigateToPhotosForm={navigateToPhotosForm}
            navigateToListingsRecord={navigateToListingsRecord}
            navigateToListingsList={navigateToListingsList}
            navigateToShopifyRecord={navigateToShopifyRecord}
            navigateToShopifyList={navigateToShopifyList}
            navigateToEbayRecord={navigateToEbayRecord}
            navigateToEbayList={navigateToEbayList}
            navigateToUserRecord={navigateToUserRecord}
            navigateToUsersList={navigateToUsersList}
            navigateToTab={navigateToTab}
            navigateToParkingLotPendingReviewGroup={navigateToParkingLotPendingReviewGroup}
            runtimeFeatures={runtimeFeatures}
            metrics={metrics}
            accessiblePages={accessiblePages as Tab[]}
            currentUserRole={currentUser.role}
            currentUserName={currentUser.name}
            aiProvider={aiProvider}
            usersCount={users.length}
            adminCount={adminCount}
            nonEmptyListings={airtable.nonEmptyListings}
            displayValue={displayValue}
            hasValue={hasValue}
            recordTitle={recordTitle}
            airtableRefetch={airtable.refetch}
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
            workflowDashboardTargets={usedGearWorkflowDashboardTargets}
            workflowAnalytics={usedGearWorkflowAnalytics}
            workflowPostPublishLoading={usedGearWorkflowPostPublish.loading}
            workflowPostPublishError={usedGearWorkflowPostPublish.error}
            workflowActiveListingCount={usedGearWorkflowPostPublish.activeListingCount}
            workflowStaleListingCount={usedGearWorkflowPostPublish.staleListingCount}
            workflowStaleListingMineCount={usedGearWorkflowPostPublish.staleListingMineCount}
            workflowStaleListingUnassignedCount={usedGearWorkflowPostPublish.staleListingUnassignedCount}
            workflowSoldReadyCount={usedGearWorkflowPostPublish.soldReadyCount}
            workflowSoldReadyMineCount={usedGearWorkflowPostPublish.soldReadyMineCount}
            workflowSoldReadyUnassignedCount={usedGearWorkflowPostPublish.soldReadyUnassignedCount}
            workflowShippedCount={usedGearWorkflowPostPublish.shippedCount}
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
