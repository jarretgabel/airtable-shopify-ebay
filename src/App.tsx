import { useEffect, useRef, useState } from 'react';
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
import { useHiFiShark } from '@/hooks/useHiFiShark';
import { useJotFormInquiries } from '@/hooks/useJotForm';
import { useListings } from '@/hooks/useListings';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
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

const EXPORT_TABS = ['dashboard', 'airtable', 'shopify', 'market', 'jotform', 'imagelab', 'ebay'] as const satisfies readonly Tab[];
const EXPORT_TAB_LABELS: Record<(typeof EXPORT_TABS)[number], string> = {
  dashboard: 'Dashboard',
  airtable: 'Airtable Inventory',
  shopify: 'Shopify Products',
  market: 'Market Prices',
  jotform: 'JotForm Inquiries',
  imagelab: 'Image Lab',
  ebay: 'eBay',
};

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
  const { currentUser, accessiblePages, canAccessPage, logout } = useAuth();

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

  const loading = activeTab === 'airtable'
    ? atLoading
    : activeTab === 'shopify'
      ? spLoading
      : activeTab === 'jotform'
        ? jfLoading
        : false;

  const refetch = activeTab === 'airtable'
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

  async function handleExportPdf() {
    if (exportingPdf || !shellRef.current) {
      return;
    }

    const exportTabs = EXPORT_TABS.filter((tab) => canAccessPage(tab));
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
        setExportProgress({
          current: index + 1,
          total: exportTabs.length,
          label: EXPORT_TAB_LABELS[tab],
        });
        navigateToTab(tab, true);
        await waitForScreenRender();

        if (!shellRef.current) continue;

        await appendElementToPdf(pdf, shellRef.current, firstScreen, {
          title: EXPORT_TAB_LABELS[tab],
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

  const stats = [
    { label: 'Airtable Records', value: nonEmptyListings.length },
    { label: 'Shopify Products', value: products.length },
    { label: 'Shopify Active', value: products.filter((product) => product.status === 'active').length },
    { label: 'Market Listings', value: sharkListings.length || '—' },
    { label: 'New Inquiries', value: jfLoading ? '…' : totalNewSubmissions || '—' },
  ];

  const tabs = visibleTabs.map((tab) => ({
    key: tab,
    label: PAGE_DEFINITIONS[tab].label,
    active: activeTab === tab,
    badgeCount: tab === 'jotform' ? totalNewSubmissions : undefined,
    disabled: exportingPdf,
    onClick: () => tab === 'approval' ? navigateToApprovalList() : navigateToTab(tab),
  }));

  return (
    <AppFrame
      shellRef={shellRef}
      currentUserLabel={`${currentUser.name} · ${currentUser.role}`}
      stats={stats}
      tabs={tabs}
      heroMeta={(
        <>
          <p className="mb-2 text-slate-200/85">Airtable: <strong>{nonEmptyListings.length}</strong> records</p>
          <p className="mb-2 text-slate-200/85">Shopify: <strong>{products.length}</strong> products</p>
          <p className="mb-2 text-slate-200/85">Market: <strong>{sharkListings.length}</strong> listings{currentSlug ? ` for "${currentSlug}"` : ''}</p>
          <p className="m-0 text-slate-200/85">JotForm: <strong>{jfSubmissions.length}</strong> submissions{totalNewSubmissions > 0 ? ` · ${totalNewSubmissions} unread` : ''}</p>
        </>
      )}
      refreshLabel={loading ? 'Refreshing...' : 'Refresh'}
      refreshDisabled={loading || exportingPdf}
      onRefresh={refetch}
      exportLabel={exportingPdf ? 'Exporting PDF...' : 'Download PDF'}
      exportDisabled={exportingPdf}
      onExport={handleExportPdf}
      onLogout={handleLogout}
      exportProgress={exportingPdf ? exportProgress : null}
      exporting={exportingPdf}
    >
      {activeTab === 'imagelab' && <ImageLab />}
      {activeTab === 'ebay' && <EbayTab />}

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
