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
const EbayTab = lazy(async () => ({ default: (await import('@/components/EbayTab')).EbayTab }));
const ImageLab = lazy(async () => ({ default: (await import('@/components/ImageLab')).ImageLab }));
const CombinedListingsApprovalTab = lazy(async () => ({ default: (await import('@/components/approval/CombinedListingsApprovalTab')).CombinedListingsApprovalTab }));
const EbayListingApprovalTab = lazy(async () => ({ default: (await import('@/components/approval/EbayListingApprovalTab')).EbayListingApprovalTab }));
const ShopifyListingApprovalTab = lazy(async () => ({ default: (await import('@/components/approval/ShopifyListingApprovalTab')).ShopifyListingApprovalTab }));
const NotificationsTab = lazy(async () => ({ default: (await import('@/components/NotificationsTab')).NotificationsTab }));
const SettingsTab = lazy(async () => ({ default: (await import('@/components/SettingsTab')).SettingsTab }));
const UserManagementTab = lazy(async () => ({ default: (await import('@/components/UserManagementTab')).UserManagementTab }));
const AirtableTab = lazy(async () => ({ default: (await import('@/components/tabs/AirtableTab')).AirtableTab }));
const AirtableEmbeddedForm = lazy(async () => ({ default: (await import('@/components/tabs/AirtableEmbeddedForm')).AirtableEmbeddedForm }));
const InventoryRecordEditorPage = lazy(async () => ({ default: (await import('@/components/tabs/InventoryRecordEditorPage')).InventoryRecordEditorPage }));
const JotformTab = lazy(async () => ({ default: (await import('@/components/tabs/JotformTab')).JotformTab }));
const MarketTab = lazy(async () => ({ default: (await import('@/components/tabs/MarketTab')).MarketTab }));
const PhotosFormTab = lazy(async () => ({ default: (await import('@/components/tabs/PhotosFormTab')).PhotosFormTab }));
const ShopifyTab = lazy(async () => ({ default: (await import('@/components/tabs/ShopifyTab')).ShopifyTab }));
const TestingFormTab = lazy(async () => ({ default: (await import('@/components/tabs/TestingFormTab')).TestingFormTab }));

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

