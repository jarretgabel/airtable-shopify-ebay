import { Tab, EBAY_TAB_SET, SHOPIFY_TAB_SET, UTILITY_TAB_SET, navLabel } from './appNavigation';

interface NavTab {
  key: Tab;
  label: string;
  active: boolean;
  badgeCount?: number;
  disabled?: boolean;
  onClick: () => void;
}

interface BuildNavTabsInput {
  visibleTabs: Tab[];
  activeTab: Tab;
  exportingPdf: boolean;
  approvalPending: number;
  shopifyApprovalPending: number;
  totalNewSubmissions: number;
  navigateToTab: (tab: Tab) => void;
  navigateToApprovalList: () => void;
  navigateToUsersList: () => void;
}

export function buildAppFrameNavTabs(input: BuildNavTabsInput): {
  tabs: NavTab[];
  ebayNavTabs: NavTab[];
  shopifyNavTabs: NavTab[];
  postEbayNavTabs: NavTab[];
  utilityNavTabs: NavTab[];
} {
  const {
    visibleTabs,
    activeTab,
    exportingPdf,
    approvalPending,
    shopifyApprovalPending,
    totalNewSubmissions,
    navigateToTab,
    navigateToApprovalList,
    navigateToUsersList,
  } = input;

  const mainTabs = visibleTabs.filter((tab) => !UTILITY_TAB_SET.has(tab) && !EBAY_TAB_SET.has(tab) && !SHOPIFY_TAB_SET.has(tab) && tab !== 'market' && tab !== 'imagelab' && tab !== 'settings' && tab !== 'users' && tab !== 'notifications');
  const postEbayTabs = visibleTabs
    .filter((tab) => tab === 'market' || tab === 'imagelab')
    .sort((a, b) => {
      if (a === b) return 0;
      if (a === 'imagelab') return 1;
      if (b === 'imagelab') return -1;
      return 0;
    });
  const ebayTabs = visibleTabs.filter((tab) => EBAY_TAB_SET.has(tab));
  const shopifyTabs = visibleTabs.filter((tab) => SHOPIFY_TAB_SET.has(tab));
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
    onClick: () => (tab === 'approval' ? navigateToApprovalList() : navigateToTab(tab)),
  }));

  const shopifyNavTabs = shopifyTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: tab === 'shopify-approval' ? shopifyApprovalPending : undefined,
    disabled: exportingPdf,
    onClick: () => navigateToTab(tab),
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
    onClick: () => (tab === 'users' ? navigateToUsersList() : navigateToTab(tab)),
  }));

  return { tabs, ebayNavTabs, shopifyNavTabs, postEbayNavTabs, utilityNavTabs };
}
