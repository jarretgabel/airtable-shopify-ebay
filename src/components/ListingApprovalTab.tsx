import { useEffect, useMemo } from 'react';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import { errorSurfaceClass, loadingSurfaceClass, panelSurfaceClass, spinnerClass } from '@/components/tabs/uiClasses';
import {
  useApprovalStore,
  displayValue,
  DEFAULT_APPROVAL_TABLE_REFERENCE,
} from '@/stores/approvalStore';
import { AirtableRecord } from '@/types/airtable';

interface ListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
}

export function ListingApprovalTab({
  viewModel,
}: ListingApprovalTabProps) {
  const { selectedRecordId, onSelectRecord, onBackToList } = viewModel;
  const tableReference = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim()
    || DEFAULT_APPROVAL_TABLE_REFERENCE;
  const fallbackTableName = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim()
    || (import.meta.env.VITE_AIRTABLE_TABLE_NAME as string | undefined)?.trim()
    || 'Table 1';

  const {
    records,
    loading,
    saving,
    error,
    listingFormatOptions,
    formValues,
    fieldKinds,
    setFormValue,
    hydrateForm,
    loadRecords,
    loadListingFormatOptions,
    saveRecord,
  } = useApprovalStore();

  const allFieldNames = useMemo(() => {
    const names = new Set<string>();
    records.forEach((record) => {
      Object.keys(record.fields).forEach((fieldName) => names.add(fieldName));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

  const approvedFieldName = useMemo(() => {
    const match = allFieldNames.find((fieldName) => fieldName.toLowerCase() === 'approved');
    return match ?? 'approved';
  }, [allFieldNames]);

  function openRecord(record: AirtableRecord) {
    hydrateForm(record, allFieldNames, approvedFieldName);
    onSelectRecord(record.id);
  }

  useEffect(() => {
    void loadRecords(tableReference, fallbackTableName);
    void loadListingFormatOptions();
  }, []);

  useEffect(() => {
    if (!selectedRecord) return;
    hydrateForm(selectedRecord, allFieldNames, approvedFieldName);
  }, [selectedRecord?.id, records]);

  if (selectedRecord) {
    return (
      <section className={panelSurfaceClass}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <button
            type="button"
            className={secondaryActionButtonClass}
            onClick={onBackToList}
            disabled={saving}
          >
            Back to Listings
          </button>
          <div>
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Listing Update</p>
            <h3 className="m-0 mt-1 text-[1.08rem] font-semibold text-[var(--ink)]">{displayValue(selectedRecord.fields['Item Title'])}</h3>
            <p className="m-0 mt-1 text-sm text-[var(--muted)]">Record ID: <code>{selectedRecord.id}</code></p>
          </div>
        </div>

        {error && (
          <section className={`${errorSurfaceClass} mb-4`}>
            <p className="m-0 font-bold text-[var(--error-text)]">Save Error</p>
            <p className="mt-2 text-[var(--error-text)]/85">{error}</p>
          </section>
        )}

        <ApprovalFormFields
          allFieldNames={allFieldNames}
          formValues={formValues}
          fieldKinds={fieldKinds}
          listingFormatOptions={listingFormatOptions}
          saving={saving}
          setFormValue={setFormValue}
        />

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className={primaryActionButtonClass}
            onClick={() => {
              const confirmed = window.confirm('Are you sure you want to save the listing details?');
              if (!confirmed) return;
              if (!selectedRecord) return;
              void saveRecord(false, selectedRecord, tableReference, fallbackTableName, approvedFieldName, onBackToList);
            }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Updates'}
          </button>
          <button
            type="button"
            className={accentActionButtonClass}
            onClick={() => {
              const confirmed = window.confirm('Are you sure you want to approve this listing for publishing?');
              if (!confirmed) return;
              if (!selectedRecord) return;
              void saveRecord(true, selectedRecord, tableReference, fallbackTableName, approvedFieldName, onBackToList);
            }}
            disabled={saving}
          >
            {saving ? 'Approving...' : 'Approve Listing'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {error && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Error loading approval workflow</p>
          <p className="mt-2 text-[var(--error-text)]/85">{error}</p>
        </section>
      )}

      {loading ? (
        <section className={loadingSurfaceClass}>
          <div className={spinnerClass} />
          <p>Loading listing approval queue...</p>
        </section>
      ) : (
        <section className={panelSurfaceClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow</p>
              <h3 className="m-0 mt-1 text-[1.08rem] font-semibold text-[var(--ink)]">Listing Update & Approval</h3>
              <p className="m-0 mt-1 text-sm text-[var(--muted)]">
                Source: <code>{tableReference}</code> · Table fallback: <code>{fallbackTableName}</code>
              </p>
            </div>
            <button type="button" className={primaryActionButtonClass} onClick={() => void loadRecords(tableReference, fallbackTableName)}>
              Refresh Queue
            </button>
          </div>

          <p className="m-0 mb-4 text-sm text-[var(--muted)]">
            <strong>{records.length}</strong> listing rows loaded.
          </p>

          <ApprovalQueueTable
            records={records}
            approvedFieldName={approvedFieldName}
            openRecord={openRecord}
            onSelectRecord={onSelectRecord}
          />
        </section>
      )}
    </>
  );
}
