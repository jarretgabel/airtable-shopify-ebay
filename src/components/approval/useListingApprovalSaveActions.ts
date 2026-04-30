import { recordTitle } from '@/app/appNavigation';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import { useNotificationStore } from '@/stores/notificationStore';
import { saveEbayApprovalSupplementalFields } from './listingApprovalEbayFieldPersistence';
import { buildListingApprovalSaveResultNotification } from './listingApprovalResultSummary';
import type { UseListingApprovalRecordActionsParams } from './listingApprovalRecordActionTypes';

type SaveActionsParams = Pick<UseListingApprovalRecordActionsParams,
  'selectedRecord'
  | 'approvalChannel'
  | 'allFieldNames'
  | 'approvedFieldName'
  | 'actualFieldNames'
  | 'tableReference'
  | 'tableName'
  | 'formValues'
  | 'setFormValue'
  | 'hydrateForm'
  | 'saveRecord'
  | 'bodyHtmlPreview'
  | 'ebayBodyHtmlSaveFieldName'
  | 'shouldForceEbayBodyHtmlSave'
  | 'combinedSharedKeyFeaturesFieldName'
  | 'combinedEbayTestingNotesFieldName'
  | 'priceFieldName'
  | 'pushInlineActionNotice'
  | 'changedFieldNames'
  | 'requestConfirmation'
>;

export function useListingApprovalSaveActions({
  selectedRecord,
  approvalChannel,
  allFieldNames,
  approvedFieldName,
  actualFieldNames,
  tableReference,
  tableName,
  formValues,
  setFormValue,
  hydrateForm,
  saveRecord,
  bodyHtmlPreview,
  ebayBodyHtmlSaveFieldName,
  shouldForceEbayBodyHtmlSave,
  combinedSharedKeyFeaturesFieldName,
  combinedEbayTestingNotesFieldName,
  priceFieldName,
  pushInlineActionNotice,
  changedFieldNames,
  requestConfirmation,
}: SaveActionsParams) {
  const pushResultNotification = useNotificationStore.getState().upsertByKey;

  const handleResetData = async () => {
    if (!selectedRecord) return;
    const confirmed = await requestConfirmation({
      title: 'Reset page data',
      message: 'Discard local edits and restore the current Airtable values for this record.',
      confirmLabel: 'Reset page data',
      bullets: [
        `Record: ${recordTitle(selectedRecord.fields)}`,
        `${changedFieldNames.length} unsaved field${changedFieldNames.length === 1 ? '' : 's'} will be discarded.`,
      ],
    });
    if (!confirmed) return;
    const hydrateFieldNames = Array.from(new Set([
      ...allFieldNames,
      ...Object.keys(selectedRecord.fields),
    ])).sort((left, right) => left.localeCompare(right));
    hydrateForm(selectedRecord, hydrateFieldNames, approvedFieldName);
    pushInlineActionNotice('info', 'Page data reset', 'Form values were restored to current Airtable values.');
  };

  const handleSaveUpdates = async () => {
    if (!selectedRecord) return;
    const confirmed = await requestConfirmation({
      title: 'Save listing updates',
      message: 'Write the current page values back to Airtable for this listing.',
      confirmLabel: 'Save updates',
      bullets: [
        `Record: ${recordTitle(selectedRecord.fields)}`,
        `Channel: ${approvalChannel}`,
        `${changedFieldNames.length} changed field${changedFieldNames.length === 1 ? '' : 's'} will be saved.`,
      ],
    });
    if (!confirmed) return;
    trackWorkflowEvent('approval_saved', {
      recordId: selectedRecord.id,
      tableReference,
    });

    const runSave = async () => {
      if (approvalChannel === 'ebay') {
        await saveEbayApprovalSupplementalFields({
          selectedRecord,
          tableReference,
          tableName,
          formValues,
          setFormValue,
          priceFieldName,
          bodyHtmlPreview,
          ebayBodyHtmlSaveFieldName,
          shouldForceEbayBodyHtmlSave,
          combinedSharedKeyFeaturesFieldName,
          combinedEbayTestingNotesFieldName,
        });
      }

      const saveSucceeded = await saveRecord(
        false,
        selectedRecord,
        tableReference,
        tableName,
        actualFieldNames,
        approvedFieldName,
        () => undefined,
        'full',
      );

      if (saveSucceeded) {
        pushInlineActionNotice('success', 'Listing updated', 'Listing changes were saved to Airtable.');
        pushResultNotification(
          `approval-save-result:${selectedRecord.id}`,
          buildListingApprovalSaveResultNotification({
            record: selectedRecord,
            approvalChannel,
            changedFieldCount: changedFieldNames.length,
            succeeded: true,
          }),
        );
      } else {
        pushInlineActionNotice('error', 'Save failed', 'Could not save listing changes to Airtable. Review the error section and try again.');
        pushResultNotification(
          `approval-save-result:${selectedRecord.id}`,
          buildListingApprovalSaveResultNotification({
            record: selectedRecord,
            approvalChannel,
            changedFieldCount: changedFieldNames.length,
            succeeded: false,
          }),
        );
      }
    };

    try {
      await runSave();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save listing changes to Airtable.';
      pushInlineActionNotice('error', 'Save failed', message);
      pushResultNotification(
        `approval-save-result:${selectedRecord.id}`,
        buildListingApprovalSaveResultNotification({
          record: selectedRecord,
          approvalChannel,
          changedFieldCount: changedFieldNames.length,
          succeeded: false,
          errorMessage: message,
        }),
      );
    }
  };

  return {
    handleResetData,
    handleSaveUpdates,
  };
}