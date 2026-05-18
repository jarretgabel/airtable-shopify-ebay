import { Suspense, lazy, useDeferredValue } from 'react';
import {
  buildAirtableTabViewModel,
  buildApprovalTabViewModel,
  buildDashboardTabViewModel,
  buildEbayTabViewModel,
  buildJotformTabViewModel,
  buildMarketTabViewModel,
  buildShopifyTabViewModel,
  buildUsersTabViewModel,
} from '@/app/appTabContentMappers';
import type { AppTabContentProps } from '@/app/appTabContentTypes';
import { ErrorSurface } from '@/components/app/StateSurfaces';

const DashboardTab = lazy(async () => ({ default: (await import('@/components/DashboardTab')).DashboardTab }));
const ImageLab = lazy(async () => ({ default: (await import('@/components/ImageLab')).ImageLab }));
const WorkflowGuideTab = lazy(async () => ({ default: (await import('@/components/tabs/WorkflowGuideTab')).WorkflowGuideTab }));
const CombinedListingsApprovalTab = lazy(async () => ({ default: (await import('@/components/approval/CombinedListingsApprovalTab')).CombinedListingsApprovalTab }));
const EbayListingsDirectoryTab = lazy(async () => ({ default: (await import('@/components/approval/EbayListingsDirectoryTab')).EbayListingsDirectoryTab }));
const EbaySnapshotRecordPage = lazy(async () => ({ default: (await import('@/components/approval/EbaySnapshotRecordPage')).EbaySnapshotRecordPage }));
const NotificationsTab = lazy(async () => ({ default: (await import('@/components/NotificationsTab')).NotificationsTab }));
const SettingsTab = lazy(async () => ({ default: (await import('@/components/SettingsTab')).SettingsTab }));
const ShopifySnapshotRecordPage = lazy(async () => ({ default: (await import('@/components/approval/ShopifySnapshotRecordPage')).ShopifySnapshotRecordPage }));
const ShopifyListingsDirectoryTab = lazy(async () => ({ default: (await import('@/components/approval/ShopifyListingsDirectoryTab')).ShopifyListingsDirectoryTab }));
const UserManagementTab = lazy(async () => ({ default: (await import('@/components/UserManagementTab')).UserManagementTab }));
const AirtableTab = lazy(async () => ({ default: (await import('@/components/tabs/AirtableTab')).AirtableTab }));
const WorkflowSnapshotPage = lazy(async () => ({ default: (await import('@/components/tabs/WorkflowSnapshotPage')).WorkflowSnapshotPage }));
const InventoryPriceEditorPage = lazy(async () => ({ default: (await import('../components/tabs/InventoryPriceEditorPage')).InventoryPriceEditorPage }));
const ParkingLotOneTab = lazy(async () => ({ default: (await import('@/components/tabs/ParkingLotOneTab')).ParkingLotOneTab }));
const UsedGearPendingReviewGroupPage = lazy(async () => ({ default: (await import('../components/tabs/UsedGearPendingReviewGroupPage')).UsedGearPendingReviewGroupPage }));
const UsedGearPendingReviewRecordPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearPendingReviewRecordPage')).UsedGearPendingReviewRecordPage }));
const JotformTab = lazy(async () => ({ default: (await import('@/components/tabs/JotformTab')).JotformTab }));
const MarketTab = lazy(async () => ({ default: (await import('@/components/tabs/MarketTab')).MarketTab }));
const PhotosFormTab = lazy(async () => ({ default: (await import('@/components/tabs/PhotosFormTab')).PhotosFormTab }));
const TestingFormTab = lazy(async () => ({ default: (await import('@/components/tabs/TestingFormTab')).TestingFormTab }));
const UsedGearManualIntakePage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearManualIntakePage')).UsedGearManualIntakePage }));
const UsedGearLotTwoGroupPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearLotTwoGroupPage')).UsedGearLotTwoGroupPage }));
const UsedGearLotTwoRecordPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearLotTwoRecordPage')).UsedGearLotTwoRecordPage }));
const UsedGearLotTwoTab = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearLotTwoTab')).UsedGearLotTwoTab }));
const UsedGearTrashReviewRecordPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearTrashReviewRecordPage')).UsedGearTrashReviewRecordPage }));
const UsedGearTrashTab = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearTrashTab')).UsedGearTrashTab }));
const UsedGearWorkflowQueueTab = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearWorkflowQueueTab')).UsedGearWorkflowQueueTab }));
const PostPublishQueueTab = lazy(async () => ({ default: (await import('@/components/tabs/PostPublishQueueTab')).PostPublishQueueTab }));

