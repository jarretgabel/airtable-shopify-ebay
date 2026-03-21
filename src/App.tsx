import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_PAGES, AppPage, PAGE_DEFINITIONS } from '@/auth/pages';
import { AppFrame } from '@/components/app/AppFrame';
import { DashboardTab } from '@/components/DashboardTab';
import { EbayTab } from '@/components/EbayTab';
import { ImageLab } from '@/components/ImageLab';
import { ListingApprovalTab } from '@/components/ListingApprovalTab';
import { LoginScreen } from '@/components/LoginScreen';
import { ResetPasswordScreen } from '@/components/ResetPasswordScreen';
import { AirtableTab } from '@/components/tabs/AirtableTab';
import { JotformTab } from '@/components/tabs/JotformTab';
import { MarketTab } from '@/components/tabs/MarketTab';
import { ShopifyTab } from '@/components/tabs/ShopifyTab';
import { UserManagementTab } from '@/components/UserManagementTab';
import { useAuth } from '@/context/AuthContext';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useEbayListings } from '@/hooks/useEbayListings';
import { useHiFiShark } from '@/hooks/useHiFiShark';
import { useApprovalQueueSummary } from '@/hooks/useApprovalQueueSummary';
import { useJotFormInquiries } from '@/hooks/useJotForm';
import { useListings } from '@/hooks/useListings';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { getAIProvider } from '@/services/equipmentAI';
import { appendElementToPdf, createPdfDocumentAsync } from '@/services/pdfExport';

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function hasNonEmptyFields(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some((value) => hasValue(value));
}

function recordTitle(fields: Record<string, unknown>): string {
  return displayValue(fields.Brand ?? fields.Name ?? fields.Model ?? 'Untitled Listing');
}

type Tab = AppPage;
const TAB_VALUES: Tab[] = [...APP_PAGES];
const TAB_PATHS: Record<Tab, string> = Object.entries(PAGE_DEFINITIONS).reduce(
  (acc, [page, definition]) => {
    acc[page as Tab] = definition.path;
    return acc;
  },
  {} as Record<Tab, string>,
);

function isTab(value: string | null): value is Tab {
  return Boolean(value && TAB_VALUES.includes(value as Tab));
}

const EBAY_TABS = ['ebay', 'approval'] as const satisfies readonly Tab[];
const EBAY_TAB_SET = new Set<Tab>(EBAY_TABS as readonly Tab[]);
const UTILITY_TABS = ['imagelab', 'users'] as const satisfies readonly Tab[];
const UTILITY_TAB_SET = new Set<Tab>(UTILITY_TABS as readonly Tab[]);
const NAV_LABELS: Partial<Record<Tab, string>> = {
  dashboard: 'Dashboard',
  airtable: 'Airtable',
  shopify: 'Shopify',
  market: 'HiFi Shark',
  jotform: 'JotForm',
  ebay: 'Listings',
  approval: 'Listing Approval',
  imagelab: 'Image Lab',
  users: 'User Management',
};

function navLabel(tab: Tab): string {
  return NAV_LABELS[tab] ?? PAGE_DEFINITIONS[tab].label;
}

function waitForScreenRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 120);
      });
    });
  });
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, users, accessiblePages, canAccessPage, logout } = useAuth();

  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isLoginPath = normalizedPath === '/login';
  const isResetPasswordPath = normalizedPath === '/reset-password';
  const resetToken = new URLSearchParams(location.search).get('token');
  const approvalRecordMatch = normalizedPath.match(/^\/approval\/([^/]+)$/);
  const userRecordMatch = normalizedPath.match(/^\/users\/([^/]+)$/);
  const firstAccessibleTab: Tab = (accessiblePages[0] ?? 'dashboard') as Tab;

  const activeTab: Tab = (() => {
    if (normalizedPath === '/approval' || approvalRecordMatch) return 'approval';
    if (normalizedPath === '/users' || userRecordMatch) return 'users';
    const tabFromPath = normalizedPath.slice(1);
    return isTab(tabFromPath) ? tabFromPath : 'dashboard';
  })();

  const approvalRecordId = approvalRecordMatch ? decodeURIComponent(approvalRecordMatch[1]) : null;
  const userRecordId = userRecordMatch ? decodeURIComponent(userRecordMatch[1]) : null;

  const [exportingPdf, setExportingPdf] = useState(false);
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const shellRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!currentUser) {
      if (!isLoginPath && !isResetPasswordPath) {
        navigate('/login', { replace: true });
      }
      return;
    }

    if (isLoginPath || isResetPasswordPath || normalizedPath === '/') {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    const isKnownTabPath = isTab(normalizedPath.slice(1));
    const isApprovalDetailPath = /^\/approval\/[^/]+$/.test(normalizedPath);
    const isUserDetailPath = /^\/users\/[^/]+$/.test(normalizedPath);
    if (!isKnownTabPath && normalizedPath !== '/approval' && !isApprovalDetailPath && normalizedPath !== '/users' && !isUserDetailPath) {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
      return;
    }

    const requestedTab: Tab | null =
      normalizedPath === '/approval' || isApprovalDetailPath
        ? 'approval'
        : normalizedPath === '/users' || isUserDetailPath
          ? 'users'
        : isKnownTabPath
          ? (normalizedPath.slice(1) as Tab)
          : null;

    if (requestedTab && !canAccessPage(requestedTab)) {
      navigate(TAB_PATHS[firstAccessibleTab], { replace: true });
    }
  }, [
    currentUser,
    isLoginPath,
    isResetPasswordPath,
    normalizedPath,
    navigate,
    firstAccessibleTab,
    canAccessPage,
  ]);

  function navigateToTab(tab: Tab, replace = false): void {
    navigate(TAB_PATHS[tab], { replace });
  }

  function navigateToApprovalRecord(recordId: string, replace = false): void {
    navigate(`/approval/${encodeURIComponent(recordId)}`, { replace });
  }

  function navigateToApprovalList(replace = false): void {
    navigate(TAB_PATHS.approval, { replace });
  }

  function navigateToUserRecord(userId: string, replace = false): void {
    navigate(`/users/${encodeURIComponent(userId)}`, { replace });
  }

  function navigateToUsersList(replace = false): void {
    navigate(TAB_PATHS.users, { replace });
  }

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  const tableName = import.meta.env.VITE_AIRTABLE_TABLE_NAME || 'Table 1';
  const viewId = import.meta.env.VITE_AIRTABLE_VIEW_ID;
  const { listings, loading: atLoading, error: atError, refetch: atRefetch } = useListings(tableName, viewId);
  const nonEmptyListings = listings.filter((listing) => hasNonEmptyFields(listing.fields));

  const { products, loading: spLoading, error: spError, refetch: spRefetch } = useShopifyProducts();
  const { listings: sharkListings, loading: sharkLoading, error: sharkError, search: sharkSearch, currentSlug } = useHiFiShark();
  const {
    authenticated: ebayAuthenticated,
    restoringSession: ebayRestoringSession,
    loading: ebayLoading,
    error: ebayError,
    inventoryItems: ebayInventoryItems,
    offers: ebayOffers,
    recentListings: ebayRecentListings,
    total: ebayTotal,
    refetch: ebayRefetch,
    disconnect: ebayDisconnect,
  } = useEbayListings(canAccessPage('ebay'));
  const {
    loading: approvalLoading,
    error: approvalError,
    total: approvalTotal,
    approved: approvalApproved,
    pending: approvalPending,
    refetch: approvalRefetch,
  } = useApprovalQueueSummary(canAccessPage('approval'));

  const JOTFORM_FORM_ID = import.meta.env.VITE_JOTFORM_FORM_ID || '213604252654047';
  const {
    submissions: jfSubmissions,
    loading: jfLoading,
    polling: jfPolling,
    error: jfError,
    refetch: jfRefetch,
    lastUpdated: jfLastUpdated,
    freshCount: jfFreshCount,
    clearFresh: jfClearFresh,
  } = useJotFormInquiries(JOTFORM_FORM_ID);

  const totalNewSubmissions = jfSubmissions.filter((submission) => submission.new === '1').length;
  const visibleTabs = TAB_VALUES.filter((tab) => canAccessPage(tab));
  const aiProvider = getAIProvider().provider;
  const adminCount = useMemo(() => users.filter((user) => user.role === 'admin').length, [users]);
  const ebayPublishedCount = useMemo(() => ebayOffers.filter((offer) => offer.status === 'PUBLISHED').length, [ebayOffers]);
  const ebayDraftCount = useMemo(() => ebayOffers.filter((offer) => offer.status === 'UNPUBLISHED').length, [ebayOffers]);

  const loading = activeTab === 'dashboard'
    ? dashboardRefreshing
    : activeTab === 'airtable'
    ? atLoading
    : activeTab === 'shopify'
      ? spLoading
      : activeTab === 'jotform'
        ? jfLoading
        : false;

  async function handleDashboardRefresh() {
    if (dashboardRefreshing) return;

    setDashboardRefreshing(true);
    try {
      await Promise.all([
        atRefetch(),
        Promise.resolve(spRefetch()),
        Promise.resolve(jfRefetch()),
        Promise.resolve(canAccessPage('ebay') ? ebayRefetch() : undefined),
        approvalRefetch(),
        Promise.resolve(currentSlug ? sharkSearch(currentSlug) : undefined),
      ]);
    } finally {
      setDashboardRefreshing(false);
    }
  }

  const refetch = activeTab === 'dashboard'
    ? handleDashboardRefresh
    : activeTab === 'airtable'
    ? atRefetch
    : activeTab === 'shopify'
      ? spRefetch
      : activeTab === 'jotform'
        ? jfRefetch
        : () => {};

  const metrics = useDashboardMetrics(nonEmptyListings, products, jfSubmissions);

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

  async function handleExportPdf(mode: 'current' | 'all') {
    if (exportingPdf || !shellRef.current) {
      return;
    }

    const exportTabs = mode === 'all'
      ? TAB_VALUES.filter((tab) => canAccessPage(tab))
      : canAccessPage(activeTab)
        ? [activeTab]
        : [];

    if (exportTabs.length === 0) {
      return;
    }

    const previousTab = activeTab;
    const previousScrollX = window.scrollX;
    const previousScrollY = window.scrollY;

    setExportingPdf(true);

    try {
      const pdf = await createPdfDocumentAsync();
      let firstScreen = true;
      const exportedAt = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      for (const [index, tab] of exportTabs.entries()) {
        const exportLabel = PAGE_DEFINITIONS[tab].label;
        setExportProgress({
          current: index + 1,
          total: exportTabs.length,
          label: exportLabel,
        });
        navigateToTab(tab, true);
        await waitForScreenRender();

        if (!shellRef.current) continue;

        await appendElementToPdf(pdf, shellRef.current, firstScreen, {
          title: exportLabel,
          subtitle: 'Listing Control Center export',
          exportedAt,
        });
        firstScreen = false;
      }

      pdf.save(`listing-control-center-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      navigateToTab(previousTab, true);
      await waitForScreenRender();
      window.scrollTo(previousScrollX, previousScrollY);
      setExportProgress(null);
      setExportingPdf(false);
    }
  }

  const mainTabs = visibleTabs.filter((tab) => !UTILITY_TAB_SET.has(tab) && !EBAY_TAB_SET.has(tab) && tab !== 'market');
  const postEbayTabs = visibleTabs.filter((tab) => tab === 'market');
  const ebayTabs = visibleTabs.filter((tab) => EBAY_TAB_SET.has(tab));
  const utilityTabs = visibleTabs.filter((tab) => UTILITY_TAB_SET.has(tab));

  const tabs = mainTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: tab === 'jotform' ? totalNewSubmissions : undefined,
    disabled: exportingPdf,
    onClick: () => navigateToTab(tab),
  }));

  const ebayNavTabs = ebayTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: tab === 'approval' ? approvalPending : undefined,
    disabled: exportingPdf,
    onClick: () => tab === 'approval' ? navigateToApprovalList() : navigateToTab(tab),
  }));

  const postEbayNavTabs = postEbayTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: undefined,
    disabled: exportingPdf,
    onClick: () => navigateToTab(tab),
  }));

  const utilityNavTabs = utilityTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: undefined,
    disabled: exportingPdf,
    onClick: () => tab === 'users'
        ? navigateToUsersList()
        : navigateToTab(tab),
  }));

  return (
    <AppFrame
      shellRef={shellRef}
      currentUserLabel={`${currentUser.name} · ${currentUser.role}`}
      tabs={tabs}
      postEbayTabs={postEbayNavTabs}
      ebayTabs={ebayNavTabs}
      utilityTabs={utilityNavTabs}
      refreshLabel={loading ? 'Refreshing...' : 'Refresh'}
      refreshDisabled={loading || exportingPdf}
      onRefresh={refetch}
      exportDisabled={exportingPdf}
      onExportCurrentPage={() => void handleExportPdf('current')}
      onExportAllPages={() => void handleExportPdf('all')}
      onLogout={handleLogout}
      exportProgress={exportingPdf ? exportProgress : null}
      exporting={exportingPdf}
    >
      {activeTab === 'imagelab' && <ImageLab />}
      {activeTab === 'ebay' && (
        <EbayTab
          authenticated={ebayAuthenticated}
          restoringSession={ebayRestoringSession}
          loading={ebayLoading}
          error={ebayError}
          inventoryItems={ebayInventoryItems}
          offers={ebayOffers}
          recentListings={ebayRecentListings}
          total={ebayTotal}
          refetch={ebayRefetch}
          disconnect={ebayDisconnect}
        />
      )}

      {activeTab === 'approval' && (
        <ListingApprovalTab
          selectedRecordId={approvalRecordId}
          onSelectRecord={navigateToApprovalRecord}
          onBackToList={navigateToApprovalList}
        />
      )}

      {activeTab === 'users' && (
        <UserManagementTab
          selectedUserId={userRecordId}
          onSelectUser={navigateToUserRecord}
          onBackToList={navigateToUsersList}
        />
      )}

      {activeTab === 'dashboard' && (
        <DashboardTab
          atLoading={atLoading}
          spLoading={spLoading}
          jfLoading={jfLoading}
          nonEmptyListings={nonEmptyListings}
          products={products}
          jfSubmissions={jfSubmissions}
          totalNewSubmissions={totalNewSubmissions}
          thisWeekSubs={metrics.thisWeekSubs}
          recentSubs={metrics.recentSubs}
          draftProducts={metrics.draftProducts}
          activeProducts={metrics.activeProducts}
          archivedProducts={metrics.archivedProducts}
          acquisitionCost={metrics.acquisitionCost}
          inventoryValue={metrics.inventoryValue}
          avgAskPrice={metrics.avgAskPrice}
          sellThroughPct={metrics.sellThroughPct}
          grossMarginPct={metrics.grossMarginPct}
          submissionsTrend={metrics.submissionsTrend}
          dealsTrend={metrics.dealsTrend}
          acquisitionTrend={metrics.acquisitionTrend}
          inventoryTrend={metrics.inventoryTrend}
          salesTrend={metrics.salesTrend}
          marginTrend={metrics.marginTrend}
          submissionDays={metrics.submissionDays}
          maxDayCount={metrics.maxDayCount}
          topBrands={metrics.topBrands}
          now={metrics.now}
          airtableInventoryValue={metrics.airtableInventoryValue}
          uniqueAirtableBrands={metrics.uniqueAirtableBrands}
          uniqueAirtableTypes={metrics.uniqueAirtableTypes}
          componentTypeSummary={metrics.componentTypeSummary}
          airtableBrandSummary={metrics.airtableBrandSummary}
          airtableDistributorSummary={metrics.airtableDistributorSummary}
          airtableTypeTable={metrics.airtableTypeTable}
          maxComponentTypeCount={metrics.maxComponentTypeCount}
          maxAirtableBrandCount={metrics.maxAirtableBrandCount}
          insights={metrics.insights}
          accessiblePages={accessiblePages}
          approvalLoading={approvalLoading}
          approvalError={approvalError}
          approvalTotal={approvalTotal}
          approvalApproved={approvalApproved}
          approvalPending={approvalPending}
          aiProvider={aiProvider}
          ebayAuthenticated={ebayAuthenticated}
          ebayRestoringSession={ebayRestoringSession}
          ebayLoading={ebayLoading}
          ebayError={ebayError}
          ebayTotal={ebayTotal}
          ebayPublishedCount={ebayPublishedCount}
          ebayDraftCount={ebayDraftCount}
          marketLoading={sharkLoading}
          marketError={sharkError?.message ?? null}
          marketCurrentSlug={currentSlug}
          marketListingCount={sharkListings.length}
          userCount={users.length}
          adminCount={adminCount}
          onSelectTab={navigateToTab}
        />
      )}

      {activeTab === 'airtable' && (
        <AirtableTab
          loading={atLoading}
          error={atError}
          listings={nonEmptyListings}
          displayValue={displayValue}
          hasValue={hasValue}
          recordTitle={recordTitle}
        />
      )}

      {activeTab === 'shopify' && (
        <ShopifyTab
          loading={spLoading}
          error={spError}
          products={products}
          storeDomain={import.meta.env.VITE_SHOPIFY_STORE_DOMAIN}
        />
      )}

      {activeTab === 'market' && (
        <MarketTab
          loading={sharkLoading}
          error={sharkError}
          listings={sharkListings}
          currentSlug={currentSlug}
          onSearch={sharkSearch}
        />
      )}

      {activeTab === 'jotform' && (
        <JotformTab
          submissions={jfSubmissions}
          loading={jfLoading}
          polling={jfPolling}
          error={jfError}
          refetch={jfRefetch}
          lastUpdated={jfLastUpdated}
          freshCount={jfFreshCount}
          clearFresh={jfClearFresh}
        />
      )}
    </AppFrame>
  );
}

export default App;
