import { type AppPage } from '@/auth/pages';

export interface UserPageAccessGroup {
  key: string;
  title: string;
  description: string;
  pages: AppPage[];
}

export const USER_PAGE_ACCESS_GROUPS: UserPageAccessGroup[] = [
  {
    key: 'core',
    title: 'Core Workspace',
    description: 'Primary day-to-day pages for dashboard, directory, listings, and marketplace work.',
    pages: ['dashboard', 'inventory', 'listings', 'shopify', 'market', 'imagelab', 'ebay'],
  },
  {
    key: 'intake',
    title: 'Used Gear Intake',
    description: 'Parking Lot 1, Parking Lot 2, and Trash Review are separate assignments now and should be granted intentionally.',
    pages: ['jotform', 'parking-lot-2', 'trash-review'],
  },
  {
    key: 'workflow',
    title: 'Workflow Queues',
    description: 'Dedicated queue pages for testing, photography, and pre-listing review handoffs.',
    pages: ['testing-queue', 'photography-queue', 'pre-listing-queue'],
  },
  {
    key: 'forms',
    title: 'Workflow Forms',
    description: 'Direct forms used by intake, testing, and photography operators to complete stage work.',
    pages: ['incoming-gear', 'testing', 'photos'],
  },
];