function TabLoadingFallback({ tabLabel }: { tabLabel: string }) {
  return (
    <section className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-5 text-sm text-slate-300 shadow-[0_18px_40px_rgba(6,13,23,0.32)]">
      <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-400">Loading view</p>
      <p className="m-0 mt-2 text-base font-semibold text-slate-100">Preparing {tabLabel}</p>
      <div className="mt-4 space-y-3" aria-hidden="true">
        <div className="h-4 w-40 animate-pulse rounded-md bg-white/10" />
        <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-20 animate-pulse rounded-xl bg-white/5" />
          <div className="h-20 animate-pulse rounded-xl bg-white/5" />
        </div>
      </div>
    </section>
  );
}

function DashboardTabLoadingFallback() {
  const sectionPanelClass = 'rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]';

  return (
    <section className="flex flex-col gap-12 pt-1" aria-hidden="true">
      <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,17,28,0.94),rgba(7,17,28,0.82))] px-3 py-3 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-md">
        <div className="flex min-w-max items-center gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-11 w-28 animate-pulse rounded-full bg-white/8" />
          ))}
        </div>
      </div>
      <div className="rounded-[14px] border border-amber-400/20 bg-amber-500/8 px-4 py-4 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <div className="h-3 w-40 animate-pulse rounded-md bg-amber-200/15" />
        <div className="mt-3 h-4 w-[min(42rem,85%)] animate-pulse rounded-md bg-white/10" />
        <div className="mt-2 h-4 w-[min(32rem,70%)] animate-pulse rounded-md bg-white/10" />
      </div>
      <div className={sectionPanelClass}>
        <div className="mb-4 h-8 w-32 animate-pulse rounded-md bg-white/10" />
        <div className="space-y-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
          <div className="h-6 w-36 animate-pulse rounded-md bg-white/10" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-[14px] border border-[var(--line)] bg-white/5" />
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
          <div className="h-6 w-40 animate-pulse rounded-md bg-white/10" />
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-[12px] border border-[var(--line)] bg-white/5" />
          ))}
        </div>
        <div className="mt-4 space-y-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
          <div className="h-6 w-56 animate-pulse rounded-md bg-white/10" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-[12px] border border-[var(--line)] bg-white/5" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-[12px] border border-[var(--line)] bg-white/5" />
            ))}
          </div>
        </div>
      </div>
      <div className={sectionPanelClass}>
        <div className="mb-4 h-8 w-28 animate-pulse rounded-md bg-white/10" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-[14px] border border-[var(--line)] bg-white/5" />
          <div className="h-72 animate-pulse rounded-[14px] border border-[var(--line)] bg-white/5" />
        </div>
      </div>
      <div className={sectionPanelClass}>
        <div className="mb-4 h-8 w-24 animate-pulse rounded-md bg-white/10" />
        <div className="space-y-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
          <div className="h-6 w-44 animate-pulse rounded-md bg-white/10" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-[14px] border border-[var(--line)] bg-white/5" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-[18px] border border-[var(--line)] bg-white/5" />
        </div>
        <div className="mt-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
          <div className="h-6 w-48 animate-pulse rounded-md bg-white/10" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-6 animate-pulse rounded-md bg-white/5" />
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
          <div className="h-6 w-44 animate-pulse rounded-md bg-white/10" />
          <div className="mt-4 h-80 animate-pulse rounded-[14px] bg-white/5" />
        </div>
      </div>
      <div className={sectionPanelClass}>
        <div className="mb-4 h-8 w-24 animate-pulse rounded-md bg-white/10" />
        <div className="space-y-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-[12px] border border-[var(--line)] bg-white/5" />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-[16px] border border-[var(--line)] bg-white/5" />
            ))}
          </div>
        </div>
      </div>
      <div className={sectionPanelClass}>
        <div className="mb-4 h-8 w-20 animate-pulse rounded-md bg-white/10" />
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-[16px] border border-[var(--line)] bg-white/5" />
          ))}
        </div>
      </div>
      <div className={sectionPanelClass}>
        <div className="mb-4 h-8 w-24 animate-pulse rounded-md bg-white/10" />
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <div className="h-56 animate-pulse rounded-[16px] border border-[var(--line)] bg-white/5" />
        </div>
      </div>
    </section>
  );
}

