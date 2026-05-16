import { useEffect, useMemo, useState } from 'react';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
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
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => onBackToInventoryRecord(recordId)}
          >
            Back to inventory
          </button>
        </div>
      </ErrorSurface>
    );
  }

  return (
    <>
      <PanelSurface>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Inventory Pricing</p>
                <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Inventory Price Editor</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Edit the combined-listings price fields that control publish readiness for this operational row, then save them back to Airtable.</p>
              </div>

              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => onBackToInventoryRecord(recordId)}
              >
                Back to inventory
              </button>
            </div>
          </div>

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
        </div>
      </PanelSurface>
      {confirmationModal}
    </>
  );
}