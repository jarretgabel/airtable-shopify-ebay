import { useEffect } from 'react';
import type { Tab } from '@/app/appNavigation';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';
import { useNotificationStore } from '@/stores/notificationStore';

interface ActionGuidanceParams {
  canAccessPage: (tab: Tab) => boolean;
  navigateToTab: (tab: Tab, replace?: boolean) => void;
  navigateToInventoryPostPublishBucket: (bucket: UsedGearWorkflowPostPublishBucket, options?: { replace?: boolean }) => void;
  onRefresh: () => void;
  approvalPending: number;
  shopifyApprovalPending: number;
  totalNewSubmissions: number;
  ebayAuthenticated: boolean;
  workflowPostPublishStaleListingCount: number;
  workflowPostPublishSoldReadyCount: number;
  atError?: string | Error | null;
  workflowError?: string | Error | null;
  spError?: string | Error | null;
  jfError?: string | Error | null;
  ebayError?: string | Error | null;
}

const ACTION_KEYS = {
  ebayApproval: 'guidance-ebay-approval',
  shopifyApproval: 'guidance-shopify-approval',
  jotform: 'guidance-jotform-submissions',
  ebayConnect: 'guidance-ebay-connect',
  usedGearStale: 'guidance-used-gear-stale-listings',
  usedGearSoldReady: 'guidance-used-gear-sold-ready',
  dataError: 'guidance-data-errors',
} as const;

export function useActionGuidanceNotifications({
  canAccessPage,
  navigateToTab,
  navigateToInventoryPostPublishBucket,
  onRefresh,
  approvalPending,
  shopifyApprovalPending,
  totalNewSubmissions,
  ebayAuthenticated,
  workflowPostPublishStaleListingCount,
  workflowPostPublishSoldReadyCount,
  atError,
  workflowError,
  spError,
  jfError,
  ebayError,
}: ActionGuidanceParams): void {
  const upsertByKey = useNotificationStore((state) => state.upsertByKey);
  const dismissByKey = useNotificationStore((state) => state.dismissByKey);

  useEffect(() => {
    if (!canAccessPage('listings') || approvalPending <= 0) {
      dismissByKey(ACTION_KEYS.ebayApproval);
      return;
    }

    upsertByKey(ACTION_KEYS.ebayApproval, {
      tone: 'warning',
      title: 'eBay listings need review',
      message: `${approvalPending} listing${approvalPending === 1 ? '' : 's'} are waiting for review. Open Listings to continue the combined approval workflow.`,
      actionLabel: 'Open Listings',
      onAction: () => navigateToTab('listings'),
      dismissible: true,
    });
  }, [approvalPending, canAccessPage, dismissByKey, navigateToTab, upsertByKey]);

  useEffect(() => {
    if (!canAccessPage('listings') || shopifyApprovalPending <= 0) {
      dismissByKey(ACTION_KEYS.shopifyApproval);
      return;
    }

    upsertByKey(ACTION_KEYS.shopifyApproval, {
      tone: 'warning',
      title: 'Shopify listings need review',
      message: `${shopifyApprovalPending} listing${shopifyApprovalPending === 1 ? '' : 's'} are waiting for review. Open Listings to continue the combined approval workflow.`,
      actionLabel: 'Open Listings',
      onAction: () => navigateToTab('listings'),
      dismissible: true,
    });
  }, [canAccessPage, dismissByKey, navigateToTab, shopifyApprovalPending, upsertByKey]);

  useEffect(() => {
    if (!canAccessPage('jotform') || totalNewSubmissions <= 0) {
      dismissByKey(ACTION_KEYS.jotform);
      return;
    }

    upsertByKey(ACTION_KEYS.jotform, {
      tone: 'info',
      title: 'New JotForm submissions',
      message: `${totalNewSubmissions} new submission${totalNewSubmissions === 1 ? '' : 's'} arrived. Review incoming requests to keep the pipeline moving.`,
      actionLabel: 'Open Parking Lot 1',
      onAction: () => navigateToTab('jotform'),
      dismissible: true,
    });
  }, [canAccessPage, dismissByKey, navigateToTab, totalNewSubmissions, upsertByKey]);

  useEffect(() => {
    if (!canAccessPage('ebay') || ebayAuthenticated) {
      dismissByKey(ACTION_KEYS.ebayConnect);
      return;
    }

    upsertByKey(ACTION_KEYS.ebayConnect, {
      tone: 'info',
      title: 'Connect eBay before publishing',
      message: 'Your eBay session is disconnected. Connect your account in the eBay tab before creating or publishing listings.',
      actionLabel: 'Open eBay tab',
      onAction: () => navigateToTab('ebay'),
      dismissible: true,
    });
  }, [canAccessPage, dismissByKey, ebayAuthenticated, navigateToTab, upsertByKey]);

  useEffect(() => {
    if (!canAccessPage('inventory') || workflowPostPublishSoldReadyCount <= 0) {
      dismissByKey(ACTION_KEYS.usedGearSoldReady);
      return;
    }

    upsertByKey(ACTION_KEYS.usedGearSoldReady, {
      tone: 'warning',
      title: 'Used gear shipments need attention',
      message: `${workflowPostPublishSoldReadyCount} used-gear item${workflowPostPublishSoldReadyCount === 1 ? '' : 's'} are sold and ready to ship. Move them through the post-publish workflow queue.`,
      actionLabel: 'Open Sold Ready queue',
      onAction: () => navigateToInventoryPostPublishBucket('sold-ready'),
      dismissible: true,
    });
  }, [canAccessPage, dismissByKey, navigateToInventoryPostPublishBucket, upsertByKey, workflowPostPublishSoldReadyCount]);

  useEffect(() => {
    if (!canAccessPage('inventory') || workflowPostPublishStaleListingCount <= 0) {
      dismissByKey(ACTION_KEYS.usedGearStale);
      return;
    }

    upsertByKey(ACTION_KEYS.usedGearStale, {
      tone: 'info',
      title: 'Used gear listings are stale',
      message: `${workflowPostPublishStaleListingCount} used-gear listing${workflowPostPublishStaleListingCount === 1 ? ' needs' : 's need'} stale-listing review. Check pricing, marketplace coverage, and sell-through next steps.`,
      actionLabel: 'Open Stale queue',
      onAction: () => navigateToInventoryPostPublishBucket('stale-listing'),
      dismissible: true,
    });
  }, [canAccessPage, dismissByKey, navigateToInventoryPostPublishBucket, upsertByKey, workflowPostPublishStaleListingCount]);

  useEffect(() => {
    const activeError = [
      { tab: 'inventory' as const, message: atError ?? workflowError },
      { tab: 'shopify' as const, message: spError },
      { tab: 'jotform' as const, message: jfError },
      { tab: 'ebay' as const, message: ebayError },
    ].find((item) => Boolean(item.message) && canAccessPage(item.tab));

    if (!activeError) {
      dismissByKey(ACTION_KEYS.dataError);
      return;
    }

    upsertByKey(ACTION_KEYS.dataError, {
      tone: 'error',
      title: 'Data sync attention required',
      message: `${activeError.tab.toUpperCase()} reported an error. Refresh now, then review credentials and API settings if it keeps failing.`,
      actionLabel: 'Refresh now',
      onAction: onRefresh,
      dismissible: true,
    });
  }, [atError, canAccessPage, dismissByKey, ebayError, jfError, onRefresh, spError, upsertByKey, workflowError]);
}
