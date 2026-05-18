export const APP_PAGES = [
  'dashboard',
  'workflow-guide',
  'manual-intake',
  'jotform',
  'parking-lot-1',
  'parking-lot-2',
  'trash-review',
  'inventory',
  'testing-queue',
  'photography-queue',
  'testing',
  'photos',
  'listings',
  'post-publish',
  'archive',
  'shopify',
  'ebay',
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
  'workflow-guide': { label: 'User Guide', path: '/workflow-guide' },
  'manual-intake': { label: 'Manual Intake', path: '/manual-intake' },
  jotform: { label: 'JotForm', path: '/jotform' },
  inventory: { label: 'Workflow Hub', path: '/workflow-hub' },
  listings: { label: 'Listings', path: '/listings' },
  'post-publish': { label: 'Post-Publish', path: '/workflow/post-publish' },
  archive: { label: 'Completed Shipments', path: '/workflow/archive' },
  shopify: { label: 'Shopify Products', path: '/shopify/products' },
  market: { label: 'Market Prices', path: '/market' },
  'parking-lot-1': { label: 'Parking Lot 1', path: '/parking-lot-1' },
  'parking-lot-2': { label: 'Parking Lot 2', path: '/parking-lot-2' },
  'trash-review': { label: 'Trash Review', path: '/trash-review' },
  'testing-queue': { label: 'Testing Queue', path: '/workflow/testing' },
  'photography-queue': { label: 'Photography Queue', path: '/workflow/photography' },
  testing: { label: 'Testing', path: '/testing' },
  photos: { label: 'Photos', path: '/photos' },
  settings: { label: 'Settings', path: '/account/settings' },
  notifications: { label: 'Notifications', path: '/account/notifications' },
  imagelab: { label: 'Image Lab', path: '/imagelab' },
  ebay: { label: 'eBay', path: '/ebay/listings' },
  users: { label: 'User Management', path: '/account/users', adminOnly: true },
};

export const ASSIGNABLE_PAGES: AppPage[] = APP_PAGES.filter((page) => page !== 'users' && page !== 'settings' && page !== 'notifications' && page !== 'manual-intake' && page !== 'testing' && page !== 'photos');
