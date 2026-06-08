import { useState } from 'react';
import { recordTitle } from '@/app/appNavigation';
import { getPublishRequiredFieldValidationNotice } from '@/components/approval/listingApprovalActionValidation';
import { publishApprovalRecord } from '@/services/app-api/approval';
import { updateConfiguredRecord } from '@/services/app-api/airtable';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { resolveWorkflowStatusAfterPublish } from '@/services/usedGearWorkflowLifecycle';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  buildListingApprovalPublishErrorNotification,
  buildListingApprovalPublishResultNotification,
} from './listingApprovalResultSummary';
import type { UseListingApprovalRecordActionsParams } from './listingApprovalRecordActionTypes';

type PublishActionsParams = Pick<UseListingApprovalRecordActionsParams,
  'selectedRecord'
  | 'hasMissingShopifyRequiredFields'
  | 'hasMissingEbayRequiredFields'
  | 'isShopifyPublishBlockedByAuctionFormat'
  | 'missingShopifyRequiredFieldLabels'
  | 'missingEbayRequiredFieldLabels'
  | 'approvalPublishSource'
  | 'mergedDraftSourceFields'
  | 'workflowPublishSummary'
  | 'setFormValue'
  | 'pushInlineActionNotice'
  | 'requestConfirmation'
>;

