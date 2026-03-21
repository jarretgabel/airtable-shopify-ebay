import { useEffect } from 'react';
import type { Tab } from '@/app/appNavigation';
import { useNotificationStore } from '@/stores/notificationStore';

interface ActionGuidanceParams {
  canAccessPage: (tab: Tab) => boolean;
  navigateToTab: (tab: Tab, replace?: boolean) => void;
  onRefresh: () => void;
  approvalPending: number;
  shopifyApprovalPending: number;
  totalNewSubmissions: number;
  ebayAuthenticated: boolean;
  atError?: string | Error | null;
  spError?: string | Error | null;
  jfError?: string | Error | null;
  ebayError?: string | Error | null;
}

const ACTION_KEYS = {
  ebayApproval: 'guidance-ebay-approval',
  shopifyApproval: 'guidance-shopify-approval',
  jotform: 'guidance-jotform-submissions',
  ebayConnect: 'guidance-ebay-connect',
  dataError: 'guidance-data-errors',
} as const;

export function useActionGuidanceNotifications({
  canAccessPage,
  navigateToTab,
  onRefresh,
  approvalPending,
  shopifyApprovalPending,
  totalNewSubmissions,
  ebayAuthenticated,
  atError,
  spError,
  jfError,
  ebayError,
}: ActionGuidanceParams): void {
  const upsertByKey = useNotificationStore((state) => state.upsertByKey);
  const dismissByKey = useNotificationStore((state) => state.dismissByKey);

  useEffect(() => {
    if (!canAccessPage('approval') || approvalPending <= 0) {
      dismissByKey(ACTION_KEYS.ebayApproval);
      return;
    }

    upsertByKey(ACTION_KEYS.ebayApproval, {
      tone: 'warning',
      title: 'eBay approvals need review',
      message: `${approvalPending} listing${approvalPending === 1 ? '' : 's'} are waiting for approval. Review the queue before publishing more inventory.`,
      actionLabel: 'Review eBay queue',
      onAction: () => navigateToTab('approval'),
      dismissible: true,
    });
  }, [approvalPending, canAccessPage, dismissByKey, navigateToTab, upsertByKey]);

  useEffect(() => {
    if (!canAccessPage('shopify-approval') || shopifyApprovalPending <= 0) {
      dismissByKey(ACTION_KEYS.shopifyApproval);
      return;
    }

    upsertByKey(ACTION_KEYS.shopifyApproval, {
      tone: 'warning',
      title: 'Shopify approvals need review',
      message: `${shopifyApprovalPending} listing${shopifyApprovalPending === 1 ? '' : 's'} are waiting in Shopify approval. Resolve these before the next sync cycle.`,
      actionLabel: 'Review Shopify queue',
      onAction: () => navigateToTab('shopify-approval'),
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
      actionLabel: 'Open JotForm tab',
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
    const activeError = [
      { tab: 'airtable' as const, message: atError },
      { tab: 'shopify' as const, message: spError },
      { tab: 'jotform' as const, message: jfError },
      { tab: 'ebay' as const, message: ebayError },
    ].find((item) => Boolean(item.message));

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
  }, [atError, dismissByKey, ebayError, jfError, onRefresh, spError, upsertByKey]);
}
