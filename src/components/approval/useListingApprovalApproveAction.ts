import { useState } from 'react';
import { recordTitle } from '@/app/appNavigation';
import {
  ensureShopifyDraftBeforeApproval,
  updateApprovedShopifyListing,
  writeShopifyProductIdToAirtable,
} from '@/components/approval/listingApprovalShopifyActions';
import { getApprovalRequiredFieldValidationNotice } from '@/components/approval/listingApprovalActionValidation';
import { updateRecordFromResolvedSource } from '@/services/app-api/airtable';
import { resolveCurrentActorName } from '@/services/currentUserAudit';
import { getProduct as getShopifyProduct } from '@/services/app-api/shopify';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import type { AirtableRecord } from '@/types/airtable';
import type { UseListingApprovalRecordActionsParams } from './listingApprovalRecordActionTypes';

type ApproveActionParams = Pick<UseListingApprovalRecordActionsParams,
  'selectedRecord'
  | 'approvalChannel'
  | 'actualFieldNames'
  | 'approvedFieldName'
  | 'tableReference'
  | 'tableName'
  | 'formValues'
  | 'setFormValue'
  | 'saveRecord'
  | 'createShopifyDraftOnApprove'
  | 'shopifyApprovalPreview'
  | 'loadShopifyApprovalPreviewNow'
  | 'syncExistingShopifyListing'
  | 'describeShopifyCreateError'
  | 'resolveShopifyCategoryId'
  | 'upsertShopifyProductWithCollectionFallback'
  | 'canUpdateApprovedShopifyListing'
  | 'hasMissingShopifyRequiredFields'
  | 'hasMissingEbayRequiredFields'
  | 'missingShopifyRequiredFieldLabels'
  | 'missingEbayRequiredFieldLabels'
  | 'onBackToList'
  | 'pushInlineActionNotice'
  | 'requestConfirmation'
>;

function resolveExistingFieldName(fieldCandidates: string[], selectedRecord: AirtableRecord, actualFieldNames: string[]): string | null {
  const availableFieldNames = new Map<string, string>();

  Object.keys(selectedRecord.fields).forEach((fieldName) => {
    availableFieldNames.set(fieldName.toLowerCase(), fieldName);
  });
  actualFieldNames.forEach((fieldName) => {
    const normalized = fieldName.toLowerCase();
    if (!availableFieldNames.has(normalized)) {
      availableFieldNames.set(normalized, fieldName);
    }
  });

  for (const candidate of fieldCandidates) {
    const resolved = availableFieldNames.get(candidate.toLowerCase());
    if (resolved) return resolved;
  }

  return null;
}

function buildApprovalSystemFieldValues(selectedRecord: AirtableRecord, actualFieldNames: string[]): Record<string, string> {
  const actorName = resolveCurrentActorName();
  const approvedAt = new Date().toISOString();
  const fieldValues: Record<string, string> = {};

  const approvedAtFieldName = resolveExistingFieldName(['Approved For Publish At', 'Approved At'], selectedRecord, actualFieldNames);
  if (approvedAtFieldName) {
    fieldValues[approvedAtFieldName] = approvedAt;
  }

  const reviewedAtFieldName = resolveExistingFieldName(['Pre-Listing Reviewed At'], selectedRecord, actualFieldNames);
  if (reviewedAtFieldName) {
    fieldValues[reviewedAtFieldName] = approvedAt;
  }

  if (actorName) {
    const approvedByFieldName = resolveExistingFieldName(['Pre-Listing Reviewed By', 'Approved By'], selectedRecord, actualFieldNames);
    if (approvedByFieldName) {
      fieldValues[approvedByFieldName] = actorName;
    }
  }

  return fieldValues;
}