export function useListingApprovalPublishActions({
  selectedRecord,
  hasMissingShopifyRequiredFields,
  hasMissingEbayRequiredFields,
  isShopifyPublishBlockedByAuctionFormat,
  missingShopifyRequiredFieldLabels,
  missingEbayRequiredFieldLabels,
  approvalPublishSource,
  mergedDraftSourceFields,
  workflowPublishSummary,
  setFormValue,
  pushInlineActionNotice,
  requestConfirmation,
}: PublishActionsParams) {
  const [pushingTarget, setPushingTarget] = useState<'shopify' | 'ebay' | 'both' | null>(null);
  const pushResultNotification = useNotificationStore.getState().upsertByKey;

  const persistWorkflowLifecycleWriteback = async (
    target: 'shopify' | 'ebay' | 'both',
    executionResult: Awaited<ReturnType<typeof publishApprovalRecord>>,
  ) => {
    if (!selectedRecord) return;

    const currentWorkflowStatus = getUsedGearWorkflowStatus(selectedRecord.fields);
    if (!currentWorkflowStatus) return;

    const publishedToShopify = Boolean(executionResult.shopify);
    const publishedToEbay = Boolean(executionResult.ebay);
    const nextWorkflowStatus = resolveWorkflowStatusAfterPublish({
      requestedTarget: target,
      currentStatus: currentWorkflowStatus,
      publishedToShopify,
      publishedToEbay,
    });

    if (!nextWorkflowStatus && !publishedToShopify && !publishedToEbay) {
      return;
    }

    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {};

    if (nextWorkflowStatus) {
      fields['Workflow Status'] = nextWorkflowStatus;
      if (typeof selectedRecord.fields['Listed At'] !== 'string' || selectedRecord.fields['Listed At'].trim().length === 0) {
        fields['Listed At'] = now;
      }
    }

    if (publishedToShopify) {
      fields['Shopify REST Published At'] = now;
      fields['Shopify REST Published Scope'] = typeof selectedRecord.fields['Shopify REST Published Scope'] === 'string'
        && selectedRecord.fields['Shopify REST Published Scope'].trim().length > 0
        ? selectedRecord.fields['Shopify REST Published Scope'].trim()
        : 'web';
      if (executionResult.shopify?.productId) {
        fields['Shopify REST Product ID'] = executionResult.shopify.productId;
      }
    }

    if (publishedToEbay) {
      fields['eBay Published At'] = now;
      if (executionResult.ebay?.offerId) {
        fields['eBay Offer ID'] = executionResult.ebay.offerId;
      }
      if (executionResult.ebay?.listingId) {
        fields['eBay Listing ID'] = executionResult.ebay.listingId;
      }
    }

    if (Object.keys(fields).length === 0) {
      return;
    }

    await updateConfiguredRecord(approvalPublishSource, selectedRecord.id, fields, { typecast: true });

    Object.entries(fields).forEach(([fieldName, value]) => {
      if (typeof value === 'string') {
        setFormValue(fieldName, value);
      }
    });
  };

  const runCombinedPush = async (target: 'shopify' | 'ebay' | 'both') => {
    if (!selectedRecord) return;

    if ((target === 'shopify' || target === 'both') && isShopifyPublishBlockedByAuctionFormat) {
      pushInlineActionNotice(
        'warning',
        'Shopify publish blocked',
        'Listing Format is set to Auction. Set Listing Format to Buy It Now before publishing to Shopify or Publish Both.',
      );
      return;
    }

    const validationNotice = getPublishRequiredFieldValidationNotice(target, {
      shopify: {
        hasMissingFields: hasMissingShopifyRequiredFields,
        missingFieldLabels: missingShopifyRequiredFieldLabels,
      },
      ebay: {
        hasMissingFields: hasMissingEbayRequiredFields,
        missingFieldLabels: missingEbayRequiredFieldLabels,
      },
    });

    if (validationNotice) {
      pushInlineActionNotice('warning', validationNotice.title, validationNotice.message);
      return;
    }

    const confirmed = await requestConfirmation({
      title: target === 'both' ? 'Publish to both channels' : `Publish to ${target === 'shopify' ? 'Shopify' : 'eBay'}`,
      message: 'Publish using the current page values rather than the last saved backend payload.',
      confirmLabel: target === 'both' ? 'Publish both' : `Publish ${target}`,
      bullets: [
        `Record: ${recordTitle(selectedRecord.fields)}`,
        `Target: ${target === 'both' ? 'Shopify and eBay' : target === 'shopify' ? 'Shopify' : 'eBay'}`,
        'Current in-page values will be used for the publish request.',
        ...(workflowPublishSummary ? [
          `Workflow status: ${workflowPublishSummary.workflowStatus || 'Not set'}`,
          `Resolved title: ${workflowPublishSummary.readiness.title || 'Missing title'}`,
          `Resolved price: ${workflowPublishSummary.readiness.price || 'Missing price'}`,
        ] : []),
      ],
      typedConfirmation: {
        expectedValue: target === 'both' ? 'PUBLISH BOTH' : `PUBLISH ${target.toUpperCase()}`,
        inputLabel: 'Type the publish command to confirm',
        helperText: 'Publishing can create or update live channel listings. Type the command exactly to continue.',
        placeholder: target === 'both' ? 'PUBLISH BOTH' : `PUBLISH ${target.toUpperCase()}`,
      },
    });
    if (!confirmed) return;

    setPushingTarget(target);
    try {
      const executionResult = await publishApprovalRecord(approvalPublishSource, selectedRecord.id, target, {
        productIdFieldName: 'Shopify REST Product ID',
        fields: mergedDraftSourceFields ?? undefined,
      });

      if (executionResult.shopify) {
        setFormValue('Shopify REST Product ID', executionResult.shopify.productId);
        executionResult.shopify.warnings.forEach((warning) => {
          pushInlineActionNotice('warning', 'Shopify publish warning', warning);
        });
        pushInlineActionNotice(
          'success',
          executionResult.shopify.mode === 'updated' ? 'Shopify listing updated' : 'Shopify listing created',
          `Shopify product #${executionResult.shopify.productId} was ${executionResult.shopify.mode}.`,
        );
      }

      if (executionResult.ebay) {
        pushInlineActionNotice(
          'success',
          executionResult.ebay.mode === 'updated' ? 'eBay listing updated' : 'eBay listing published',
          `SKU ${executionResult.ebay.sku} is live as listing ${executionResult.ebay.listingId} via offer ${executionResult.ebay.offerId}.`,
        );
      }

      executionResult.failures.forEach((failure) => {
        pushInlineActionNotice(
          'error',
          failure.target === 'shopify' ? 'Shopify publish failed' : 'eBay publish failed',
          failure.message,
        );
      });

      try {
        await persistWorkflowLifecycleWriteback(target, executionResult);
      } catch (writebackError) {
        const message = writebackError instanceof Error ? writebackError.message : 'Publish completed, but workflow lifecycle fields could not be updated.';
        pushInlineActionNotice('warning', 'Workflow lifecycle writeback failed', message);
      }

      pushResultNotification(
        `approval-publish-result:${selectedRecord.id}`,
        buildListingApprovalPublishResultNotification({
          record: selectedRecord,
          target,
          result: executionResult,
        }),
      );
    } catch (pushError) {
      const message = pushError instanceof Error ? pushError.message : 'Unable to push this listing.';
      pushInlineActionNotice('error', 'Publish failed', message);
      pushResultNotification(
        `approval-publish-result:${selectedRecord.id}`,
        buildListingApprovalPublishErrorNotification(selectedRecord, target, message),
      );
    } finally {
      setPushingTarget(null);
    }
  };

  return {
    pushingTarget,
    runCombinedPush,
  };
}