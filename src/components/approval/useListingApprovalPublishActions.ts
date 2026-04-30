import { useState } from 'react';
import { recordTitle } from '@/app/appNavigation';
import { getPublishRequiredFieldValidationNotice } from '@/components/approval/listingApprovalActionValidation';
import { publishApprovalRecord } from '@/services/app-api/approval';
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
  | 'missingShopifyRequiredFieldLabels'
  | 'missingEbayRequiredFieldLabels'
  | 'approvalPublishSource'
  | 'mergedDraftSourceFields'
  | 'setFormValue'
  | 'pushInlineActionNotice'
  | 'requestConfirmation'
>;

export function useListingApprovalPublishActions({
  selectedRecord,
  hasMissingShopifyRequiredFields,
  hasMissingEbayRequiredFields,
  missingShopifyRequiredFieldLabels,
  missingEbayRequiredFieldLabels,
  approvalPublishSource,
  mergedDraftSourceFields,
  setFormValue,
  pushInlineActionNotice,
  requestConfirmation,
}: PublishActionsParams) {
  const [pushingTarget, setPushingTarget] = useState<'shopify' | 'ebay' | 'both' | null>(null);
  const pushResultNotification = useNotificationStore.getState().upsertByKey;

  const runCombinedPush = async (target: 'shopify' | 'ebay' | 'both') => {
    if (!selectedRecord) return;

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