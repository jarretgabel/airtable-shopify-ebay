import axios from 'axios';
import { updateRecordFromResolvedSource } from '@/services/app-api/airtable';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import { toFormValue } from '@/stores/approvalStore';
import {
  EBAY_BODY_HTML_FIELD_CANDIDATES,
  EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_TESTING_NOTES_FIELD_CANDIDATES,
} from './listingApprovalEbayConstants';
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
}: SaveActionsParams) {
  const handleResetData = () => {
    if (!selectedRecord) return;
    const confirmed = window.confirm('Reset page fields to the current Airtable values?');
    if (!confirmed) return;
    const hydrateFieldNames = Array.from(new Set([
      ...allFieldNames,
      ...Object.keys(selectedRecord.fields),
    ])).sort((left, right) => left.localeCompare(right));
    hydrateForm(selectedRecord, hydrateFieldNames, approvedFieldName);
    pushInlineActionNotice('info', 'Page data reset', 'Form values were restored to current Airtable values.');
  };

  const handleSaveUpdates = () => {
    const confirmed = window.confirm('Are you sure you want to save the listing details?');
    if (!confirmed) return;
    if (!selectedRecord) return;
    trackWorkflowEvent('approval_saved', {
      recordId: selectedRecord.id,
      tableReference,
    });

    const runSave = async () => {
      if (approvalChannel === 'ebay') {
        const existingFieldLookup = new Map(
          Object.keys(selectedRecord.fields).map((fieldName) => [fieldName.toLowerCase(), fieldName]),
        );

        const resolveExistingFieldName = (candidates: string[]): string | null => {
          for (const candidate of candidates) {
            const key = candidate.trim().toLowerCase();
            if (!key) continue;
            const existing = existingFieldLookup.get(key);
            if (existing) return existing;
          }
          return null;
        };

        const trySaveEbayField = async (
          candidates: string[],
          rawValue: string,
          options?: { typecast?: boolean; coerceNumber?: boolean },
        ): Promise<string | null> => {
          const uniqueCandidates = Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)));
          if (uniqueCandidates.length === 0) return null;

          const valuesToTry: Array<string | number> = [];
          if (options?.coerceNumber) {
            const cleaned = rawValue.replace(/\$/g, '').replace(/,/g, '').trim();
            const parsed = Number(cleaned);
            if (Number.isFinite(parsed)) {
              valuesToTry.push(parsed, parsed.toFixed(2));
            }
            valuesToTry.push(cleaned || rawValue);
          }
          valuesToTry.push(rawValue);

          const dedupedValues = Array.from(new Set(valuesToTry.map((value) => String(value)))).map((value) => {
            const parsed = Number(value);
            if (options?.coerceNumber && Number.isFinite(parsed) && value.trim() !== '' && !Number.isNaN(parsed)) {
              return value.includes('.') ? value : parsed;
            }
            return value;
          });

          let last422Error: unknown = null;
          for (const candidate of uniqueCandidates) {
            for (const value of dedupedValues) {
              try {
                await updateRecordFromResolvedSource(
                  tableReference,
                  tableName,
                  selectedRecord.id,
                  { [candidate]: value },
                  options?.typecast ? { typecast: true } : undefined,
                );
                return candidate;
              } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 422) {
                  last422Error = error;
                  continue;
                }
                throw error;
              }
            }
          }

          if (last422Error) {
            throw last422Error;
          }

          return null;
        };

        const priceRaw = priceFieldName ? (formValues[priceFieldName] ?? '') : '';
        const priceCandidates = [priceFieldName, ...EBAY_PRICE_FIELD_CANDIDATES];
        const existingPriceFieldName = resolveExistingFieldName(priceCandidates);
        const originalPriceRaw = existingPriceFieldName ? toFormValue(selectedRecord.fields[existingPriceFieldName]) : '';
        const shouldSavePrice = priceRaw.trim().length > 0 && priceRaw !== originalPriceRaw;
        if (shouldSavePrice) {
          const savedPriceField = await trySaveEbayField(priceCandidates, priceRaw, { typecast: true, coerceNumber: true });
          if (savedPriceField && savedPriceField !== priceFieldName) {
            setFormValue(savedPriceField, priceRaw);
          }
        }

        const bodyHtmlRaw = bodyHtmlPreview || (ebayBodyHtmlSaveFieldName ? (formValues[ebayBodyHtmlSaveFieldName] ?? '') : '');
        const bodyHtmlCandidates = [ebayBodyHtmlSaveFieldName, ...EBAY_BODY_HTML_FIELD_CANDIDATES, 'Body html'];
        const existingBodyHtmlFieldName = resolveExistingFieldName(bodyHtmlCandidates);
        const originalBodyHtmlRaw = existingBodyHtmlFieldName ? toFormValue(selectedRecord.fields[existingBodyHtmlFieldName]) : '';
        const shouldSaveBodyHtml = Boolean(existingBodyHtmlFieldName) && bodyHtmlRaw.trim().length > 0 && (
          shouldForceEbayBodyHtmlSave || bodyHtmlRaw !== originalBodyHtmlRaw
        );
        if (shouldSaveBodyHtml) {
          const savedBodyHtmlField = await trySaveEbayField(bodyHtmlCandidates, bodyHtmlRaw, { typecast: false, coerceNumber: false });
          if (savedBodyHtmlField) {
            setFormValue(savedBodyHtmlField, bodyHtmlRaw);
          }
        }

        const keyFeaturesFieldName = resolveExistingFieldName([
          combinedSharedKeyFeaturesFieldName ?? '',
          'Key Features (Key, Value)',
          'Key Features',
          'Key Features JSON',
          'Features',
          'Features JSON',
        ]);
        const keyFeaturesRaw = keyFeaturesFieldName ? (formValues[keyFeaturesFieldName] ?? '') : '';
        const keyFeaturesCandidates = [
          keyFeaturesFieldName,
          'Key Features (Key, Value)',
          'Key Features',
          'Key Features JSON',
          'Features',
          'Features JSON',
        ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0));
        const existingKeyFeaturesFieldName = resolveExistingFieldName(keyFeaturesCandidates);
        const originalKeyFeaturesRaw = existingKeyFeaturesFieldName
          ? toFormValue(selectedRecord.fields[existingKeyFeaturesFieldName])
          : '';
        const shouldSaveKeyFeatures = keyFeaturesRaw.trim().length > 0 && keyFeaturesRaw !== originalKeyFeaturesRaw;
        if (shouldSaveKeyFeatures) {
          const savedKeyFeaturesField = await trySaveEbayField(keyFeaturesCandidates, keyFeaturesRaw, { typecast: false, coerceNumber: false });
          if (savedKeyFeaturesField) {
            setFormValue(savedKeyFeaturesField, keyFeaturesRaw);
          }
        }

        const testingNotesFieldName = resolveExistingFieldName([
          combinedEbayTestingNotesFieldName ?? '',
          ...EBAY_TESTING_NOTES_FIELD_CANDIDATES,
          ...EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
        ]);
        const testingNotesRaw = testingNotesFieldName ? (formValues[testingNotesFieldName] ?? '') : '';
        const testingNotesCandidates = [
          testingNotesFieldName,
          ...EBAY_TESTING_NOTES_FIELD_CANDIDATES,
          ...EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
        ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0));
        const existingTestingNotesFieldName = resolveExistingFieldName(testingNotesCandidates);
        const originalTestingNotesRaw = existingTestingNotesFieldName
          ? toFormValue(selectedRecord.fields[existingTestingNotesFieldName])
          : '';
        const shouldSaveTestingNotes = testingNotesRaw.trim().length > 0 && testingNotesRaw !== originalTestingNotesRaw;
        if (shouldSaveTestingNotes) {
          const savedTestingNotesField = await trySaveEbayField(testingNotesCandidates, testingNotesRaw, { typecast: false, coerceNumber: false });
          if (savedTestingNotesField) {
            setFormValue(savedTestingNotesField, testingNotesRaw);
          }
        }
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
      } else {
        pushInlineActionNotice('error', 'Save failed', 'Could not save listing changes to Airtable. Review the error section and try again.');
      }
    };

    void runSave();
  };

  return {
    handleResetData,
    handleSaveUpdates,
  };
}