import { useCallback, type RefObject } from 'react';
import { TAB_VALUES } from '@/app/appNavigation';
import { buildAppFrameNavTabs } from '@/app/appShellNav';
import { exportPdf } from '@/app/pdfExport';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import type { Tab } from '@/app/appNavigation';
import { useNotificationStore } from '@/stores/notificationStore';

interface AppShellControlsParams {
  activeTab: Tab;
  visibleTabs: Tab[];
  approvalPending: number;
  shopifyApprovalPending: number;
  totalNewSubmissions: number;
  exportingPdf: boolean;
  dashboardRefreshing: boolean;
  setExportingPdf: (value: boolean) => void;
  setDashboardRefreshing: (value: boolean) => void;
  setExportProgress: (value: { current: number; total: number; label: string } | null) => void;
  canAccessPage: (tab: Tab) => boolean;
  shellRef: RefObject<HTMLElement | null>;
  navigateToTab: (tab: Tab, replace?: boolean) => void;
  navigateToApprovalList: (replace?: boolean) => void;
  navigateToUsersList: (replace?: boolean) => void;
  airtableRefetch: () => Promise<void>;
  shopifyRefetch: () => void | Promise<void>;
  jotformRefetch: () => void | Promise<void>;
  ebayRefetch: () => void | Promise<void>;
  approvalRefetch: () => Promise<void>;
  shopifyApprovalRefetch: () => Promise<void>;
  sharkSearch: (slug: string) => void;
  currentSlug: string;
  atLoading: boolean;
  spLoading: boolean;
  jfLoading: boolean;
}

export function useAppShellControls({
  activeTab,
  visibleTabs,
  approvalPending,
  shopifyApprovalPending,
  totalNewSubmissions,
  exportingPdf,
  dashboardRefreshing,
  setExportingPdf,
  setDashboardRefreshing,
  setExportProgress,
  canAccessPage,
  shellRef,
  navigateToTab,
  navigateToApprovalList,
  navigateToUsersList,
  airtableRefetch,
  shopifyRefetch,
  jotformRefetch,
  ebayRefetch,
  approvalRefetch,
  shopifyApprovalRefetch,
  sharkSearch,
  currentSlug,
  atLoading,
  spLoading,
  jfLoading,
}: AppShellControlsParams) {
  const pushNotification = useNotificationStore((state) => state.push);

  const handleDashboardRefresh = useCallback(async () => {
    if (dashboardRefreshing) return;

    setDashboardRefreshing(true);
    try {
      await Promise.all([
        airtableRefetch(),
        Promise.resolve(shopifyRefetch()),
        Promise.resolve(jotformRefetch()),
        Promise.resolve(canAccessPage('ebay') ? ebayRefetch() : undefined),
        approvalRefetch(),
        Promise.resolve(canAccessPage('shopify-approval') ? shopifyApprovalRefetch() : undefined),
        Promise.resolve(currentSlug ? sharkSearch(currentSlug) : undefined),
      ]);
      pushNotification({
        tone: 'success',
        title: 'Data refreshed',
        message: 'Review approval queues and dashboard alerts for items that need action.',
      });
      trackWorkflowEvent('data_refreshed', {
        tab: activeTab,
        currentSlug,
      });
    } catch {
      pushNotification({
        tone: 'error',
        title: 'Refresh failed',
        message: 'Some data sources did not refresh. Try again and verify API credentials if the issue persists.',
        actionLabel: 'Retry refresh',
        onAction: () => void handleDashboardRefresh(),
      });
    } finally {
      setDashboardRefreshing(false);
    }
  }, [activeTab, airtableRefetch, approvalRefetch, canAccessPage, currentSlug, dashboardRefreshing, ebayRefetch, jotformRefetch, pushNotification, setDashboardRefreshing, sharkSearch, shopifyApprovalRefetch, shopifyRefetch]);

  const tabLoadingState: Partial<Record<Tab, boolean>> = {
    dashboard: dashboardRefreshing,
    airtable: atLoading,
    shopify: spLoading,
    jotform: jfLoading,
  };

  const tabRefetchers: Partial<Record<Tab, () => void | Promise<void>>> = {
    dashboard: handleDashboardRefresh,
    airtable: airtableRefetch,
    shopify: shopifyRefetch,
    jotform: jotformRefetch,
  };

  const loading = tabLoadingState[activeTab] ?? false;
  const onRefresh = tabRefetchers[activeTab] ?? (() => {});

  const handleExportPdf = useCallback(async (mode: 'current' | 'all') => {
    try {
      await exportPdf(mode, TAB_VALUES, {
        activeTab,
        canAccessPage,
        exportingPdf,
        setExportingPdf,
        setExportProgress,
        shellElement: shellRef.current,
        navigateToTab,
      });

      pushNotification({
        tone: 'success',
        title: mode === 'all' ? 'Full report exported' : 'Page report exported',
        message: 'Open your Downloads folder and review the PDF before sharing it with your team.',
      });
      trackWorkflowEvent('pdf_exported', {
        mode,
        tab: activeTab,
      });
    } catch {
      pushNotification({
        tone: 'error',
        title: 'PDF export failed',
        message: 'The report could not be generated. Retry export after refreshing the page state.',
        actionLabel: 'Retry export',
        onAction: () => void handleExportPdf(mode),
      });
    }
  }, [activeTab, canAccessPage, exportingPdf, navigateToTab, pushNotification, setExportProgress, setExportingPdf, shellRef]);

  const { tabs, ebayNavTabs, shopifyNavTabs, postEbayNavTabs, utilityNavTabs } = buildAppFrameNavTabs({
    visibleTabs,
    activeTab,
    exportingPdf,
    approvalPending,
    shopifyApprovalPending,
    totalNewSubmissions,
    navigateToTab: (tab) => navigateToTab(tab),
    navigateToApprovalList: () => navigateToApprovalList(),
    navigateToUsersList: () => navigateToUsersList(),
  });

  return {
    loading,
    onRefresh,
    onExportCurrentPage: () => void handleExportPdf('current'),
    onExportAllPages: () => void handleExportPdf('all'),
    tabs,
    ebayNavTabs,
    shopifyNavTabs,
    postEbayNavTabs,
    utilityNavTabs,
  };
}