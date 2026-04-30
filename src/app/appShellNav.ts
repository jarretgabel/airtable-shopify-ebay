import { Tab, EBAY_TAB_SET, INVENTORY_PROCESSING_TAB_SET, SHOPIFY_TAB_SET, UTILITY_TAB_SET, navLabel } from './appNavigation';

interface NavTab {
  key: Tab;
  label: string;
  active: boolean;
  badgeCount?: number;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}

interface BuildNavTabsInput {
  visibleTabs: Tab[];
  activeTab: Tab;
  exportingPdf: boolean;
  approvalPending: number;
  shopifyApprovalPending: number;
  totalNewSubmissions: number;
  disabledTabReasons?: Partial<Record<Tab, string>>;
  navigateToTab: (tab: Tab) => void;
  navigateToApprovalList: () => void;
  navigateToUsersList: () => void;
}

export function buildAppFrameNavTabs(input: BuildNavTabsInput): {
  tabs: NavTab[];
  ebayNavTabs: NavTab[];
  inventoryProcessingNavTabs: NavTab[];
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
    disabledTabReasons = {},
    navigateToTab,
    navigateToApprovalList,
    navigateToUsersList,
  } = input;

  const resolveDisabledState = (tab: Tab) => ({
    disabled: exportingPdf || Boolean(disabledTabReasons[tab]),
    disabledReason: disabledTabReasons[tab],
  });

  const mainTabs = visibleTabs.filter((tab) => !UTILITY_TAB_SET.has(tab) && !EBAY_TAB_SET.has(tab) && !SHOPIFY_TAB_SET.has(tab) && !INVENTORY_PROCESSING_TAB_SET.has(tab) && tab !== 'settings' && tab !== 'users' && tab !== 'notifications');
  const postEbayTabs = visibleTabs.filter((tab) => !UTILITY_TAB_SET.has(tab) && !EBAY_TAB_SET.has(tab) && !SHOPIFY_TAB_SET.has(tab) && !INVENTORY_PROCESSING_TAB_SET.has(tab) && !mainTabs.includes(tab) && tab !== 'settings' && tab !== 'users' && tab !== 'notifications');
  const ebayTabs = visibleTabs.filter((tab) => EBAY_TAB_SET.has(tab));
  const inventoryProcessingTabs = visibleTabs.filter((tab) => INVENTORY_PROCESSING_TAB_SET.has(tab));
  const shopifyTabs = visibleTabs.filter((tab) => SHOPIFY_TAB_SET.has(tab));
  const utilityTabs = visibleTabs.filter((tab) => UTILITY_TAB_SET.has(tab));

  const tabs = mainTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: tab === 'jotform' ? totalNewSubmissions : undefined,
    ...resolveDisabledState(tab),
    onClick: () => navigateToTab(tab),
  }));

  const ebayNavTabs = ebayTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: tab === 'approval' ? approvalPending : undefined,
    ...resolveDisabledState(tab),
    onClick: () => (tab === 'approval' ? navigateToApprovalList() : navigateToTab(tab)),
  }));

  const inventoryProcessingNavTabs = inventoryProcessingTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: undefined,
    ...resolveDisabledState(tab),
    onClick: () => navigateToTab(tab),
  }));

  const shopifyNavTabs = shopifyTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: tab === 'shopify-approval' ? shopifyApprovalPending : undefined,
    ...resolveDisabledState(tab),
    onClick: () => navigateToTab(tab),
  }));

  const postEbayNavTabs = postEbayTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: undefined,
    ...resolveDisabledState(tab),
    onClick: () => navigateToTab(tab),
  }));

  const utilityNavTabs = utilityTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: undefined,
    ...resolveDisabledState(tab),
    onClick: () => (tab === 'users' ? navigateToUsersList() : navigateToTab(tab)),
  }));

  return { tabs, ebayNavTabs, inventoryProcessingNavTabs, shopifyNavTabs, postEbayNavTabs, utilityNavTabs };
}
