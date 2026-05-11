export const APP_PAGES = [
  'dashboard',
  'inventory',
  'listings',
  'shopify',
  'market',
  'jotform',
  'parking-lot-2',
  'trash-review',
  'testing-queue',
  'photography-queue',
  'pre-listing-queue',
  'incoming-gear',
  'testing',
  'photos',
  'settings',
  'notifications',
  'imagelab',
  'ebay',
  'users',
] as const;

export type AppPage = (typeof APP_PAGES)[number];
export type UserRole = 'admin' | 'owner' | 'processor' | 'tester' | 'photographer';

export function hasFullAccessRole(role: UserRole): boolean {
  return role === 'admin' || role === 'owner';
}

const ROLE_ALLOWED_PAGES: Record<UserRole, AppPage[]> = {
  admin: [...APP_PAGES],
  owner: [...APP_PAGES],
  processor: [
    'dashboard',
    'inventory',
    'jotform',
    'parking-lot-2',
    'trash-review',
    'testing-queue',
    'photography-queue',
    'pre-listing-queue',
    'incoming-gear',
    'testing',
    'photos',
  ],
  tester: ['dashboard', 'testing-queue', 'testing'],
  photographer: ['dashboard', 'photography-queue', 'photos'],
};

export function isAppPage(value: string): value is AppPage {
  return APP_PAGES.includes(value as AppPage);
}

export function normalizeAllowedPages(pages: AppPage[], role: UserRole): AppPage[] {
  const uniquePages = Array.from(new Set(pages.filter(isAppPage)));
  if (hasFullAccessRole(role)) {
    return [...APP_PAGES];
  }

  const allowedSet = new Set(ROLE_ALLOWED_PAGES[role]);
  const nextPages = new Set(uniquePages.filter((page) => allowedSet.has(page)));

  if (role === 'processor' && nextPages.has('inventory')) {
    ['testing-queue', 'photography-queue', 'pre-listing-queue', 'incoming-gear', 'testing', 'photos'].forEach((page) => nextPages.add(page as AppPage));
  }

  return ROLE_ALLOWED_PAGES[role].filter((page) => nextPages.has(page));
}
