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
import { DashboardTab } from '@/components/DashboardTab';
import { EbayTab } from '@/components/EbayTab';
import { ImageLab } from '@/components/ImageLab';
import { CombinedListingsApprovalTab } from '@/components/approval/CombinedListingsApprovalTab';
import { EbayListingApprovalTab } from '@/components/approval/EbayListingApprovalTab';
import { ShopifyListingApprovalTab } from '@/components/approval/ShopifyListingApprovalTab';
import { NotificationsTab } from '@/components/NotificationsTab';
import { SettingsTab } from '@/components/SettingsTab';
import { UserManagementTab } from '@/components/UserManagementTab';
import { AirtableTab } from '@/components/tabs/AirtableTab';
import { AirtableEmbeddedForm } from '@/components/tabs/AirtableEmbeddedForm.tsx';
import { JotformTab } from '@/components/tabs/JotformTab';
import { MarketTab } from '@/components/tabs/MarketTab';
import { ShopifyTab } from '@/components/tabs/ShopifyTab';

export function AppTabContent({
  activeTab,
  listingsRecordId,
  approvalRecordId,
  shopifyApprovalRecordId,
  userRecordId,
  navigateToListingsRecord,
  navigateToListingsList,
  navigateToApprovalRecord,
  navigateToApprovalList,
  navigateToShopifyApprovalRecord,
  navigateToShopifyApprovalList,
  navigateToUserRecord,
  navigateToUsersList,
  navigateToTab,
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
  ebayInventoryItems,
  ebayOffers,
  ebayRecentListings,
  ebayTotal,
  ebayPublishedCount,
  ebayDraftCount,
  ebayRefetch,
  ebayDisconnect,
  sharkLoading,
  sharkError,
  sharkListings,
  sharkSearch,
  currentSlug,
  displayValue,
  hasValue,
  recordTitle,
}: AppTabContentProps) {
  const ebayViewModel = buildEbayTabViewModel({
    ebayAuthenticated,
    ebayRestoringSession,
    ebayLoading,
    ebayError,
    ebayInventoryItems,
    ebayOffers,
    ebayRecentListings,
    ebayTotal,
    ebayRefetch,
    ebayDisconnect,
  });

  const dashboardViewModel = buildDashboardTabViewModel({
    atLoading,
    spLoading,
    jfLoading,
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

  switch (activeTab) {
    case 'imagelab':
      return <ImageLab />;
    case 'listings':
      return <CombinedListingsApprovalTab viewModel={listingsViewModel} />;
    case 'ebay':
      return <EbayTab viewModel={ebayViewModel} />;
    case 'approval':
      return <EbayListingApprovalTab viewModel={approvalViewModel} />;
    case 'shopify-approval':
      return <ShopifyListingApprovalTab viewModel={shopifyApprovalViewModel} />;
    case 'users':
      return <UserManagementTab viewModel={usersViewModel} />;
    case 'settings':
      return <SettingsTab />;
    case 'notifications':
      return <NotificationsTab />;
    case 'dashboard':
      return <DashboardTab viewModel={dashboardViewModel} />;
    case 'airtable':
      return <AirtableTab viewModel={airtableViewModel} />;
    case 'shopify':
      return <ShopifyTab viewModel={shopifyViewModel} />;
    case 'market':
      return <MarketTab viewModel={marketViewModel} />;
    case 'request-form':
      return <AirtableEmbeddedForm />;
    case 'jotform':
      return <JotformTab viewModel={jotformViewModel} />;
    default:
      return null;
  }
}
