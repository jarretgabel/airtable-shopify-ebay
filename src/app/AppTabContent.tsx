import { LoadingSurface } from '@/components/app/StateSurfaces';
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
import { PageSubNavContext } from '@/components/app/AppPageHeader';

const DashboardTab = lazy(async () => ({ default: (await import('@/components/DashboardTab')).DashboardTab }));
const IssuesTab = lazy(async () => ({ default: (await import('@/components/IssuesTab')).IssuesTab }));
const AssistantInsightsTab = lazy(async () => ({ default: (await import('@/components/AssistantInsightsTab')).AssistantInsightsTab }));
const SeoTab = lazy(async () => ({ default: (await import('@/components/SeoTab')).SeoTab }));
const SalesTab = lazy(async () => ({ default: (await import('@/components/SalesTab')).SalesTab }));
const PeopleTab = lazy(async () => ({ default: (await import('@/components/PeopleTab')).PeopleTab }));
const ImageLab = lazy(async () => ({ default: (await import('@/components/ImageLab')).ImageLab }));
const WorkflowGuideTab = lazy(async () => ({ default: (await import('@/components/tabs/WorkflowGuideTab')).WorkflowGuideTab }));
const WorkflowGuideEditorTab = lazy(async () => ({ default: (await import('@/components/tabs/WorkflowGuideEditorTab')).WorkflowGuideEditorTab }));
const CombinedListingsApprovalTab = lazy(async () => ({ default: (await import('@/components/approval/CombinedListingsApprovalTab')).CombinedListingsApprovalTab }));
const EbayListingsDirectoryTab = lazy(async () => ({ default: (await import('@/components/approval/EbayListingsDirectoryTab')).EbayListingsDirectoryTab }));
const EbaySnapshotRecordPage = lazy(async () => ({ default: (await import('@/components/approval/EbaySnapshotRecordPage')).EbaySnapshotRecordPage }));
const NotificationsTab = lazy(async () => ({ default: (await import('@/components/NotificationsTab')).NotificationsTab }));
const SettingsTab = lazy(async () => ({ default: (await import('@/components/SettingsTab')).SettingsTab }));
const ShopifySnapshotRecordPage = lazy(async () => ({ default: (await import('@/components/approval/ShopifySnapshotRecordPage')).ShopifySnapshotRecordPage }));
const ShopifyListingsDirectoryTab = lazy(async () => ({ default: (await import('@/components/approval/ShopifyListingsDirectoryTab')).ShopifyListingsDirectoryTab }));
const ListingApprovalShippedRecordPage = lazy(async () => ({ default: (await import('@/components/approval/ListingApprovalShippedRecordPage')).ListingApprovalShippedRecordPage }));
const UserManagementTab = lazy(async () => ({ default: (await import('@/components/UserManagementTab')).UserManagementTab }));
const AirtableTab = lazy(async () => ({ default: (await import('@/components/tabs/AirtableTab')).AirtableTab }));
const WorkflowSnapshotPage = lazy(async () => ({ default: (await import('@/components/tabs/WorkflowSnapshotPage')).WorkflowSnapshotPage }));
const InventoryPriceEditorPage = lazy(async () => ({ default: (await import('../components/tabs/InventoryPriceEditorPage')).InventoryPriceEditorPage }));
const ParkingLotTab = lazy(async () => ({ default: (await import('@/components/tabs/ParkingLotTab')).ParkingLotTab }));
const UsedGearPendingReviewGroupPage = lazy(async () => ({ default: (await import('../components/tabs/UsedGearPendingReviewGroupPage')).UsedGearPendingReviewGroupPage }));
const UsedGearPendingReviewRecordPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearPendingReviewRecordPage')).UsedGearPendingReviewRecordPage }));
const JotformTab = lazy(async () => ({ default: (await import('@/components/tabs/JotformTab')).JotformTab }));
const MarketTab = lazy(async () => ({ default: (await import('@/components/tabs/MarketTab')).MarketTab }));
const PhotosFormTab = lazy(async () => ({ default: (await import('@/components/tabs/PhotosFormTab')).PhotosFormTab }));
const TestingFormTab = lazy(async () => ({ default: (await import('@/components/tabs/TestingFormTab')).TestingFormTab }));
const UsedGearManualIntakePage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearManualIntakePage')).UsedGearManualIntakePage }));
const UsedGearWorkflowSourceDirectoryPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearWorkflowSourceDirectoryPage')).UsedGearWorkflowSourceDirectoryPage }));
const UsedGearParkingLotArrivalGroupPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearParkingLotArrivalGroupPage')).UsedGearParkingLotArrivalGroupPage }));
const UsedGearParkingLotArrivalRecordPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearParkingLotArrivalRecordPage')).UsedGearParkingLotArrivalRecordPage }));
const UsedGearTrashReviewGroupPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearTrashReviewGroupPage')).UsedGearTrashReviewGroupPage }));
const UsedGearTrashReviewRecordPage = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearTrashReviewRecordPage')).UsedGearTrashReviewRecordPage }));
const UsedGearTrashTab = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearTrashTab')).UsedGearTrashTab }));
const UsedGearWorkflowQueueTab = lazy(async () => ({ default: (await import('@/components/tabs/UsedGearWorkflowQueueTab')).UsedGearWorkflowQueueTab }));
const PostPublishQueueTab = lazy(async () => ({ default: (await import('@/components/tabs/PostPublishQueueTab')).PostPublishQueueTab }));
const ArchiveQueueTab = lazy(async () => ({ default: (await import('@/components/tabs/ArchiveQueueTab')).ArchiveQueueTab }));

