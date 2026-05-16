export const APP_PAGES = [
  'dashboard',
  'workflow-guide',
  'parking-lot-1',
  'parking-lot-2',
  'trash-review',
  'inventory',
  'testing-queue',
  'photography-queue',
  'manual-intake',
  'incoming-gear',
  'testing',
  'photos',
  'listings',
  'shopify',
  'ebay',
  'jotform',
  'market',
  'settings',
  'notifications',
  'imagelab',
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
  'workflow-guide': { label: 'Workflow Guide', path: '/workflow-guide' },
  inventory: { label: 'Directory', path: '/inventory' },
  listings: { label: 'Listings', path: '/listings' },
  shopify: { label: 'Shopify Products', path: '/shopify/products' },
  market: { label: 'Market Prices', path: '/market' },
  'parking-lot-1': { label: 'Parking Lot 1', path: '/parking-lot-1' },
  jotform: { label: 'JotForm', path: '/jotform' },
  'parking-lot-2': { label: 'Parking Lot 2', path: '/parking-lot-2' },
  'trash-review': { label: 'Trash Review', path: '/trash-review' },
  'testing-queue': { label: 'Testing Queue', path: '/workflow/testing' },
  'photography-queue': { label: 'Photography Queue', path: '/workflow/photography' },
  'manual-intake': { label: 'Manual Intake', path: '/inventory/manual-intake' },
  'incoming-gear': { label: 'Incoming Gear', path: '/incoming-gear' },
  testing: { label: 'Testing', path: '/testing' },
  photos: { label: 'Photos', path: '/photos' },
  settings: { label: 'Settings', path: '/account/settings' },
  notifications: { label: 'Notifications', path: '/account/notifications' },
  imagelab: { label: 'Image Lab', path: '/imagelab' },
  ebay: { label: 'eBay', path: '/ebay/listings' },
  users: { label: 'User Management', path: '/account/users', adminOnly: true },
};

export const ASSIGNABLE_PAGES: AppPage[] = APP_PAGES.filter((page) => page !== 'users' && page !== 'settings' && page !== 'notifications' && page !== 'manual-intake' && page !== 'incoming-gear' && page !== 'testing' && page !== 'photos');
