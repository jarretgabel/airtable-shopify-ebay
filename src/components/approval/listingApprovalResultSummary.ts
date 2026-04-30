import { recordTitle } from '@/app/appNavigation';
import type { ApprovalPublishExecutionResult, ApprovalPublishTarget } from '@/services/app-api/approval';
import type { NotificationTone } from '@/stores/notificationStore';
import type { AirtableRecord } from '@/types/airtable';

interface ApprovalResultNotification {
  key: string;
  tone: NotificationTone;
  title: string;
  message: string;
}

interface SaveResultNotificationParams {
  record: AirtableRecord;
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  changedFieldCount: number;
  succeeded: boolean;
  errorMessage?: string;
}

interface PublishResultNotificationParams {
  record: AirtableRecord;
  target: ApprovalPublishTarget;
  result: ApprovalPublishExecutionResult;
}

const approvalChannelLabelMap = {
  shopify: 'Shopify',
  ebay: 'eBay',
  combined: 'Combined',
} as const;

function formatCount(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function publishTargetLabel(target: ApprovalPublishTarget): string {
  if (target === 'both') return 'Shopify and eBay';
  return target === 'shopify' ? 'Shopify' : 'eBay';
}

export function buildListingApprovalSaveResultNotification({
  record,
  approvalChannel,
  changedFieldCount,
  succeeded,
  errorMessage,
}: SaveResultNotificationParams): ApprovalResultNotification {
  const title = succeeded ? 'Listing changes saved' : 'Listing save failed';
  const recordLabel = recordTitle(record.fields);
  const message = succeeded
    ? `${recordLabel} was saved to Airtable for the ${approvalChannelLabelMap[approvalChannel]} approval flow with ${formatCount('field', changedFieldCount)} updated.`
    : `${recordLabel} could not be saved to Airtable for the ${approvalChannelLabelMap[approvalChannel]} approval flow. ${errorMessage ?? 'Review the approval error section and try again.'}`;

  return {
    key: `approval-save-result:${record.id}`,
    tone: succeeded ? 'success' : 'error',
    title,
    message,
  };
}

export function buildListingApprovalPublishResultNotification({
  record,
  target,
  result,
}: PublishResultNotificationParams): ApprovalResultNotification {
  const shopifyWarningsCount = result.shopify?.warnings.length ?? 0;
  const successCount = Number(Boolean(result.shopify)) + Number(Boolean(result.ebay));
  const hasFailures = result.failures.length > 0;
  const tone: NotificationTone = hasFailures
    ? (successCount > 0 ? 'warning' : 'error')
    : (shopifyWarningsCount > 0 ? 'warning' : 'success');

  const messageParts = [`${recordTitle(record.fields)} publish target: ${publishTargetLabel(target)}.`];

  if (result.shopify) {
    messageParts.push(`Shopify product #${result.shopify.productId} was ${result.shopify.mode}.`);
  }

  if (result.ebay) {
    messageParts.push(`eBay SKU ${result.ebay.sku} is live as listing ${result.ebay.listingId}.`);
  }

  if (shopifyWarningsCount > 0) {
    messageParts.push(`${formatCount('Shopify warning', shopifyWarningsCount)} returned during publish.`);
  }

  if (result.failures.length > 0) {
    const failureSummary = result.failures
      .map((failure) => `${failure.target === 'shopify' ? 'Shopify' : 'eBay'}: ${failure.message}`)
      .join(' | ');
    messageParts.push(`Failures: ${failureSummary}`);
  }

  return {
    key: `approval-publish-result:${record.id}`,
    tone,
    title: tone === 'success'
      ? `Published to ${publishTargetLabel(target)}`
      : tone === 'warning'
        ? 'Publish completed with issues'
        : 'Publish failed',
    message: messageParts.join(' '),
  };
}

export function buildListingApprovalPublishErrorNotification(
  record: AirtableRecord,
  target: ApprovalPublishTarget,
  errorMessage: string,
): ApprovalResultNotification {
  return {
    key: `approval-publish-result:${record.id}`,
    tone: 'error',
    title: 'Publish failed',
    message: `${recordTitle(record.fields)} could not be published to ${publishTargetLabel(target)}. ${errorMessage}`,
  };
}