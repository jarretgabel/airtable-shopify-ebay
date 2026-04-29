import { useState } from 'react';
import { publishApprovalRecord } from '@/services/app-api/approval';
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
}: PublishActionsParams) {
  const [pushingTarget, setPushingTarget] = useState<'shopify' | 'ebay' | 'both' | null>(null);

  const runCombinedPush = async (target: 'shopify' | 'ebay' | 'both') => {
    if (!selectedRecord) return;

    if ((target === 'shopify' || target === 'both') && hasMissingShopifyRequiredFields) {
      pushInlineActionNotice('warning', 'Required Shopify fields missing', `Complete required Shopify fields before publishing: ${missingShopifyRequiredFieldLabels.join(', ')}`);
      return;
    }

    if ((target === 'ebay' || target === 'both') && hasMissingEbayRequiredFields) {
      pushInlineActionNotice('warning', 'Required eBay fields missing', `Complete required eBay fields before publishing: ${missingEbayRequiredFieldLabels.join(', ')}`);
      return;
    }

    const confirmed = window.confirm(
      target === 'both'
        ? 'Publish this listing to both Shopify and eBay using the current page values?'
        : `Publish this listing to ${target === 'shopify' ? 'Shopify' : 'eBay'} using the current page values?`,
    );
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
    } catch (pushError) {
      const message = pushError instanceof Error ? pushError.message : 'Unable to push this listing.';
      pushInlineActionNotice('error', 'Publish failed', message);
    } finally {
      setPushingTarget(null);
    }
  };

  return {
    pushingTarget,
    runCombinedPush,
  };
}