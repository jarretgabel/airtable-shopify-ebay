import type { AppPage } from '@/auth/pages';
import type { UserRole } from '@/stores/auth/authTypes';

const PROCESSOR_PAGES: AppPage[] = [
  'dashboard',
  'workflow-guide',
  'inventory',
  'parking-lot-1',
  'parking-lot-2',
  'trash-review',
  'testing-queue',
  'photography-queue',
  'pre-listing-queue',
  'incoming-gear',
  'testing',
  'photos',
  'market',
  'imagelab',
];

const TESTER_PAGES: AppPage[] = ['dashboard', 'workflow-guide', 'testing-queue', 'testing'];
const PHOTOGRAPHER_PAGES: AppPage[] = ['dashboard', 'workflow-guide', 'photography-queue', 'photos', 'imagelab'];
const DEVELOPER_PAGES: AppPage[] = ['dashboard', 'workflow-guide', 'jotform', 'market', 'imagelab', 'settings', 'notifications'];

export function hasFullAccessRole(role: UserRole): boolean {
  return role === 'admin' || role === 'owner';
}

export function isDeveloperRole(role: UserRole): boolean {
  return role === 'developer';
}

export const ROLE_ALLOWED_PAGES: Record<UserRole, AppPage[]> = {
  admin: [
    'dashboard',
    'workflow-guide',
    'inventory',
    'listings',
    'shopify',
    'parking-lot-1',
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
    'workflow-guide',
    'inventory',
    'listings',
    'shopify',
    'market',
    'parking-lot-1',
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
  developer: DEVELOPER_PAGES,
  processor: PROCESSOR_PAGES,
  tester: TESTER_PAGES,
  photographer: PHOTOGRAPHER_PAGES,
};

const PROCESSOR_LEGACY_EXPANSIONS: AppPage[] = [
  'parking-lot-1',
  'parking-lot-2',
  'trash-review',
  'testing-queue',
  'photography-queue',
  'pre-listing-queue',
  'incoming-gear',
  'testing',
  'photos',
];

export const WORKFLOW_DASHBOARD_PAGES: AppPage[] = [
  'inventory',
  'parking-lot-1',
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

  const roleAllowedPages = ROLE_ALLOWED_PAGES[role];
  const allowedSet = new Set(roleAllowedPages);
  const nextPages = new Set(pages.filter((page) => allowedSet.has(page)));

  // Keep the shared reference guide available to existing users whose stored page bundles predate it.
  if (allowedSet.has('workflow-guide')) {
    nextPages.add('workflow-guide');
  }

  if (role === 'processor' && nextPages.has('inventory')) {
    PROCESSOR_LEGACY_EXPANSIONS.forEach((page) => nextPages.add(page));
  }

  return roleAllowedPages.filter((page) => nextPages.has(page));
}

export function canAccessWorkflowDashboard(accessiblePages: AppPage[]): boolean {
  return WORKFLOW_DASHBOARD_PAGES.some((page) => accessiblePages.includes(page));
}

export function canAccessCommerceDashboard(accessiblePages: AppPage[]): boolean {
  return accessiblePages.includes('shopify') || accessiblePages.includes('listings') || accessiblePages.includes('ebay');
}