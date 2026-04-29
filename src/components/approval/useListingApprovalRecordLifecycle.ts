import { useEffect } from 'react';
import { createNewShopifyListingRecord } from '@/components/approval/listingApprovalShopifyActions';
import {
  createRecordFromResolvedSource,
  getRecordFromResolvedSource,
} from '@/services/app-api/airtable';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import type { AirtableRecord } from '@/types/airtable';

interface UseListingApprovalRecordLifecycleParams {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  allFieldNames: string[];
  approvedFieldName: string;
  hydrateForm: (record: AirtableRecord, fieldNames: string[], approvedFieldName: string) => void;
  loadListingFormatOptions: () => Promise<void>;
  loadRecords: (tableReference: string, tableName?: string) => Promise<void>;
  onSelectRecord: (recordId: string) => void;
  pushInlineActionNotice: (tone: 'success' | 'error', title: string, message: string) => void;
  resetInlineActionNotices: () => void;
  selectedRecord: AirtableRecord | null;
  selectedRecordId: string | null;
  setCreatingShopifyListing: React.Dispatch<React.SetStateAction<boolean>>;
  setEbayCategoryLabelsById: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  tableReference: string;
  tableName?: string;
  titleFieldName: string;
  describeShopifyCreateError: (error: unknown) => string;
}

export function useListingApprovalRecordLifecycle({
  approvalChannel,
  allFieldNames,
  approvedFieldName,
  hydrateForm,
  loadListingFormatOptions,
  loadRecords,
  onSelectRecord,
  pushInlineActionNotice,
  resetInlineActionNotices,
  selectedRecord,
  selectedRecordId,
  setCreatingShopifyListing,
  setEbayCategoryLabelsById,
  tableReference,
  tableName,
  titleFieldName,
  describeShopifyCreateError,
}: UseListingApprovalRecordLifecycleParams) {
  useEffect(() => {
    resetInlineActionNotices();
    setEbayCategoryLabelsById({});
  }, [resetInlineActionNotices, selectedRecordId, setEbayCategoryLabelsById]);

  const hasTableReference = tableReference.trim().length > 0;

  useEffect(() => {
    if (!hasTableReference) return;
    void loadRecords(tableReference, tableName);
    void loadListingFormatOptions();
  }, [hasTableReference, loadListingFormatOptions, loadRecords, tableName, tableReference]);

  useEffect(() => {
    if (!selectedRecord) return;

    let cancelled = false;

    const hydrateFromBestAvailableRecord = async () => {
      try {
        const fullRecord = await getRecordFromResolvedSource(tableReference, tableName, selectedRecord.id);
        if (cancelled) return;

        const mergedRecord: AirtableRecord = {
          ...selectedRecord,
          ...fullRecord,
          fields: {
            ...selectedRecord.fields,
            ...fullRecord.fields,
          },
        };

        const hydrateFieldNames = Array.from(new Set([
          ...allFieldNames,
          ...Object.keys(mergedRecord.fields),
        ])).sort((left, right) => left.localeCompare(right));

        hydrateForm(mergedRecord, hydrateFieldNames, approvedFieldName);
      } catch {
        if (cancelled) return;
        const hydrateFieldNames = Array.from(new Set([
          ...allFieldNames,
          ...Object.keys(selectedRecord.fields),
        ])).sort((left, right) => left.localeCompare(right));

        hydrateForm(selectedRecord, hydrateFieldNames, approvedFieldName);
      }
    };

    void hydrateFromBestAvailableRecord();
    return () => {
      cancelled = true;
    };
  }, [allFieldNames, approvedFieldName, hydrateForm, selectedRecord, tableName, tableReference]);

  function openRecord(record: AirtableRecord) {
    const hydrateFieldNames = Array.from(new Set([
      ...allFieldNames,
      ...Object.keys(record.fields),
    ])).sort((left, right) => left.localeCompare(right));
    hydrateForm(record, hydrateFieldNames, approvedFieldName);
    trackWorkflowEvent('approval_record_opened', {
      recordId: record.id,
      tableReference,
    });
    onSelectRecord(record.id);
  }

  const createNewShopifyListing = async () => {
    if (approvalChannel !== 'shopify') return;
    if (!tableReference.trim()) return;

    const defaultTitle = `New Shopify Listing ${new Date().toISOString().slice(0, 10)}`;
    const titleCandidates = Array.from(new Set([
      titleFieldName,
      'Shopify REST Title',
      'Shopify Title',
      'Item Title',
      'Title',
      'Name',
    ])).filter((fieldName) => fieldName.trim().length > 0);

    setCreatingShopifyListing(true);
    try {
      const createdRecord = await createNewShopifyListingRecord({
        defaultTitle,
        tableReference,
        tableName,
        titleCandidates,
      }, {
        createRecord: createRecordFromResolvedSource,
      });

      await loadRecords(tableReference, tableName);
      onSelectRecord(createdRecord.id);
      pushInlineActionNotice('success', 'New Shopify listing created', 'A new Airtable row is ready. Fill the required Shopify fields, save, then approve.');
    } catch (createError) {
      pushInlineActionNotice('error', 'Unable to create Shopify listing', describeShopifyCreateError(createError));
    } finally {
      setCreatingShopifyListing(false);
    }
  };

  return {
    createNewShopifyListing,
    hasTableReference,
    openRecord,
  };
}