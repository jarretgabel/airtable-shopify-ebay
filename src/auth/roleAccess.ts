import type { AppPage } from '@/auth/pages';
import type { UserRole } from '@/stores/auth/authTypes';

const PROCESSOR_PAGES: AppPage[] = [
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
];

const TESTER_PAGES: AppPage[] = ['dashboard', 'testing-queue', 'testing'];
const PHOTOGRAPHER_PAGES: AppPage[] = ['dashboard', 'photography-queue', 'photos'];

export function hasFullAccessRole(role: UserRole): boolean {
  return role === 'admin' || role === 'owner';
}

export const ROLE_ALLOWED_PAGES: Record<UserRole, AppPage[]> = {
  admin: [
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
  ],
  owner: [
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
  ],
  processor: PROCESSOR_PAGES,
  tester: TESTER_PAGES,
  photographer: PHOTOGRAPHER_PAGES,
};

const PROCESSOR_LEGACY_EXPANSIONS: AppPage[] = [
  'testing-queue',
  'photography-queue',
  'pre-listing-queue',
  'incoming-gear',
  'testing',
  'photos',
];

export const WORKFLOW_DASHBOARD_PAGES: AppPage[] = [
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
];

export function getRoleDefaultPages(role: UserRole): AppPage[] {
  return [...ROLE_ALLOWED_PAGES[role]];
}

export function getRoleAssignablePages(role: UserRole): AppPage[] {
  return [...ROLE_ALLOWED_PAGES[role]];
}

export function normalizeRolePages(pages: AppPage[], role: UserRole): AppPage[] {
  if (hasFullAccessRole(role)) {
    return [...ROLE_ALLOWED_PAGES[role]];
  }

  const allowedSet = new Set(ROLE_ALLOWED_PAGES[role]);
  const nextPages = new Set(pages.filter((page) => allowedSet.has(page)));

  if (role === 'processor' && nextPages.has('inventory')) {
    PROCESSOR_LEGACY_EXPANSIONS.forEach((page) => nextPages.add(page));
  }

  return ROLE_ALLOWED_PAGES[role].filter((page) => nextPages.has(page));
}

export function canAccessWorkflowDashboard(accessiblePages: AppPage[]): boolean {
  return WORKFLOW_DASHBOARD_PAGES.some((page) => accessiblePages.includes(page));
}

export function canAccessCommerceDashboard(accessiblePages: AppPage[]): boolean {
  return accessiblePages.includes('shopify') || accessiblePages.includes('listings') || accessiblePages.includes('ebay');
}