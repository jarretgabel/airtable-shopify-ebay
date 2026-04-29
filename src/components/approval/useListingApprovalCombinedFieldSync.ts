import { useEffect } from 'react';
import {
  EBAY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES,
  normalizeEbayListingTemplateId,
  type EbayListingTemplateId,
} from '@/components/approval/listingApprovalEbayConstants';
import {
  normalizeKeyFeatureLabel,
  serializeKeyFeatureEntries,
  shouldMoveTestingEntryToSharedKeyFeatures,
} from '@/components/approval/listingApprovalFieldHelpers';
import { parseKeyFeatureEntries } from '@/services/shopifyBodyHtml';

interface UseListingApprovalCombinedFieldSyncParams {
  allFieldNames: string[];
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  combinedSharedKeyFeaturesFieldName: string;
  combinedEbayTestingNotesFieldName: string;
  setSelectedEbayTemplateId: React.Dispatch<React.SetStateAction<EbayListingTemplateId>>;
}

export function useListingApprovalCombinedFieldSync({
  allFieldNames,
  approvalChannel,
  isCombinedApproval,
  formValues,
  setFormValue,
  combinedSharedKeyFeaturesFieldName,
  combinedEbayTestingNotesFieldName,
  setSelectedEbayTemplateId,
}: UseListingApprovalCombinedFieldSyncParams) {
  useEffect(() => {
    if (approvalChannel !== 'ebay') return;

    const templateFieldName = allFieldNames.find((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      return EBAY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)
        || (normalized.includes('template') && normalized.includes('body html'));
    });

    const persistedTemplateValue = templateFieldName ? (formValues[templateFieldName] ?? '') : '';
    if (!persistedTemplateValue.trim()) return;

    const normalizedTemplateId = normalizeEbayListingTemplateId(persistedTemplateValue);
    setSelectedEbayTemplateId((current) => (current === normalizedTemplateId ? current : normalizedTemplateId));
  }, [allFieldNames, approvalChannel, formValues, setSelectedEbayTemplateId]);

  useEffect(() => {
    if (!isCombinedApproval) return;
    if (!combinedSharedKeyFeaturesFieldName || !combinedEbayTestingNotesFieldName) return;

    const sharedEntries = parseKeyFeatureEntries(formValues[combinedSharedKeyFeaturesFieldName] ?? '');
    const ebayEntries = parseKeyFeatureEntries(formValues[combinedEbayTestingNotesFieldName] ?? '');
    const transferredEntries = ebayEntries.filter((entry) => shouldMoveTestingEntryToSharedKeyFeatures(entry.feature));
    if (transferredEntries.length === 0) return;

    const remainingEbayEntries = ebayEntries.filter((entry) => !shouldMoveTestingEntryToSharedKeyFeatures(entry.feature));
    const mergedSharedEntries = [...sharedEntries];

    for (const transferredEntry of transferredEntries) {
      const existingIndex = mergedSharedEntries.findIndex(
        (entry) => normalizeKeyFeatureLabel(entry.feature) === normalizeKeyFeatureLabel(transferredEntry.feature),
      );

      if (existingIndex === -1) {
        mergedSharedEntries.push(transferredEntry);
        continue;
      }

      mergedSharedEntries[existingIndex] = transferredEntry;
    }

    const nextSharedValue = serializeKeyFeatureEntries(mergedSharedEntries, combinedSharedKeyFeaturesFieldName);
    const nextEbayValue = serializeKeyFeatureEntries(remainingEbayEntries, combinedEbayTestingNotesFieldName);

    if ((formValues[combinedSharedKeyFeaturesFieldName] ?? '') !== nextSharedValue) {
      setFormValue(combinedSharedKeyFeaturesFieldName, nextSharedValue);
    }

    if ((formValues[combinedEbayTestingNotesFieldName] ?? '') !== nextEbayValue) {
      setFormValue(combinedEbayTestingNotesFieldName, nextEbayValue);
    }
  }, [
    combinedEbayTestingNotesFieldName,
    combinedSharedKeyFeaturesFieldName,
    formValues,
    isCombinedApproval,
    setFormValue,
  ]);
}