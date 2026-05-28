export const APP_PAGES = [
  'dashboard',
  'workflow-guide',
  'workflow-guide-editor',
  'manual-intake',
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
  'jotform',
  'market',
  'settings',
  'notifications',
  'imagelab',
  'users',
] as const;

export type AppPage = (typeof APP_PAGES)[number];
export type UserRole = 'admin' | 'owner' | 'developer' | 'processor' | 'tester' | 'photographer';

export function hasFullAccessRole(role: UserRole): boolean {
  return role === 'admin' || role === 'owner' || role === 'developer';
}

const ROLE_ALLOWED_PAGES: Record<UserRole, AppPage[]> = {
  admin: APP_PAGES.filter((page) => page !== 'market'),
  owner: [...APP_PAGES],
  developer: [...APP_PAGES],
  processor: [
    'dashboard',
    'workflow-guide',
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
  ],
  tester: ['dashboard', 'workflow-guide', 'testing-queue', 'testing'],
  photographer: ['dashboard', 'workflow-guide', 'photography-queue', 'photos', 'imagelab'],
};

export function isAppPage(value: string): value is AppPage {
  return APP_PAGES.includes(value as AppPage);
}

export function normalizeAllowedPages(pages: AppPage[], role: UserRole): AppPage[] {
  const uniquePages = Array.from(new Set(pages.filter(isAppPage)));
  if (hasFullAccessRole(role)) {
    return [...ROLE_ALLOWED_PAGES[role]];
  }

  const allowedSet = new Set(ROLE_ALLOWED_PAGES[role]);
  const nextPages = new Set(uniquePages.filter((page) => allowedSet.has(page)));

  if (role === 'processor' && nextPages.has('inventory')) {
    ['manual-intake', 'jotform', 'parking-lot-1', 'trash-review', 'testing-queue', 'photography-queue', 'testing', 'photos', 'listings', 'post-publish', 'archive', 'shopify', 'ebay', 'settings', 'notifications'].forEach((page) => nextPages.add(page as AppPage));
  }

  return ROLE_ALLOWED_PAGES[role].filter((page) => nextPages.has(page));
}