export function useListingApprovalApproveAction({
  selectedRecord,
  approvalChannel,
  actualFieldNames,
  approvedFieldName,
  tableReference,
  tableName,
  formValues,
  setFormValue,
  saveRecord,
  createShopifyDraftOnApprove,
  shopifyApprovalPreview,
  loadShopifyApprovalPreviewNow,
  syncExistingShopifyListing,
  describeShopifyCreateError,
  resolveShopifyCategoryId,
  upsertShopifyProductWithCollectionFallback,
  canUpdateApprovedShopifyListing,
  hasMissingShopifyRequiredFields,
  hasMissingEbayRequiredFields,
  missingShopifyRequiredFieldLabels,
  missingEbayRequiredFieldLabels,
  onBackToList,
  pushInlineActionNotice,
  requestConfirmation,
}: ApproveActionParams) {
  const [approving, setApproving] = useState(false);

  const handlePrimaryAction = async () => {
    if (approving) return;

    if (canUpdateApprovedShopifyListing) {
      if (!selectedRecord) return;
      const confirmed = await requestConfirmation({
        title: 'Update approved Shopify listing',
        message: 'Push the current page values into the already approved Shopify product.',
        confirmLabel: 'Update listing',
        bullets: [
          `Record: ${recordTitle(selectedRecord.fields)}`,
          `Existing Shopify product ID: ${formValues['Shopify REST Product ID'] || 'Not set'}`,
        ],
      });
      if (!confirmed) return;

      const runUpdate = async () => {
        setApproving(true);
        try {
          const notice = await updateApprovedShopifyListing({
            existingProductId: formValues['Shopify REST Product ID'] ?? '',
            record: selectedRecord,
          }, {
            syncExistingShopifyListing,
            describeError: describeShopifyCreateError,
          });
          pushInlineActionNotice(notice.tone, notice.title, notice.message);
        } finally {
          setApproving(false);
        }
      };

      await runUpdate();
      return;
    }

    const validationNotice = getApprovalRequiredFieldValidationNotice(approvalChannel, {
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

    if (!selectedRecord) return;
    const confirmed = await requestConfirmation({
      title: 'Approve listing for publishing',
      message: 'Mark this record as approved so it can move forward in the publishing workflow.',
      confirmLabel: 'Approve listing',
      bullets: [
        `Record: ${recordTitle(selectedRecord.fields)}`,
        `Channel: ${approvalChannel}`,
        createShopifyDraftOnApprove ? 'A Shopify draft will be created or refreshed before approval completes.' : 'Approval will update Airtable status only.',
      ],
    });
    if (!confirmed) return;

    const shopifyProductIdField = 'Shopify REST Product ID';

    const runApproval = async () => {
      setApproving(true);
      try {
        if (createShopifyDraftOnApprove) {
          const preview = shopifyApprovalPreview ?? await loadShopifyApprovalPreviewNow(selectedRecord.fields as Record<string, unknown>);
          const draftResult = await ensureShopifyDraftBeforeApproval({
            existingProductId: formValues[shopifyProductIdField] ?? '',
            productIdFieldName: shopifyProductIdField,
            createPayload: preview.effectiveProduct,
            record: selectedRecord,
            collectionIds: preview.collectionIds,
            tableReference,
            tableName,
          }, {
            getShopifyProduct,
            syncExistingShopifyListing,
            describeError: describeShopifyCreateError,
            resolveShopifyCategoryId: async () => preview.resolvedCategoryId || await resolveShopifyCategoryId(),
            upsertShopifyProductWithCollectionFallback: async (params) => {
              const result = await upsertShopifyProductWithCollectionFallback(params);
              return { id: (result as { id: number }).id };
            },
            writeShopifyProductIdToAirtable: async (params) => writeShopifyProductIdToAirtable(params, {
              updateRecord: updateRecordFromResolvedSource,
            }),
          });

          if (draftResult.nextProductIdFieldValue !== undefined) {
            setFormValue(shopifyProductIdField, draftResult.nextProductIdFieldValue);
          }

          draftResult.notices.forEach((notice) => {
            pushInlineActionNotice(notice.tone, notice.title, notice.message);
          });

          if (draftResult.status === 'creation-failed' || draftResult.status === 'update-failed') {
            if (draftResult.status === 'creation-failed') {
              trackWorkflowEvent('shopify_draft_create_failed_from_approval', {
                recordId: selectedRecord.id,
              });
            }
            return;
          }

          if (draftResult.status === 'created' && draftResult.createdProductId) {
            trackWorkflowEvent('shopify_draft_created_from_approval', {
              recordId: selectedRecord.id,
              productId: draftResult.createdProductId,
            });
          }
        }

        trackWorkflowEvent('approval_approved', {
          recordId: selectedRecord.id,
          tableReference,
        });
        const approveSucceeded = await saveRecord(
          true,
          selectedRecord,
          tableReference,
          tableName,
          actualFieldNames,
          approvedFieldName,
          onBackToList,
          'approve-only',
          buildApprovalSystemFieldValues(selectedRecord, actualFieldNames),
        );

        if (!approveSucceeded) {
          pushInlineActionNotice('error', 'Approval failed', 'Could not mark this listing as approved in Airtable.');
        }
      } finally {
        setApproving(false);
      }
    };

    await runApproval();
  };

  return {
    approving,
    handlePrimaryAction,
  };
}