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
    description: 'Primary day-to-day pages for dashboard, directory, listings, and the role-appropriate commerce utilities.',
    pages: ['dashboard', 'inventory', 'listings', 'shopify', 'market', 'imagelab', 'ebay'],
  },
  {
    key: 'intake',
    title: 'Used Gear Intake',
    description: 'Parking Lot and Trash Review are the intake workflow assignments and should be granted intentionally.',
    pages: ['parking-lot-1', 'trash-review'],
  },
  {
    key: 'utility',
    title: 'Reference Tools',
    description: 'Reference-only utilities and source feeds that do not belong to the workflow intake queue. HiFi Shark is owner/developer/processor only, and Image Lab is available to every non-tester role.',
    pages: ['market', 'imagelab', 'jotform'],
  },
  {
    key: 'workflow',
    title: 'Workflow Queues',
    description: 'Dedicated queue pages for testing and photography handoffs.',
    pages: ['testing-queue', 'photography-queue'],
  },
  {
    key: 'post-publish',
    title: 'Post-Publish',
    description: 'Marketplace follow-through after Listings hands work off to stale and sold-ready lifecycle buckets.',
    pages: ['post-publish'],
  },
  {
    key: 'archive',
    title: 'Archive',
    description: 'Completed shipped items retained for lookup after the active post-publish workflow is finished.',
    pages: ['archive'],
  },
  {
    key: 'forms',
    title: 'Workflow Forms',
    description: 'Direct forms used by intake, testing, and photography operators to complete stage work.',
    pages: ['manual-intake', 'testing', 'photos'],
  },
  {
    key: 'developer',
    title: 'Developer Tools',
    description: 'Developer-only diagnostics and messaging surfaces outside the standard workflow pages.',
    pages: ['settings', 'notifications'],
  },
];