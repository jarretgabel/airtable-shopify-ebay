import { useState } from 'react';
import { recordTitle } from '@/app/appNavigation';
import { getPublishRequiredFieldValidationNotice } from '@/components/approval/listingApprovalActionValidation';
import { publishApprovalRecord } from '@/services/app-api/approval';
import { updateConfiguredRecord } from '@/services/app-api/airtable';
import { uploadImageUrlToEbayHostedPictures } from '@/services/app-api/ebay';
import { buildEbayDraftPayloadBundleFromApprovalFields } from '@/services/ebayDraftFromAirtable';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { resolveWorkflowStatusAfterPublish } from '@/services/usedGearWorkflowLifecycle';
import { resolveShopifyBodyHtml } from '@/services/shopifyDraftFromAirtableBody';
import { getIncludedWorkflowImageMetadata, parseWorkflowImageMetadata } from '@/services/workflowImageMetadata';
import { useApprovalStore } from '@/stores/approvalStore';
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
  | 'tableReference'
  | 'tableName'
  | 'mergedDraftSourceFields'
  | 'ebayGeneratedBodyHtml'
  | 'workflowPublishSummary'
  | 'setFormValue'
  | 'setDerivedFormValue'
  | 'pushInlineActionNotice'
  | 'requestConfirmation'
>;

const EBAY_PUBLISH_PROGRESS_NOTICE_ID = 'ebay-publish-progress';
const EBAY_IMAGE_UPLOAD_CONCURRENCY = 2;
const EBAY_IMAGE_UPLOAD_ATTEMPTS = 2;

function isEbayHostedImageUrl(value: string): boolean {
  try {
    return new URL(value).hostname.toLowerCase().endsWith('.ebayimg.com');
  } catch {
    return false;
  }
}

