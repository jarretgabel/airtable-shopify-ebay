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
import { ListingApprovalTab } from '@/components/ListingApprovalTab';
import { UserManagementTab } from '@/components/UserManagementTab';
import { AirtableTab } from '@/components/tabs/AirtableTab';
import { JotformTab } from '@/components/tabs/JotformTab';
import { MarketTab } from '@/components/tabs/MarketTab';
import { ShopifyTab } from '@/components/tabs/ShopifyTab';

export function AppTabContent({
  activeTab,
  approvalRecordId,
  userRecordId,
  navigateToApprovalRecord,
  navigateToApprovalList,
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

  const usersViewModel = buildUsersTabViewModel({
    userRecordId,
    navigateToUserRecord,
    navigateToUsersList,
  });

  switch (activeTab) {
    case 'imagelab':
      return <ImageLab />;
    case 'ebay':
      return <EbayTab viewModel={ebayViewModel} />;
    case 'approval':
      return <ListingApprovalTab viewModel={approvalViewModel} />;
    case 'users':
      return <UserManagementTab viewModel={usersViewModel} />;
    case 'dashboard':
      return <DashboardTab viewModel={dashboardViewModel} />;
    case 'airtable':
      return <AirtableTab viewModel={airtableViewModel} />;
    case 'shopify':
      return <ShopifyTab viewModel={shopifyViewModel} />;
    case 'market':
      return <MarketTab viewModel={marketViewModel} />;
    case 'jotform':
      return <JotformTab viewModel={jotformViewModel} />;
    default:
      return null;
  }
}
