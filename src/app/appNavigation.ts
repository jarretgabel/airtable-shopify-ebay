import { APP_PAGES, AppPage, PAGE_DEFINITIONS } from '@/auth/pages';

export type Tab = AppPage;

export const TAB_VALUES: Tab[] = [...APP_PAGES];

export const TAB_PATHS: Record<Tab, string> = Object.entries(PAGE_DEFINITIONS).reduce(
  (acc, [page, definition]) => {
    acc[page as Tab] = definition.path;
    return acc;
  },
  {} as Record<Tab, string>,
);

export const EBAY_TABS = ['ebay', 'approval'] as const satisfies readonly Tab[];
export const EBAY_TAB_SET = new Set<Tab>(EBAY_TABS as readonly Tab[]);
export const SHOPIFY_TABS = ['shopify', 'shopify-approval'] as const satisfies readonly Tab[];
export const SHOPIFY_TAB_SET = new Set<Tab>(SHOPIFY_TABS as readonly Tab[]);
export const UTILITY_TABS = ['market', 'imagelab'] as const satisfies readonly Tab[];
export const UTILITY_TAB_SET = new Set<Tab>(UTILITY_TABS as readonly Tab[]);

const NAV_LABELS: Partial<Record<Tab, string>> = {
  dashboard: 'Dashboard',
  airtable: 'Airtable',
  listings: 'Listings',
  shopify: 'Shopify',
  'shopify-approval': 'Listing Approval',
  market: 'HiFi Shark',
  jotform: 'JotForm',
  settings: 'Settings',
  notifications: 'Notifications',
  ebay: 'Listings',
  approval: 'Listing Approval',
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
