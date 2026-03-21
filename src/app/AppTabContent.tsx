import { buildDashboardTabProps, buildEbayTabProps } from '@/app/appTabContentMappers';
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
import { displayValue, hasValue, recordTitle } from './appNavigation';

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
}: AppTabContentProps) {
  const ebayTabProps = buildEbayTabProps({
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

  const dashboardTabProps = buildDashboardTabProps({
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

  switch (activeTab) {
    case 'imagelab':
      return <ImageLab />;
    case 'ebay':
      return <EbayTab {...ebayTabProps} />;
    case 'approval':
      return <ListingApprovalTab selectedRecordId={approvalRecordId} onSelectRecord={navigateToApprovalRecord} onBackToList={navigateToApprovalList} />;
    case 'users':
      return <UserManagementTab selectedUserId={userRecordId} onSelectUser={navigateToUserRecord} onBackToList={navigateToUsersList} />;
    case 'dashboard':
      return <DashboardTab {...dashboardTabProps} />;
    case 'airtable':
      return <AirtableTab loading={atLoading} error={atError} listings={nonEmptyListings} displayValue={displayValue} hasValue={hasValue} recordTitle={recordTitle} />;
    case 'shopify':
      return <ShopifyTab loading={spLoading} error={spError} products={products} storeDomain={import.meta.env.VITE_SHOPIFY_STORE_DOMAIN} />;
    case 'market':
      return <MarketTab loading={sharkLoading} error={sharkError} listings={sharkListings} currentSlug={currentSlug} onSearch={sharkSearch} />;
    case 'jotform':
      return <JotformTab submissions={jfSubmissions} loading={jfLoading} polling={jfPolling} error={jfError} refetch={jfRefetch} lastUpdated={jfLastUpdated} freshCount={jfFreshCount} clearFresh={jfClearFresh} />;
    default:
      return null;
  }
}
