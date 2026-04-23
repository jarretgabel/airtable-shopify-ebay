export const APP_PAGES = [
  'dashboard',
  'airtable',
  'listings',
  'shopify',
  'market',
  'jotform',
  'request-form',
  'settings',
  'notifications',
  'imagelab',
  'ebay',
  'approval',
  'shopify-approval',
  'users',
] as const;

export type AppPage = (typeof APP_PAGES)[number];

export interface PageDefinition {
  label: string;
  path: string;
  adminOnly?: boolean;
}

export const PAGE_DEFINITIONS: Record<AppPage, PageDefinition> = {
  dashboard: { label: 'Dashboard', path: '/dashboard' },
  airtable: { label: 'Airtable Inventory', path: '/airtable' },
  listings: { label: 'Listings', path: '/listings' },
  shopify: { label: 'Shopify Products', path: '/shopify/products' },
  market: { label: 'Market Prices', path: '/market' },
  jotform: { label: 'Inquiries', path: '/jotform' },
  'request-form': { label: 'Incoming Gear Form', path: '/request-form' },
  settings: { label: 'Settings', path: '/account/settings' },
  notifications: { label: 'Notifications', path: '/account/notifications' },
  imagelab: { label: 'Image Lab', path: '/imagelab' },
  ebay: { label: 'eBay', path: '/ebay/listings' },
  approval: { label: 'eBay Listings Approvals', path: '/ebay/approval' },
  'shopify-approval': { label: 'Shopify Listings Approvals', path: '/shopify/approval' },
  users: { label: 'User Management', path: '/account/users', adminOnly: true },
};

export const ASSIGNABLE_PAGES: AppPage[] = APP_PAGES.filter((page) => page !== 'users' && page !== 'settings' && page !== 'notifications' && page !== 'request-form');
