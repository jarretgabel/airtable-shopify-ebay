import { APP_PAGES, AppPage, PAGE_DEFINITIONS } from '@/auth/pages';
import { displayReadableValue } from '@/utils/valueDisplay';

export type Tab = AppPage;

export const TAB_VALUES: Tab[] = [...APP_PAGES];

export const TAB_PATHS: Record<Tab, string> = Object.entries(PAGE_DEFINITIONS).reduce(
  (acc, [page, definition]) => {
    acc[page as Tab] = definition.path;
    return acc;
  },
  {} as Record<Tab, string>,
);

export const LISTINGS_TABS = ['listings', 'post-publish', 'archive', 'shopify', 'ebay'] as const satisfies readonly Tab[];
export const LISTINGS_TAB_SET = new Set<Tab>(LISTINGS_TABS as readonly Tab[]);
export const POST_PUBLISH_TABS = [] as const satisfies readonly Tab[];
export const POST_PUBLISH_TAB_SET = new Set<Tab>(POST_PUBLISH_TABS as readonly Tab[]);
export const INTAKE_TABS = ['manual-intake', 'jotform', 'parking-lot-1', 'parking-lot-2', 'trash-review'] as const satisfies readonly Tab[];
export const INTAKE_TAB_SET = new Set<Tab>(INTAKE_TABS as readonly Tab[]);
export const INVENTORY_PROCESSING_TABS = ['testing-queue', 'photography-queue', 'testing', 'photos'] as const satisfies readonly Tab[];
export const INVENTORY_PROCESSING_TAB_SET = new Set<Tab>(INVENTORY_PROCESSING_TABS as readonly Tab[]);
export const UTILITY_TABS = ['workflow-guide', 'market', 'imagelab'] as const satisfies readonly Tab[];
export const UTILITY_TAB_SET = new Set<Tab>(UTILITY_TABS as readonly Tab[]);

const NAV_LABELS: Partial<Record<Tab, string>> = {
  dashboard: 'Dashboard',
  'workflow-guide': 'User Guide',
  inventory: 'Workflow Hub',
  listings: 'Listings',
  'post-publish': 'Post-Publish',
  archive: 'Completed Shipments',
  shopify: 'Shopify',
  market: 'HiFi Shark',
  'manual-intake': 'Manual Intake',
  'parking-lot-1': 'Parking Lot 1',
  jotform: 'JotForm',
  'parking-lot-2': 'Parking Lot 2',
  'trash-review': 'Trash Review',
  'testing-queue': 'Testing Queue',
  'photography-queue': 'Photography Queue',
  testing: 'Testing Record',
  photos: 'Photos Record',
  settings: 'Settings',
  notifications: 'Notifications',
  ebay: 'eBay',
  imagelab: 'Image Lab',
  users: 'User Management',
};

export function isTab(value: string | null): value is Tab {
  return Boolean(value && TAB_VALUES.includes(value as Tab));
}

export function navLabel(tab: Tab): string {
  return NAV_LABELS[tab] ?? PAGE_DEFINITIONS[tab].label;
}

export function displayValue(value: unknown): string {
  return displayReadableValue(value, 'N/A');
}

export function hasValue(value: unknown): boolean {
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

export function hasNonEmptyFields(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some((value) => hasValue(value));
}

export function recordTitle(fields: Record<string, unknown>): string {
  return displayValue(fields.Brand ?? fields.Name ?? fields.Model ?? 'Untitled Listing');
}

export function waitForScreenRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 120);
      });
    });
  });
}
