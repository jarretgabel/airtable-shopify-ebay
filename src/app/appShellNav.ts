import { Tab, INTAKE_TAB_SET, INVENTORY_PROCESSING_TAB_SET, LISTINGS_TAB_SET, POST_PUBLISH_TAB_SET, UTILITY_TAB_SET, navLabel } from './appNavigation';

const FORM_ONLY_TAB_SET = new Set<Tab>(['testing', 'photos']);
const HIDDEN_TAB_SET = new Set<Tab>(['workflow-guide-editor']);

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
  workflowInventoryBadgeCount: number;
  listingsBadgeCount: number;
  disabledTabReasons?: Partial<Record<Tab, string>>;
  navigateToTab: (tab: Tab) => void;
  navigateToUsersList: () => void;
}

export function buildAppFrameNavTabs(input: BuildNavTabsInput): {
  tabs: NavTab[];
  intakeNavTabs: NavTab[];
  listingsNavTabs: NavTab[];
  postPublishNavTabs: NavTab[];
  inventoryProcessingNavTabs: NavTab[];
  postEbayNavTabs: NavTab[];
  utilityNavTabs: NavTab[];
} {
  const {
    visibleTabs,
    activeTab,
    exportingPdf,
    workflowInventoryBadgeCount,
    listingsBadgeCount,
    disabledTabReasons = {},
    navigateToTab,
    navigateToUsersList,
  } = input;

  const resolveDisabledState = (tab: Tab) => ({
    disabled: exportingPdf || Boolean(disabledTabReasons[tab]),
    disabledReason: disabledTabReasons[tab],
  });

  const navigableTabs = visibleTabs.filter((tab) => !FORM_ONLY_TAB_SET.has(tab) && !HIDDEN_TAB_SET.has(tab));

  const mainTabs = navigableTabs.filter((tab) => !UTILITY_TAB_SET.has(tab) && !LISTINGS_TAB_SET.has(tab) && !POST_PUBLISH_TAB_SET.has(tab) && !INTAKE_TAB_SET.has(tab) && !INVENTORY_PROCESSING_TAB_SET.has(tab) && tab !== 'settings' && tab !== 'users' && tab !== 'notifications');
  const postEbayTabs = navigableTabs.filter((tab) => !UTILITY_TAB_SET.has(tab) && !LISTINGS_TAB_SET.has(tab) && !POST_PUBLISH_TAB_SET.has(tab) && !INTAKE_TAB_SET.has(tab) && !INVENTORY_PROCESSING_TAB_SET.has(tab) && !mainTabs.includes(tab) && tab !== 'settings' && tab !== 'users' && tab !== 'notifications');
  const intakeTabs = navigableTabs.filter((tab) => INTAKE_TAB_SET.has(tab));
  const listingsTabs = navigableTabs.filter((tab) => LISTINGS_TAB_SET.has(tab));
  const postPublishTabs = navigableTabs.filter((tab) => POST_PUBLISH_TAB_SET.has(tab));
  const inventoryProcessingTabs = navigableTabs.filter((tab) => INVENTORY_PROCESSING_TAB_SET.has(tab));
  const utilityTabs = navigableTabs.filter((tab) => UTILITY_TAB_SET.has(tab));

  const tabs = mainTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: tab === 'inventory' ? workflowInventoryBadgeCount : undefined,
    ...resolveDisabledState(tab),
    onClick: () => navigateToTab(tab),
  }));

  const intakeNavTabs = intakeTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: undefined,
    ...resolveDisabledState(tab),
    onClick: () => navigateToTab(tab),
  }));

  const listingsNavTabs = listingsTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: tab === 'listings' ? listingsBadgeCount : undefined,
    ...resolveDisabledState(tab),
    onClick: () => navigateToTab(tab),
  }));

  const postPublishNavTabs = postPublishTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: undefined,
    ...resolveDisabledState(tab),
    onClick: () => navigateToTab(tab),
  }));

  const inventoryProcessingNavTabs = inventoryProcessingTabs.map((tab) => ({
    key: tab,
    label: navLabel(tab),
    active: activeTab === tab,
    badgeCount: undefined,
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

  return { tabs, intakeNavTabs, listingsNavTabs, postPublishNavTabs, inventoryProcessingNavTabs, postEbayNavTabs, utilityNavTabs };
}
