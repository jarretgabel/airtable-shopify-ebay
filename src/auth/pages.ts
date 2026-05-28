export const APP_PAGES = [
  'dashboard',
  'workflow-guide',
  'workflow-guide-editor',
  'manual-intake',
  'jotform',
  'parking-lot-1',
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
  'workflow-guide-editor': { label: 'User Guide Admin', path: '/workflow-guide/edit', adminOnly: true },
  'manual-intake': { label: 'Manual Intake', path: '/manual-intake' },
  jotform: { label: 'JotForm', path: '/jotform' },
  inventory: { label: 'Workflow Hub', path: '/workflow-hub' },
  listings: { label: 'Listings', path: '/listings' },
  'post-publish': { label: 'Post-Publish', path: '/workflow/post-publish' },
  archive: { label: 'Completed Shipments', path: '/workflow/archive' },
  shopify: { label: 'Shopify Products', path: '/shopify/products' },
  market: { label: 'Market Prices', path: '/market' },
  'parking-lot-1': { label: 'Parking Lot', path: '/parking-lot-1' },
  'trash-review': { label: 'Trash Review', path: '/trash-review' },
  'testing-queue': { label: 'Testing Queue', path: '/testing' },
  'photography-queue': { label: 'Photography Queue', path: '/photography' },
  testing: { label: 'Testing', path: '/testing' },
  photos: { label: 'Photos', path: '/photography' },
  settings: { label: 'Settings', path: '/account/settings' },
  notifications: { label: 'Notifications', path: '/account/notifications' },
  imagelab: { label: 'Image Lab', path: '/imagelab' },
  ebay: { label: 'eBay', path: '/ebay/listings' },
  users: { label: 'User Management', path: '/account/users', adminOnly: true },
};

export const ASSIGNABLE_PAGES: AppPage[] = APP_PAGES.filter((page) => page !== 'users' && page !== 'workflow-guide-editor' && page !== 'settings' && page !== 'notifications' && page !== 'manual-intake' && page !== 'testing' && page !== 'photos');