function getTabLoadingLabel(tab: AppTabContentProps['activeTab']): string {
  switch (tab) {
    case 'dashboard':
      return 'dashboard';
    case 'inventory':
      return 'inventory';
    case 'shopify':
      return 'Shopify';
    case 'ebay':
      return 'eBay';
    case 'approval':
      return 'approval queue';
    case 'shopify-approval':
      return 'Shopify approval queue';
    case 'jotform':
      return 'JotForm';
    case 'market':
      return 'market research';
    case 'users':
      return 'user management';
    case 'settings':
      return 'settings';
    case 'notifications':
      return 'notifications';
    case 'incoming-gear':
      return 'incoming gear form';
    case 'testing':
      return 'testing form';
    case 'photos':
      return 'photos form';
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
  incomingGearRecordId,
  testingRecordId,
  photosRecordId,
  inventoryRecordId,
  listingsRecordId,
  approvalRecordId,
  shopifyApprovalRecordId,
  userRecordId,
  navigateToInventoryRecord,
  navigateToInventoryList,
  navigateToIncomingGearForm,
  navigateToTestingForm,
  navigateToPhotosForm,
  navigateToListingsRecord,
  navigateToListingsList,
  navigateToApprovalRecord,
  navigateToApprovalList,
  navigateToShopifyApprovalRecord,
  navigateToShopifyApprovalList,
  navigateToUserRecord,
  navigateToUsersList,
  navigateToTab,
  runtimeFeatures,
  metrics,
  accessiblePages,
  aiProvider,
  usersCount,
  adminCount,
  nonEmptyListings,
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
  totalNewSubmissions,
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
    incomingGearRecordId,
    testingRecordId,
    photosRecordId,
    inventoryRecordId,
    listingsRecordId,
    approvalRecordId,
    shopifyApprovalRecordId,
    userRecordId,
  });
  const isRouteTransitionPending = deferredRouteState.activeTab !== activeTab
    || deferredRouteState.incomingGearRecordId !== incomingGearRecordId
    || deferredRouteState.testingRecordId !== testingRecordId
    || deferredRouteState.photosRecordId !== photosRecordId
    || deferredRouteState.inventoryRecordId !== inventoryRecordId
    || deferredRouteState.listingsRecordId !== listingsRecordId
    || deferredRouteState.approvalRecordId !== approvalRecordId
    || deferredRouteState.shopifyApprovalRecordId !== shopifyApprovalRecordId
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
    totalNewSubmissions,
    metrics,
    accessiblePages,
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

  const approvalViewModel = buildApprovalTabViewModel({
    approvalRecordId,
    navigateToApprovalRecord,
    navigateToApprovalList,
  });

  const listingsViewModel = buildApprovalTabViewModel({
    approvalRecordId: listingsRecordId,
    navigateToApprovalRecord: navigateToListingsRecord,
    navigateToApprovalList: navigateToListingsList,
  });

  const shopifyApprovalViewModel = buildApprovalTabViewModel({
    approvalRecordId: shopifyApprovalRecordId,
    navigateToApprovalRecord: navigateToShopifyApprovalRecord,
    navigateToApprovalList: navigateToShopifyApprovalList,
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
        if (!runtimeFeatures.ebay.available && runtimeFeatures.ebay.message) {
          return <FeatureUnavailableTab title="eBay unavailable" message={runtimeFeatures.ebay.message} />;
        }
        return <EbayTab viewModel={ebayViewModel} />;
      case 'approval':
        if (!runtimeFeatures.approvalEbay.available && runtimeFeatures.approvalEbay.message) {
          return <FeatureUnavailableTab title="eBay approval unavailable" message={runtimeFeatures.approvalEbay.message} />;
        }
        return <EbayListingApprovalTab viewModel={approvalViewModel} />;
      case 'shopify-approval':
        if (!runtimeFeatures.approvalShopify.available && runtimeFeatures.approvalShopify.message) {
          return <FeatureUnavailableTab title="Shopify approval unavailable" message={runtimeFeatures.approvalShopify.message} />;
        }
        return <ShopifyListingApprovalTab viewModel={shopifyApprovalViewModel} />;
      case 'users':
        return <UserManagementTab viewModel={usersViewModel} />;
      case 'settings':
        return <SettingsTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'dashboard':
        return <DashboardTab viewModel={dashboardViewModel} />;
      case 'inventory':
        return deferredRouteState.inventoryRecordId
          ? <InventoryRecordEditorPage recordId={deferredRouteState.inventoryRecordId} onBackToDirectory={() => navigateToInventoryList()} />
          : (
            <AirtableTab
              viewModel={airtableViewModel}
              onAddNewRecord={() => navigateToIncomingGearForm()}
              onOpenIncomingGearForm={(recordId) => navigateToIncomingGearForm(recordId)}
              onOpenTestingForm={(recordId) => navigateToTestingForm(recordId)}
              onOpenPhotosForm={(recordId) => navigateToPhotosForm(recordId)}
              onSelectRecord={(recordId) => navigateToInventoryRecord(recordId)}
            />
          );
      case 'shopify':
        return <ShopifyTab viewModel={shopifyViewModel} />;
      case 'market':
        return <MarketTab viewModel={marketViewModel} />;
      case 'incoming-gear':
        return <AirtableEmbeddedForm recordId={deferredRouteState.incomingGearRecordId} onBackToDirectory={() => navigateToInventoryList()} />;
      case 'testing':
        return <TestingFormTab recordId={deferredRouteState.testingRecordId} onBackToDirectory={() => navigateToInventoryList()} />;
      case 'photos':
        return <PhotosFormTab recordId={deferredRouteState.photosRecordId} onBackToDirectory={() => navigateToInventoryList()} />;
      case 'jotform':
        if (!runtimeFeatures.jotform.available && runtimeFeatures.jotform.message) {
          return <FeatureUnavailableTab title="JotForm unavailable" message={runtimeFeatures.jotform.message} />;
        }
        return <JotformTab viewModel={jotformViewModel} />;
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
        <Suspense fallback={<TabLoadingFallback tabLabel={getTabLoadingLabel(deferredRouteState.activeTab)} />}>
          {renderActiveTab()}
        </Suspense>
      </div>
    </div>
  );
}
