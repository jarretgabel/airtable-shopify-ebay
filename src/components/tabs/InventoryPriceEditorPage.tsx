import { useEffect, useMemo, useState } from 'react';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { InventoryRecordEditor } from '@/components/tabs/airtable/InventoryRecordEditor';
import type { InventoryDraftValue, InventoryFieldMetadata } from '@/components/tabs/airtable/inventoryDirectoryTypes';
import { useConfirmationDialog } from '@/hooks/useConfirmationDialog';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import {
  buildInventoryDraftValues,
  getInventoryEditableFields,
  loadInventoryPriceFieldMetadata,
  loadInventoryPriceRecord,
  saveInventoryPriceRecord,
} from '@/services/inventoryPriceEditor';
import { inventoryDraftValuesEqual } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

interface InventoryPriceEditorPageProps {
  recordId: string;
  onBackToInventoryRecord: (recordId: string) => void;
}

export function InventoryPriceEditorPage({ recordId, onBackToInventoryRecord }: InventoryPriceEditorPageProps) {
  const [fieldMetadata, setFieldMetadata] = useState<InventoryFieldMetadata[]>([]);
  const [record, setRecord] = useState<AirtableRecord | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, InventoryDraftValue>>({});
  const [initialDraftValues, setInitialDraftValues] = useState<Record<string, InventoryDraftValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { requestConfirmation, confirmationModal } = useConfirmationDialog();

  useEffect(() => {
    let cancelled = false;

    const loadEditorState = async () => {
      setLoading(true);
      setError(null);
      setSaveMessage(null);

      try {
        const [nextFieldMetadata, nextRecord] = await Promise.all([
          loadInventoryPriceFieldMetadata(),
          loadInventoryPriceRecord(recordId),
        ]);

        if (cancelled) return;

        const nextDraftValues = buildInventoryDraftValues(nextRecord, nextFieldMetadata);
        setFieldMetadata(nextFieldMetadata);
        setRecord(nextRecord);
        setDraftValues(nextDraftValues);
        setInitialDraftValues(nextDraftValues);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : 'Unable to load the selected inventory price editor.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEditorState();

    return () => {
      cancelled = true;
    };
  }, [recordId, reloadKey]);

  const editableFields = useMemo(() => getInventoryEditableFields(fieldMetadata), [fieldMetadata]);

  const dirtyFieldNames = useMemo(
    () => editableFields
      .filter((field) => !inventoryDraftValuesEqual(draftValues[field.name], initialDraftValues[field.name]))
      .map((field) => field.name),
    [draftValues, editableFields, initialDraftValues],
  );

  useUnsavedChangesPrompt({
    when: dirtyFieldNames.length > 0 && !saving,
    message: 'You have unsaved inventory price edits. Leave this page and discard them?',
    requestConfirmation,
  });

  const handleSave = async () => {
    if (!record || dirtyFieldNames.length === 0) return;

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const updatedRecord = await saveInventoryPriceRecord(record.id, dirtyFieldNames, draftValues, fieldMetadata);
      const nextRecord: AirtableRecord = {
        ...record,
        ...updatedRecord,
        createdTime: updatedRecord.createdTime ?? record.createdTime,
        fields: {
          ...record.fields,
          ...updatedRecord.fields,
        },
      };
      const nextDraftValues = buildInventoryDraftValues(nextRecord, fieldMetadata);

      setRecord(nextRecord);
      setDraftValues(nextDraftValues);
      setInitialDraftValues(nextDraftValues);
      setSaveMessage(`Saved ${dirtyFieldNames.length} inventory price field${dirtyFieldNames.length === 1 ? '' : 's'} to Airtable.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save the selected inventory price record.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !record) {
    return <LoadingSurface message="Loading inventory price editor..." />;
  }

  if (error && !record) {
    return (
      <ErrorSurface title="Unable to load inventory price editor" message={error}>
        <div className="mt-4">
          <BackToolbarButton label="Back to Inventory" onClick={() => onBackToInventoryRecord(recordId)} />
        </div>
      </ErrorSurface>
    );
  }

  return (
    <>
      <WorkflowRecordPageLayout
        eyebrow="Processing"
        title="Inventory Price Editor"
        actions={(
          <BackToolbarButton label="Back to Inventory" onClick={() => onBackToInventoryRecord(recordId)} />
        )}
      >

          <InventoryRecordEditor
            record={record}
            editableFields={editableFields}
            draftValues={draftValues}
            dirtyFieldNames={dirtyFieldNames}
            loading={loading}
            saving={saving}
            error={error}
            saveMessage={saveMessage}
            showIntro={false}
            onFieldChange={(fieldName, value) => setDraftValues((current) => ({ ...current, [fieldName]: value }))}
            onReset={() => {
              setDraftValues(initialDraftValues);
              setSaveMessage(null);
              setError(null);
            }}
            onReload={() => {
              setReloadKey((current) => current + 1);
            }}
            onSave={() => {
              void handleSave();
            }}
            copy={{
              eyebrow: 'Inventory Pricing',
              title: 'Edit Inventory Prices',
              description: 'Review and update the editable Airtable price fields for this operational row, then save your changes back to the combined listings table.',
              emptyMessage: 'Load an operational row to start editing its publish-readiness price fields.',
            }}
          />
      </WorkflowRecordPageLayout>
      {confirmationModal}
    </>
  );
}