function getTabLoadingLabel(tab: AppTabContentProps['activeTab']): string {
  switch (tab) {
    case 'dashboard':
      return 'dashboard';
    case 'workflow-guide':
      return 'user guide';
    case 'inventory':
      return 'inventory';
    case 'shopify':
      return 'Shopify';
    case 'ebay':
      return 'eBay';
    case 'parking-lot-1':
      return 'Parking Lot 1';
    case 'jotform':
      return 'JotForm';
    case 'parking-lot-2':
      return 'Parking Lot 2';
    case 'trash-review':
      return 'Trash Review';
    case 'testing-queue':
      return 'Testing queue';
    case 'photography-queue':
      return 'Photography queue';
    case 'post-publish':
      return 'post-publish';
    case 'market':
      return 'market research';
    case 'users':
      return 'user management';
    case 'settings':
      return 'settings';
    case 'notifications':
      return 'notifications';
    case 'manual-intake':
      return 'manual intake';
    case 'testing':
      return 'testing record';
    case 'photos':
      return 'photos record';
    case 'listings':
      return 'combined listings';
    default:
      return 'tab';
  }
}

function FeatureUnavailableTab({ title, message }: { title: string; message: string }) {
  return (
    <ErrorSurface title={title} message={message}>
      <p className="mt-2 text-sm text-[var(--muted)]">
        The rest of the app stays available while this feature is in degraded mode. Add the missing public runtime settings, then reload the page.
      </p>
    </ErrorSurface>
  );
}

