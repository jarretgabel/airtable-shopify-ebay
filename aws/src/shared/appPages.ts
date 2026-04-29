export const APP_PAGES = [
  'dashboard',
  'inventory',
  'listings',
  'shopify',
  'market',
  'jotform',
  'incoming-gear',
  'testing',
  'photos',
  'settings',
  'notifications',
  'imagelab',
  'ebay',
  'approval',
  'shopify-approval',
  'users',
] as const;

export type AppPage = (typeof APP_PAGES)[number];
export type UserRole = 'admin' | 'user';

const NON_ADMIN_RESTRICTED_PAGES = new Set<AppPage>(['users', 'settings', 'notifications']);

export function isAppPage(value: string): value is AppPage {
  return APP_PAGES.includes(value as AppPage);
}

export function normalizeAllowedPages(pages: AppPage[], role: UserRole): AppPage[] {
  const uniquePages = Array.from(new Set(pages.filter(isAppPage)));
  if (role === 'admin') {
    return [...APP_PAGES];
  }

  return uniquePages.filter((page) => !NON_ADMIN_RESTRICTED_PAGES.has(page));
}