export function useListingApprovalPublishActions({
  selectedRecord,
  hasMissingShopifyRequiredFields,
  hasMissingEbayRequiredFields,
  isShopifyPublishBlockedByAuctionFormat,
  missingShopifyRequiredFieldLabels,
  missingEbayRequiredFieldLabels,
  approvalPublishSource,
  tableReference,
  tableName,
  mergedDraftSourceFields,
  ebayGeneratedBodyHtml,
  workflowPublishSummary,
  setFormValue,
  setDerivedFormValue,
  pushInlineActionNotice,
  requestConfirmation,
}: PublishActionsParams) {
  const [pushingTarget, setPushingTarget] = useState<'shopify' | 'ebay' | 'both' | null>(null);
  const pushResultNotification = useNotificationStore.getState().upsertByKey;

  const getUnknownFieldNamesFromWriteError = (message: string): string[] => {
    const quotedMatches = Array.from(message.matchAll(/[\"']([^\"']+)[\"']/g))
      .map((match) => (typeof match[1] === 'string' ? match[1].trim() : ''))
      .filter((value) => value.length > 0);

    if (/Unknown field name/i.test(message) && quotedMatches.length > 0) {
      return Array.from(new Set(quotedMatches));
    }

    const suffixMatch = message.match(/Unknown field names?:\s*(.+)$/i);
    if (!suffixMatch?.[1]) {
      return [];
    }

    return Array.from(new Set(
      suffixMatch[1]
        .split(',')
        .map((value) => value.trim().replace(/^[\"']|[\"']$/g, ''))
        .filter((value) => value.length > 0),
    ));
  };

  const updateConfiguredRecordWithUnknownFieldFallback = async (
    source: PublishActionsParams['approvalPublishSource'],
    recordId: string,
    nextFields: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const writableFields = { ...nextFields };

    while (true) {
      try {
        await updateConfiguredRecord(source, recordId, { ...writableFields }, { typecast: true });
        return writableFields;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const unknownFieldNames = getUnknownFieldNamesFromWriteError(message);
        if (unknownFieldNames.length === 0) {
          throw error;
        }

        let removed = false;
        for (const unknownFieldName of unknownFieldNames) {
          if (unknownFieldName in writableFields) {
            delete writableFields[unknownFieldName];
            removed = true;
          }
        }

        if (!removed || Object.keys(writableFields).length === 0) {
          throw error;
        }
      }
    }
  };

  const toDerivedFieldValue = (value: unknown): string | null => {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  };

  const getTrimmedStringField = (fields: Record<string, unknown>, candidates: string[]): string => {
    for (const fieldName of candidates) {
      const value = fields[fieldName];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return '';
  };

  const buildPublishFieldsForTarget = (
    publishTarget: 'shopify' | 'ebay' | 'both',
    sourceFields: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | undefined => {
    if (!sourceFields) {
      return undefined;
    }

    const nextFields: Record<string, unknown> = { ...sourceFields };
    if (publishTarget !== 'shopify' && ebayGeneratedBodyHtml?.trim()) {
      nextFields['Ebay Body (HTML)'] = ebayGeneratedBodyHtml.trim();
    }
    if (publishTarget !== 'shopify' && publishTarget !== 'both') {
      return nextFields;
    }

    const workflowImageMetadata = getIncludedWorkflowImageMetadata(parseWorkflowImageMetadata(
      nextFields['Workflow Image Metadata JSON']
      ?? nextFields['Workflow Image Metadata']
      ?? nextFields.workflow_image_metadata_json
      ?? nextFields.workflow_image_metadata,
    ));

    if (workflowImageMetadata.length > 0) {
      const approvedRows = workflowImageMetadata.map((record, index) => ({
        src: record.url,
        filename: record.filename,
        alt: record.alt,
        position: index + 1,
      }));
      nextFields['Shopify REST Images JSON'] = JSON.stringify(approvedRows);
      nextFields['Shopify Images JSON'] = JSON.stringify(approvedRows);
    }

    const listingDescription = getTrimmedStringField(nextFields, [
      'Description',
      'Item Description',
    ]);

    if (listingDescription.length > 0) {
      nextFields['Shopify REST Body Description'] = listingDescription;
      nextFields['Shopify Body Description'] = listingDescription;
    }

    const renderedShopifyBodyHtml = resolveShopifyBodyHtml(nextFields).trim();
    if (renderedShopifyBodyHtml.length > 0) {
      nextFields['Shopify REST Body HTML'] = renderedShopifyBodyHtml;
      nextFields['Shopify Body HTML'] = renderedShopifyBodyHtml;
      nextFields['Shopify GraphQL Description HTML'] = renderedShopifyBodyHtml;
      nextFields['body_html'] = renderedShopifyBodyHtml;
    }

    return nextFields;
  };

  const prepareEbayHostedImages = async (
    publishTarget: 'shopify' | 'ebay' | 'both',
    fields: Record<string, unknown> | undefined,
  ): Promise<Record<string, unknown> | undefined> => {
    if (!fields || publishTarget === 'shopify') return fields;

    const bundle = buildEbayDraftPayloadBundleFromApprovalFields(fields);
    if (typeof bundle.offer.listingDescription !== 'string' || !bundle.offer.listingDescription.trim()) {
      throw new Error('eBay listing is not ready to publish. Missing or invalid: listing description.');
    }
    const product = bundle.inventoryItem.product as Record<string, unknown> | undefined;
    const imageUrls = Array.isArray(product?.imageUrls)
      ? product.imageUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    if (imageUrls.length === 0) {
      throw new Error('No approved listing images were found. Restore or select listing images before publishing to eBay; eBay image upload did not run.');
    }

    const hostedUrls = [...imageUrls];
    const pending = imageUrls
      .map((url, index) => ({ url, index }))
      .filter(({ url }) => !isEbayHostedImageUrl(url));

    if (pending.length > 0) {
      pushInlineActionNotice(
        'info',
        'Uploading eBay images',
        `Uploading approved images to eBay (0/${pending.length}).`,
        { id: EBAY_PUBLISH_PROGRESS_NOTICE_ID, persistent: true },
      );
    }

    let nextPendingIndex = 0;
    let completed = 0;
    const failures: Array<{ imageNumber: number; error: unknown }> = [];

    const uploadNextImage = async (): Promise<void> => {
      while (nextPendingIndex < pending.length) {
        const pendingImage = pending[nextPendingIndex];
        nextPendingIndex += 1;

        let lastError: unknown;
        for (let attempt = 1; attempt <= EBAY_IMAGE_UPLOAD_ATTEMPTS; attempt += 1) {
          try {
            const uploaded = await uploadImageUrlToEbayHostedPictures(pendingImage.url, pendingImage.index);
            hostedUrls[pendingImage.index] = uploaded.url;
            completed += 1;
            pushInlineActionNotice(
              'info',
              'Uploading eBay images',
              `Uploading approved images to eBay (${completed}/${pending.length}).`,
              { id: EBAY_PUBLISH_PROGRESS_NOTICE_ID, persistent: true },
            );
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (lastError !== undefined) {
          failures.push({ imageNumber: pendingImage.index + 1, error: lastError });
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(EBAY_IMAGE_UPLOAD_CONCURRENCY, pending.length) },
        () => uploadNextImage(),
      ),
    );

    if (failures.length > 0) {
      const firstFailure = failures[0];
      const reason = firstFailure.error instanceof Error ? firstFailure.error.message : String(firstFailure.error);
      throw new Error(`Could not upload eBay image ${firstFailure.imageNumber} after ${EBAY_IMAGE_UPLOAD_ATTEMPTS} attempts: ${reason}`);
    }

    return {
      ...fields,
      'eBay Inventory Product Image URLs JSON': JSON.stringify(hostedUrls),
    };
  };

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

    const appliedFields = await updateConfiguredRecordWithUnknownFieldFallback(
      approvalPublishSource,
      selectedRecord.id,
      fields,
    );

    Object.entries(appliedFields).forEach(([fieldName, value]) => {
      const nextValue = toDerivedFieldValue(value);
      if (nextValue === null) {
        return;
      }

      if (typeof setDerivedFormValue === 'function') {
        setDerivedFormValue(fieldName, nextValue);
      } else {
        setFormValue(fieldName, nextValue);
      }
    });
  };

  const runCombinedPush = async (target: 'shopify' | 'ebay' | 'both') => {
    if (!selectedRecord) return;

    const currentWorkflowStatus = getUsedGearWorkflowStatus(selectedRecord.fields);
    const hasExistingShopifyRestProductId = typeof selectedRecord.fields['Shopify REST Product ID'] === 'string'
      && selectedRecord.fields['Shopify REST Product ID'].trim().length > 0;
    const hasExistingEbayOfferId = typeof selectedRecord.fields['eBay Offer ID'] === 'string'
      && selectedRecord.fields['eBay Offer ID'].trim().length > 0;
    const requiresShopifyUpdate = currentWorkflowStatus === 'Listed, Shopify' || currentWorkflowStatus === 'Stale Listing, Shopify';
    const requiresEbayUpdate = currentWorkflowStatus === 'Listed, eBay' || currentWorkflowStatus === 'Stale Listing, eBay';

    if ((target === 'shopify' || target === 'both') && requiresShopifyUpdate && !hasExistingShopifyRestProductId) {
      pushInlineActionNotice(
        'warning',
        'Shopify update blocked',
        'This row is already listed on Shopify but does not have a Shopify product ID. Add or restore Shopify REST Product ID before updating Shopify.',
      );
      return;
    }

    if ((target === 'ebay' || target === 'both') && requiresEbayUpdate && !hasExistingEbayOfferId) {
      pushInlineActionNotice(
        'warning',
        'eBay update blocked',
        'This row is already listed on eBay but does not have an eBay offer ID. Add or restore eBay Offer ID before updating eBay.',
      );
      return;
    }

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
      const publishFields = await prepareEbayHostedImages(
        target,
        buildPublishFieldsForTarget(target, mergedDraftSourceFields ?? null),
      );
      if (target === 'ebay' || target === 'both') {
        pushInlineActionNotice(
          'info',
          'Publishing eBay listing',
          'Images are ready. Creating or updating the eBay offer and publishing the listing.',
          { id: EBAY_PUBLISH_PROGRESS_NOTICE_ID, persistent: true },
        );
      }
      const executionResult = await publishApprovalRecord(approvalPublishSource, selectedRecord.id, target, {
        productIdFieldName: 'Shopify REST Product ID',
        fields: publishFields,
      });

      if (executionResult.shopify) {
        const productIdValue = String(executionResult.shopify.productId);
        if (typeof setDerivedFormValue === 'function') {
          setDerivedFormValue('Shopify REST Product ID', productIdValue);
        } else {
          setFormValue('Shopify REST Product ID', productIdValue);
        }
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
          { id: EBAY_PUBLISH_PROGRESS_NOTICE_ID },
        );
      }

      executionResult.failures.forEach((failure) => {
        pushInlineActionNotice(
          'error',
          failure.target === 'shopify' ? 'Shopify publish failed' : 'eBay publish failed',
          failure.message,
          failure.target === 'ebay' ? { id: EBAY_PUBLISH_PROGRESS_NOTICE_ID } : undefined,
        );
      });

      try {
        await persistWorkflowLifecycleWriteback(target, executionResult);
      } catch (writebackError) {
        const message = writebackError instanceof Error ? writebackError.message : 'Publish completed, but workflow lifecycle fields could not be updated.';
        pushInlineActionNotice('warning', 'Workflow lifecycle writeback failed', message);
      }

      try {
        await useApprovalStore.getState().loadRecords(tableReference, tableName, true);
      } catch {
        // Keep publish success UX even if background record refresh fails.
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
      if (target === 'ebay' || target === 'both') {
        pushInlineActionNotice('error', 'Publish failed', message, { id: EBAY_PUBLISH_PROGRESS_NOTICE_ID });
      } else {
        pushInlineActionNotice('error', 'Publish failed', message);
      }
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