export function AppTabContent({
  activeTab,
  manualIntakeMode,
  jotformReviewGroupId,
  jotformReviewRecordId,
  lotTwoReviewGroupId,
  lotTwoReviewRecordId,
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
  navigateToInventoryRecord,
  navigateToUsedGearOperationalRecord,
  navigateToInventoryList,
  navigateToInventoryWorkflowView,
  navigateToInventoryPostPublishBucket,
  navigateToManualIntake,
  navigateToManualIntakeForm,
  navigateToTestingForm,
  navigateToPhotosForm,
  navigateToListingsRecord,
  navigateToListingsList,
  navigateToShopifyList,
  navigateToShopifyRecord,
  navigateToEbayList,
  navigateToEbayRecord,
  navigateToUserRecord,
  navigateToUsersList,
  navigateToTab,
  runtimeFeatures,
  metrics,
  accessiblePages,
  currentUserRole,
  currentUserName,
  aiProvider,
  usersCount,
  adminCount,
  nonEmptyListings,
  airtableRefetch,
  atLoading,
  atError,
  products,
  storeDomain,
  spLoading,
  spError,
  jfSubmissions,
  jfLoading,
  jfPolling,
  jfError,
  jfRefetch,
  jfLastUpdated,
  jfFreshCount,
  jfClearFresh,
  approvalLoading,
  approvalError,
  approvalTotal,
  approvalApproved,
  approvalPending,
  shopifyApprovalLoading,
  shopifyApprovalError,
  shopifyApprovalTotal,
  shopifyApprovalApproved,
  shopifyApprovalPending,
  workflowDashboardTargets,
  workflowAnalytics,
  workflowPostPublishLoading,
  workflowPostPublishError,
  workflowActiveListingCount,
  workflowStaleListingCount,
  workflowStaleListingMineCount,
  workflowStaleListingUnassignedCount,
  workflowSoldReadyCount,
  workflowSoldReadyMineCount,
  workflowSoldReadyUnassignedCount,
  workflowShippedCount,
  ebayAuthenticated,
  ebayRestoringSession,
  ebayLoading,
  ebayError,
  ebayRuntimeConfig,
  ebayInventoryItems,
  ebayOffers,
  ebayRecentListings,
  ebayTotal,
  ebayPublishedCount,
  ebayDraftCount,
  ebayRefetch,
  sharkLoading,
  sharkError,
  sharkListings,
  sharkSearch,
  currentSlug,
  displayValue,
  hasValue,
  recordTitle,
}: AppTabContentProps) {
  const deferredRouteState = useDeferredValue({
    activeTab,
    manualIntakeMode,
    jotformReviewGroupId,
    jotformReviewRecordId,
    lotTwoReviewGroupId,
    lotTwoReviewRecordId,
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
  });
  const isRouteTransitionPending = deferredRouteState.activeTab !== activeTab
    || deferredRouteState.manualIntakeRecordId !== manualIntakeRecordId
    || deferredRouteState.jotformReviewGroupId !== jotformReviewGroupId
    || deferredRouteState.jotformReviewRecordId !== jotformReviewRecordId
    || deferredRouteState.lotTwoReviewGroupId !== lotTwoReviewGroupId
    || deferredRouteState.lotTwoReviewRecordId !== lotTwoReviewRecordId
    || deferredRouteState.trashReviewRecordId !== trashReviewRecordId
    || deferredRouteState.testingRecordId !== testingRecordId
    || deferredRouteState.photosRecordId !== photosRecordId
    || deferredRouteState.inventoryRecordId !== inventoryRecordId
    || deferredRouteState.inventoryPriceEditorRecordId !== inventoryPriceEditorRecordId
    || deferredRouteState.listingsRecordId !== listingsRecordId
    || deferredRouteState.shopifyListingsRecordId !== shopifyListingsRecordId
    || deferredRouteState.ebayListingsRecordId !== ebayListingsRecordId
    || deferredRouteState.userRecordId !== userRecordId;

  const ebayViewModel = buildEbayTabViewModel({
    ebayAuthenticated,
    ebayRestoringSession,
    ebayLoading,
    ebayError,
    ebayRuntimeConfig,
    ebayInventoryItems,
    ebayOffers,
    ebayRecentListings,
    ebayTotal,
    ebayRefetch,
    airtableRefetch,
    nonEmptyListings,
    runtimeFeatures,
  });

  const dashboardViewModel = buildDashboardTabViewModel({
    atLoading,
    atError,
    spLoading,
    spError,
    jfLoading,
    jfError,
    nonEmptyListings,
    products,
    jfSubmissions,
    metrics,
    accessiblePages,
    currentUserRole,
    currentUserName,
    approvalLoading,
    approvalError,
    approvalTotal,
    approvalApproved,
    approvalPending,
    shopifyApprovalLoading,
    shopifyApprovalError,
    shopifyApprovalTotal,
    shopifyApprovalApproved,
    shopifyApprovalPending,
    workflowDashboardTargets,
    workflowAnalytics,
    workflowPostPublishLoading,
    workflowPostPublishError,
    workflowActiveListingCount,
    workflowStaleListingCount,
    workflowStaleListingMineCount,
    workflowStaleListingUnassignedCount,
    workflowSoldReadyCount,
    workflowSoldReadyMineCount,
    workflowSoldReadyUnassignedCount,
    workflowShippedCount,
    aiProvider,
    ebayAuthenticated,
    ebayRestoringSession,
    ebayLoading,
    ebayError,
    ebayTotal,
    ebayPublishedCount,
    ebayDraftCount,
    sharkLoading,
    sharkError,
    currentSlug,
    sharkListings,
    usersCount,
    adminCount,
    runtimeFeatures,
    navigateToTab,
    navigateToInventoryWorkflowView,
    navigateToInventoryPostPublishBucket,
  });

  const airtableViewModel = buildAirtableTabViewModel({
    atLoading,
    atError,
    nonEmptyListings,
    displayValue,
    hasValue,
    recordTitle,
  });

  const shopifyViewModel = buildShopifyTabViewModel({
    spLoading,
    spError,
    products,
    nonEmptyListings,
    storeDomain,
  });

  const marketViewModel = buildMarketTabViewModel({
    sharkLoading,
    sharkError,
    sharkListings,
    currentSlug,
    sharkSearch,
  });

  const jotformViewModel = buildJotformTabViewModel({
    jfSubmissions,
    jfLoading,
    jfPolling,
    jfError,
    jfRefetch,
    jfLastUpdated,
    jfFreshCount,
    jfClearFresh,
  });

  const listingsViewModel = buildApprovalTabViewModel({
    approvalRecordId: listingsRecordId,
    navigateToApprovalRecord: navigateToListingsRecord,
    navigateToApprovalList: navigateToListingsList,
    navigateToOperationalRecord: navigateToUsedGearOperationalRecord,
    navigateToTestingForm,
    navigateToPhotosForm,
  });

  const usersViewModel = buildUsersTabViewModel({
    userRecordId,
    navigateToUserRecord,
    navigateToUsersList,
  });

  const renderActiveTab = () => {
    switch (deferredRouteState.activeTab) {
      case 'imagelab':
        return <ImageLab />;
      case 'listings':
        if (!runtimeFeatures.approvalCombined.available && runtimeFeatures.approvalCombined.message) {
          return <FeatureUnavailableTab title="Combined listings unavailable" message={runtimeFeatures.approvalCombined.message} />;
        }
        return <CombinedListingsApprovalTab viewModel={listingsViewModel} />;
      case 'ebay':
        if (deferredRouteState.ebayListingsRecordId) {
          return (
            <EbaySnapshotRecordPage
              recordId={deferredRouteState.ebayListingsRecordId}
              viewModel={ebayViewModel}
              onBackToSnapshot={() => navigateToEbayList()}
              onOpenListings={() => navigateToListingsList()}
              onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
            />
          );
        }
        return (
          <EbayListingsDirectoryTab
            ebayViewModel={ebayViewModel}
            onOpenSnapshotRecord={navigateToEbayRecord}
          />
        );
      case 'users':
        return <UserManagementTab viewModel={usersViewModel} />;
      case 'settings':
        return <SettingsTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'dashboard':
        return <DashboardTab viewModel={dashboardViewModel} />;
      case 'workflow-guide':
        return <WorkflowGuideTab currentUserRole={currentUserRole} currentUserName={currentUserName} accessiblePages={accessiblePages} />;
      case 'inventory':
        if (deferredRouteState.inventoryPriceEditorRecordId) {
          return (
            <InventoryPriceEditorPage
              recordId={deferredRouteState.inventoryPriceEditorRecordId}
              onBackToInventoryRecord={(recordId) => navigateToInventoryRecord(recordId)}
            />
          );
        }
        return deferredRouteState.inventoryRecordId
          ? (
            <WorkflowSnapshotPage
              recordId={deferredRouteState.inventoryRecordId}
              onBackToDirectory={() => navigateToInventoryList()}
              onOpenIntake={(recordId) => navigateToManualIntakeForm(recordId)}
              onOpenTesting={(recordId) => navigateToTestingForm(recordId)}
              onOpenPhotos={(recordId) => navigateToPhotosForm(recordId)}
              onOpenListings={(recordId) => navigateToListingsRecord(recordId)}
              onOpenPostPublish={(bucket) => navigateToInventoryPostPublishBucket(bucket)}
            />
          )
          : (
            <AirtableTab
              viewModel={airtableViewModel}
              currentUserRole={currentUserRole}
              currentUserName={currentUserName}
              onAddNewRecord={() => navigateToManualIntake()}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
              onOpenTestingForm={(recordId) => navigateToTestingForm(recordId)}
              onOpenPhotosForm={(recordId) => navigateToPhotosForm(recordId)}
              onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
              onOpenListingsRecord={(recordId) => navigateToListingsRecord(recordId)}
              onSelectRecord={(recordId) => navigateToInventoryRecord(recordId)}
            />
          );
      case 'post-publish':
        return (
          <PostPublishQueueTab
            currentUserName={currentUserName}
            onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
            onOpenListingsRecord={(recordId) => navigateToListingsRecord(recordId)}
          />
        );
      case 'shopify':
        if (deferredRouteState.shopifyListingsRecordId) {
          return (
            <ShopifySnapshotRecordPage
              productId={deferredRouteState.shopifyListingsRecordId}
              viewModel={shopifyViewModel}
              onBackToSnapshot={() => navigateToShopifyList()}
              onOpenListings={() => navigateToListingsList()}
              onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
            />
          );
        }
        return (
          <ShopifyListingsDirectoryTab
            shopifyViewModel={shopifyViewModel}
            onOpenSnapshotRecord={navigateToShopifyRecord}
          />
        );
      case 'market':
        return <MarketTab viewModel={marketViewModel} />;
      case 'manual-intake':
        return <UsedGearManualIntakePage recordId={deferredRouteState.manualIntakeRecordId} />;
      case 'testing':
        if (!deferredRouteState.testingRecordId) {
          return (
            <UsedGearWorkflowQueueTab
              queueMode="testing"
              currentUserName={currentUserName}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
              onOpenTestingForm={(recordId) => navigateToTestingForm(recordId)}
              onOpenPhotosForm={(recordId) => navigateToPhotosForm(recordId)}
              onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
              onOpenListingsRecord={(recordId) => navigateToListingsRecord(recordId)}
            />
          );
        }
        return <TestingFormTab recordId={deferredRouteState.testingRecordId} onBackToDirectory={() => navigateToTab('testing-queue')} />;
      case 'photos':
        if (!deferredRouteState.photosRecordId) {
          return (
            <UsedGearWorkflowQueueTab
              queueMode="photography"
              currentUserName={currentUserName}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
              onOpenTestingForm={(recordId) => navigateToTestingForm(recordId)}
              onOpenPhotosForm={(recordId) => navigateToPhotosForm(recordId)}
              onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
              onOpenListingsRecord={(recordId) => navigateToListingsRecord(recordId)}
            />
          );
        }
        return <PhotosFormTab recordId={deferredRouteState.photosRecordId} onBackToDirectory={() => navigateToTab('photography-queue')} />;
      case 'parking-lot-1':
        if (deferredRouteState.jotformReviewGroupId) {
          return (
            <UsedGearPendingReviewGroupPage
              currentUserName={currentUserName}
              groupId={deferredRouteState.jotformReviewGroupId}
              onBackToParkingLot={() => navigateToTab('parking-lot-1')}
              onOpenTrashReview={() => navigateToTab('trash-review')}
              onOpenManualIntake={(recordId: string) => navigateToManualIntakeForm(recordId)}
            />
          );
        }
        if (deferredRouteState.jotformReviewRecordId) {
          return (
            <UsedGearPendingReviewRecordPage
              currentUserName={currentUserName}
              recordId={deferredRouteState.jotformReviewRecordId}
              onOpenManualIntake={(recordId: string) => navigateToManualIntakeForm(recordId)}
            />
          );
        }
        return (
          <ParkingLotOneTab
            currentUserName={currentUserName}
          />
        );
      case 'jotform':
        if (!runtimeFeatures.jotform.available && runtimeFeatures.jotform.message) {
          return <FeatureUnavailableTab title="JotForm unavailable" message={runtimeFeatures.jotform.message} />;
        }
        return <JotformTab viewModel={jotformViewModel} />;
      case 'parking-lot-2':
        if (deferredRouteState.lotTwoReviewGroupId) {
          return (
            <UsedGearLotTwoGroupPage
              groupId={deferredRouteState.lotTwoReviewGroupId}
              onBackToParkingLot={() => navigateToTab('parking-lot-2')}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
              onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
            />
          );
        }
        if (deferredRouteState.lotTwoReviewRecordId) {
          return (
            <UsedGearLotTwoRecordPage
              currentUserName={currentUserName}
              recordId={deferredRouteState.lotTwoReviewRecordId}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
            />
          );
        }
        return (
          <UsedGearLotTwoTab
            currentUserName={currentUserName}
            onOpenReviewRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
          />
        );
      case 'trash-review':
        if (deferredRouteState.trashReviewRecordId) {
          return (
            <UsedGearTrashReviewRecordPage
              currentUserName={currentUserName}
              recordId={deferredRouteState.trashReviewRecordId}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
            />
          );
        }
        return <UsedGearTrashTab />;
      case 'testing-queue':
        return (
          <UsedGearWorkflowQueueTab
            queueMode="testing"
            currentUserName={currentUserName}
            onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
            onOpenTestingForm={(recordId) => navigateToTestingForm(recordId)}
            onOpenPhotosForm={(recordId) => navigateToPhotosForm(recordId)}
            onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
            onOpenListingsRecord={(recordId) => navigateToListingsRecord(recordId)}
          />
        );
      case 'photography-queue':
        return (
          <UsedGearWorkflowQueueTab
            queueMode="photography"
            currentUserName={currentUserName}
            onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
            onOpenTestingForm={(recordId) => navigateToTestingForm(recordId)}
            onOpenPhotosForm={(recordId) => navigateToPhotosForm(recordId)}
            onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
            onOpenListingsRecord={(recordId) => navigateToListingsRecord(recordId)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {isRouteTransitionPending && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-sky-300/30 bg-slate-950/80 px-3 py-1 text-[0.72rem] font-semibold tracking-[0.04em] text-sky-100 shadow-[0_10px_24px_rgba(6,13,23,0.28)]">
          Loading {getTabLoadingLabel(activeTab)}...
        </div>
      )}
      <div className={isRouteTransitionPending ? 'opacity-95 transition-opacity' : 'transition-opacity'} aria-busy={isRouteTransitionPending}>
        <Suspense fallback={deferredRouteState.activeTab === 'dashboard' ? <DashboardTabLoadingFallback /> : <TabLoadingFallback tabLabel={getTabLoadingLabel(deferredRouteState.activeTab)} />}>
          {renderActiveTab()}
        </Suspense>
      </div>
    </div>
  );
}
