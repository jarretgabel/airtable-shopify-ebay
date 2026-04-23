import { useEffect, useMemo, useState } from 'react';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { InventoryRecordEditor } from '@/components/tabs/airtable/InventoryRecordEditor';
import type { InventoryDraftValue, InventoryFieldMetadata } from '@/components/tabs/airtable/inventoryDirectoryTypes';
import {
  buildInventoryDraftValues,
  getInventoryEditableFields,
  inventoryDraftValuesEqual,
  loadInventoryFieldMetadata,
  loadInventoryRecord,
  saveInventoryRecord,
} from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

interface InventoryRecordEditorPageProps {
  recordId: string;
  onBackToDirectory: () => void;
}

export function InventoryRecordEditorPage({ recordId, onBackToDirectory }: InventoryRecordEditorPageProps) {
  const [fieldMetadata, setFieldMetadata] = useState<InventoryFieldMetadata[]>([]);
  const [record, setRecord] = useState<AirtableRecord | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, InventoryDraftValue>>({});
  const [initialDraftValues, setInitialDraftValues] = useState<Record<string, InventoryDraftValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadEditorState = async () => {
      setLoading(true);
      setError(null);
      setSaveMessage(null);

      try {
        const [nextFieldMetadata, nextRecord] = await Promise.all([
          loadInventoryFieldMetadata(),
          loadInventoryRecord(recordId),
        ]);

        if (cancelled) return;

        const nextDraftValues = buildInventoryDraftValues(nextRecord, nextFieldMetadata);
        setFieldMetadata(nextFieldMetadata);
        setRecord(nextRecord);
        setDraftValues(nextDraftValues);
        setInitialDraftValues(nextDraftValues);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : 'Unable to load the selected inventory record.');
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

  const handleSave = async () => {
    if (!record || dirtyFieldNames.length === 0) return;

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const updatedRecord = await saveInventoryRecord(record.id, dirtyFieldNames, draftValues, fieldMetadata);
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
      setSaveMessage(`Saved ${dirtyFieldNames.length} inventory field${dirtyFieldNames.length === 1 ? '' : 's'} to Airtable.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save the selected inventory record.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !record) {
    return <LoadingSurface message="Loading inventory record editor..." />;
  }

  if (error && !record) {
    return (
      <ErrorSurface title="Unable to load inventory record" message={error}>
        <div className="mt-4">
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={onBackToDirectory}
          >
            Back to Directory
          </button>
        </div>
      </ErrorSurface>
    );
  }

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SB Inventory</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Inventory Record Editor</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">This isolated form page mirrors the inventory-processing form layout so you can focus on one record at a time while editing Airtable-backed inventory data.</p>
            </div>

            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onBackToDirectory}
            >
              Back to Directory
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
        />
      </div>
    </PanelSurface>
  );
}