function TabLoadingFallback({ tabLabel }: { tabLabel: string }) {
  return <LoadingSurface message={`Loading ${tabLabel}...`} />;
}

function DashboardTabLoadingFallback() {
  return <LoadingSurface message="Loading dashboard..." />;
}

function getTabLoadingLabel(tab: AppTabContentProps['activeTab']): string {
  switch (tab) {
    case 'dashboard':
      return 'dashboard';
    case 'sales':
      return 'sales';
    case 'seo':
      return 'SEO dashboard';
    case 'seo-stereobuyers':
      return 'Stereobuyers SEO dashboard';
    case 'assistant-insights':
      return 'assistant usage';
    case 'issues':
      return 'issues';
    case 'people':
      return 'people';
    case 'workflow-guide':
      return 'user guide';
    case 'workflow-guide-editor':
      return 'user guide admin';
    case 'inventory':
      return 'inventory';
    case 'shopify':
      return 'Shopify';
    case 'ebay':
      return 'eBay';
    case 'parking-lot':
      return 'Parking Lot';
    case 'jotform':
      return 'JotForm';
    case 'jotform-audit':
      return 'JotForm Audit';
    case 'trash-review':
      return 'Trash Review';
    case 'testing-queue':
      return 'Testing';
    case 'photography-queue':
      return 'Photography';
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
    case 'create-intake-item':
      return 'create intake item';
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
  jotformReviewGroupId,
  jotformReviewRecordId,
  jotformDirectoryRecordId,
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
  postPublishRecordId,
  soldReadyListingsRecordId,
  shippedListingsRecordId,
  shopifyListingsRecordId,
  ebayListingsRecordId,
  userRecordId,
  navigateToInventoryRecord,
  navigateToUsedGearOperationalRecord,
  navigateToInventoryList,
  navigateToInventoryWorkflowView,
  navigateToInventoryPostPublishBucket,
  navigateToPath,
  navigateToParkingLotPendingReviewGroup,
  navigateToManualIntake,
  navigateToCreateIntakeItem,
  navigateToManualIntakeForm,
  navigateToTestingForm,
  navigateToPhotosForm,
  navigateToListingsRecord,
  navigateToPostPublishRecord,
  navigateToSoldReadyListingRecord,
  navigateToShippedListingRecord,
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
  workflowListedSkus,
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
    jotformReviewGroupId,
    jotformReviewRecordId,
    jotformDirectoryRecordId,
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
    postPublishRecordId,
    soldReadyListingsRecordId,
    shippedListingsRecordId,
    shopifyListingsRecordId,
    ebayListingsRecordId,
    userRecordId,
  });
  const isRouteTransitionPending = deferredRouteState.manualIntakeRecordId !== manualIntakeRecordId
    || deferredRouteState.jotformDirectoryRecordId !== jotformDirectoryRecordId
    || deferredRouteState.jotformReviewGroupId !== jotformReviewGroupId
    || deferredRouteState.jotformReviewRecordId !== jotformReviewRecordId
    || deferredRouteState.parkingLotArrivalGroupId !== parkingLotArrivalGroupId
    || deferredRouteState.parkingLotArrivalRecordId !== parkingLotArrivalRecordId
    || deferredRouteState.trashReviewGroupId !== trashReviewGroupId
    || deferredRouteState.trashReviewRecordId !== trashReviewRecordId
    || deferredRouteState.testingRecordId !== testingRecordId
    || deferredRouteState.photosRecordId !== photosRecordId
    || deferredRouteState.inventoryRecordId !== inventoryRecordId
    || deferredRouteState.inventoryPriceEditorRecordId !== inventoryPriceEditorRecordId
    || deferredRouteState.listingsRecordId !== listingsRecordId
    || deferredRouteState.postPublishRecordId !== postPublishRecordId
    || deferredRouteState.soldReadyListingsRecordId !== soldReadyListingsRecordId
    || deferredRouteState.shippedListingsRecordId !== shippedListingsRecordId
    || deferredRouteState.shopifyListingsRecordId !== shopifyListingsRecordId
    || deferredRouteState.ebayListingsRecordId !== ebayListingsRecordId
    || deferredRouteState.userRecordId !== userRecordId;

  const channelItems = (['listings', 'shopify', 'ebay'] as const)
    .filter((page) => accessiblePages.includes(page))
    .map((page) => ({ key: page, label: page === 'listings' ? 'Listings' : page === 'shopify' ? 'Shopify' : 'eBay' }));
  const onChannelList = (activeTab === 'listings' && !listingsRecordId)
    || (activeTab === 'shopify' && !deferredRouteState.shopifyListingsRecordId)
    || (activeTab === 'ebay' && !deferredRouteState.ebayListingsRecordId);
  const channelNav = onChannelList && channelItems.length > 1 ? (
    <div role="group" aria-label="Listing channels" className="inline-flex self-start rounded-lg border border-[var(--line)] p-0.5">
      {channelItems.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.key === activeTab}
          onClick={() => navigateToTab(item.key)}
          className={`rounded-md px-3 py-1 text-[0.8rem] font-semibold outline-none transition ${item.key === activeTab ? 'bg-[var(--accent)]/15 text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null;

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'imagelab':
        return <ImageLab />;
      case 'listings': {
        if (!runtimeFeatures.approvalCombined.available && runtimeFeatures.approvalCombined.message) {
          return <FeatureUnavailableTab title="Combined listings unavailable" message={runtimeFeatures.approvalCombined.message} />;
        }
        const listingsViewModel = buildApprovalTabViewModel({
          approvalRecordId: listingsRecordId,
          navigateToApprovalRecord: navigateToListingsRecord,
          navigateToApprovalList: navigateToListingsList,
          navigateToIntakeForm: navigateToManualIntakeForm,
          navigateToOperationalRecord: navigateToUsedGearOperationalRecord,
          navigateToTestingForm,
          navigateToPhotosForm,
        });
        return <CombinedListingsApprovalTab viewModel={listingsViewModel} />;
      }
      case 'ebay': {
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
        if (deferredRouteState.ebayListingsRecordId) {
          return (
            <EbaySnapshotRecordPage
              recordId={deferredRouteState.ebayListingsRecordId}
              viewModel={ebayViewModel}
              onBackToSnapshot={() => navigateToEbayList()}
              onOpenListing={(recordId) => navigateToListingsRecord(recordId)}
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
      }
      case 'users': {
        const usersViewModel = buildUsersTabViewModel({
          userRecordId,
          navigateToUserRecord,
          navigateToUsersList,
        });
        return <UserManagementTab viewModel={usersViewModel} />;
      }
      case 'settings':
        return <SettingsTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'sales':
        return <SalesTab currentUserRole={currentUserRole} />;
      case 'seo':
        return <SeoTab site="resolutionav" />;
      case 'seo-stereobuyers':
        return <SeoTab site="stereobuyers" />;
      case 'assistant-insights':
        return <AssistantInsightsTab />;
      case 'issues':
        return <IssuesTab />;
      case 'people':
        return <PeopleTab currentUserRole={currentUserRole} />;
      case 'dashboard': {
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
        return <DashboardTab viewModel={dashboardViewModel} />;
      }
      case 'workflow-guide':
        return <WorkflowGuideTab currentUserRole={currentUserRole} currentUserName={currentUserName} accessiblePages={accessiblePages} />;
      case 'workflow-guide-editor':
        return <WorkflowGuideEditorTab currentUserRole={currentUserRole} />;
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
              viewModel={buildAirtableTabViewModel({
                atLoading,
                atError,
                nonEmptyListings,
                displayValue,
                hasValue,
                recordTitle,
              })}
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
        if (deferredRouteState.postPublishRecordId) {
          const postPublishViewModel = buildApprovalTabViewModel({
            approvalRecordId: deferredRouteState.postPublishRecordId,
            navigateToApprovalRecord: navigateToPostPublishRecord,
            navigateToApprovalList: () => navigateToTab('post-publish'),
            navigateToIntakeForm: navigateToManualIntakeForm,
            navigateToOperationalRecord: navigateToUsedGearOperationalRecord,
            navigateToTestingForm,
            navigateToPhotosForm,
          });
          return (
            <CombinedListingsApprovalTab viewModel={postPublishViewModel} backToListLabel="Back to Post-Publish" />
          );
        }
        if (deferredRouteState.soldReadyListingsRecordId) {
          const soldReadyViewModel = buildApprovalTabViewModel({
            approvalRecordId: deferredRouteState.soldReadyListingsRecordId,
            navigateToApprovalRecord: navigateToPostPublishRecord,
            navigateToApprovalList: () => navigateToTab('post-publish'),
            navigateToIntakeForm: navigateToManualIntakeForm,
            navigateToOperationalRecord: navigateToUsedGearOperationalRecord,
            navigateToTestingForm,
            navigateToPhotosForm,
          });
          return (
            <CombinedListingsApprovalTab viewModel={soldReadyViewModel} backToListLabel="Back to Post-Publish" />
          );
        }
        return (
          <PostPublishQueueTab
            currentUserName={currentUserName}
            onOpenOperationalRecord={(recordId) => navigateToUsedGearOperationalRecord(recordId)}
            onOpenListingsRecord={(recordId) => navigateToPostPublishRecord(recordId)}
            onOpenSoldReadyRecord={(recordId) => navigateToSoldReadyListingRecord(recordId)}
            onOpenShipmentRecord={(recordId) => navigateToShippedListingRecord(recordId)}
          />
        );
      case 'archive':
        if (deferredRouteState.shippedListingsRecordId) {
          return (
            <ListingApprovalShippedRecordPage
              recordId={deferredRouteState.shippedListingsRecordId}
              onBackToCompletedShipments={() => navigateToTab('archive')}
              onOpenWorkflowSnapshot={(recordId) => navigateToInventoryRecord(recordId)}
            />
          );
        }
        return (
          <ArchiveQueueTab
            currentUserName={currentUserName}
            onOpenWorkflowSnapshot={(recordId) => navigateToInventoryRecord(recordId)}
            onOpenListingsRecord={(recordId) => navigateToListingsRecord(recordId)}
            onOpenSoldReadyRecord={(recordId) => navigateToSoldReadyListingRecord(recordId)}
            onOpenShipmentRecord={(recordId) => navigateToShippedListingRecord(recordId)}
          />
        );
      case 'shopify': {
        const shopifyViewModel = buildShopifyTabViewModel({
          spLoading,
          spError,
          products,
          workflowListedSkus,
          nonEmptyListings,
          storeDomain,
        });
        if (deferredRouteState.shopifyListingsRecordId) {
          return (
            <ShopifySnapshotRecordPage
              productId={deferredRouteState.shopifyListingsRecordId}
              viewModel={shopifyViewModel}
              onBackToSnapshot={() => navigateToShopifyList()}
              onOpenListing={(recordId) => navigateToListingsRecord(recordId)}
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
      }
      case 'market':
        return <MarketTab viewModel={buildMarketTabViewModel({
          sharkLoading,
          sharkError,
          sharkListings,
          currentSlug,
          sharkSearch,
        })} />;
      case 'manual-intake':
        if (deferredRouteState.manualIntakeRecordId) {
          return (
            <UsedGearManualIntakePage
              recordId={deferredRouteState.manualIntakeRecordId}
              eyebrow="Manual Intake"
              onBackToDirectory={() => navigateToManualIntake()}
              backToDirectoryLabel="Back to Manual Intake"
              onOpenListingDetail={(recordId) => navigateToListingsRecord(recordId)}
            />
          );
        }
        return (
          <UsedGearWorkflowSourceDirectoryPage
            title="Manual Intake"
            workflowSource="Manual Entry"
            onOpenRecord={(recordId) => navigateToManualIntakeForm(recordId)}
            onOpenGroup={(groupId, routeKind) => {
              if (routeKind === 'arrival-stage') {
                navigateToPath(`/parking-lot/arrival/group/${encodeURIComponent(groupId)}`);
                return;
              }

              navigateToParkingLotPendingReviewGroup(groupId);
            }}
            createActionLabel="Create Intake Item"
            onCreateAction={() => navigateToCreateIntakeItem()}
          />
        );
      case 'create-intake-item':
        return <UsedGearManualIntakePage onCreateSuccess={() => navigateToManualIntake()} />;
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
        return <TestingFormTab recordId={deferredRouteState.testingRecordId} eyebrow="Testing" onBackToDirectory={() => navigateToTab('testing-queue')} />;
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
        return <PhotosFormTab recordId={deferredRouteState.photosRecordId} eyebrow="Photography" onBackToDirectory={() => navigateToTab('photography-queue')} />;
      case 'parking-lot':
        if (deferredRouteState.parkingLotArrivalGroupId) {
          return (
            <UsedGearParkingLotArrivalGroupPage
              currentUserName={currentUserName}
              groupId={deferredRouteState.parkingLotArrivalGroupId}
              onBackToParkingLot={() => navigateToTab('parking-lot')}
              onOpenTrashReview={() => navigateToTab('trash-review')}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
            />
          );
        }
        if (deferredRouteState.parkingLotArrivalRecordId) {
          return (
            <UsedGearParkingLotArrivalRecordPage
              currentUserName={currentUserName}
              recordId={deferredRouteState.parkingLotArrivalRecordId}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
            />
          );
        }
        if (deferredRouteState.jotformReviewGroupId) {
          return (
            <UsedGearPendingReviewGroupPage
              currentUserName={currentUserName}
              groupId={deferredRouteState.jotformReviewGroupId}
              onBackToParkingLot={() => navigateToTab('parking-lot')}
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
          <ParkingLotTab
            currentUserName={currentUserName}
          />
        );
      case 'jotform':
        if (deferredRouteState.jotformDirectoryRecordId) {
          return (
            <UsedGearManualIntakePage
              recordId={deferredRouteState.jotformDirectoryRecordId}
              eyebrow="JotForm"
              onBackToDirectory={() => navigateToTab('jotform')}
              backToDirectoryLabel="Back to JotForm"
              onOpenListingDetail={(recordId) => navigateToListingsRecord(recordId)}
            />
          );
        }
        return (
          <UsedGearWorkflowSourceDirectoryPage
            title="JotForm"
            workflowSource="JotForm"
            onOpenRecord={(recordId) => navigateToPath(`/jotform/${encodeURIComponent(recordId)}`)}
            onOpenGroup={(groupId, routeKind) => {
              if (routeKind === 'arrival-stage') {
                navigateToPath(`/parking-lot/arrival/group/${encodeURIComponent(groupId)}`);
                return;
              }

              navigateToParkingLotPendingReviewGroup(groupId);
            }}
            secondaryActionLabel="JotForm Feed"
            onSecondaryAction={() => navigateToTab('jotform-audit')}
          />
        );
      case 'jotform-audit':
        if (!runtimeFeatures.jotform.available && runtimeFeatures.jotform.message) {
          return <FeatureUnavailableTab title="JotForm Audit unavailable" message={runtimeFeatures.jotform.message} />;
        }
        return <JotformTab viewModel={buildJotformTabViewModel({
          jfSubmissions,
          jfLoading,
          jfPolling,
          jfError,
          jfRefetch,
          jfLastUpdated,
          jfFreshCount,
          jfClearFresh,
        })} />;
      case 'trash-review':
        if (deferredRouteState.trashReviewGroupId) {
          return (
            <UsedGearTrashReviewGroupPage
              currentUserName={currentUserName}
              groupId={deferredRouteState.trashReviewGroupId}
              onOpenManualIntake={(recordId) => navigateToManualIntakeForm(recordId)}
            />
          );
        }
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
      <div className={isRouteTransitionPending ? 'opacity-95 transition-opacity' : 'transition-opacity'} aria-busy={isRouteTransitionPending}>
        <Suspense fallback={activeTab === 'dashboard' ? <DashboardTabLoadingFallback /> : <TabLoadingFallback tabLabel={getTabLoadingLabel(activeTab)} />}>
          <PageSubNavContext.Provider value={channelNav}>{renderActiveTab()}</PageSubNavContext.Provider>
        </Suspense>
      </div>
    </div>
  );
}
