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
  tableReference?: string;
  tableName?: string;
}

export function ListingApprovalTab({
  viewModel,
  tableReference: propsTableReference,
  tableName: propTableName,
}: ListingApprovalTabProps) {
  const { selectedRecordId, onSelectRecord, onBackToList } = viewModel;
  const tableReference = propsTableReference
    || (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim()
    || DEFAULT_APPROVAL_TABLE_REFERENCE;
  const tableName = propTableName
    || (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim()
    || (import.meta.env.VITE_AIRTABLE_TABLE_NAME as string | undefined)?.trim();

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

  const resolveFieldName = useMemo(
    () => (candidates: string[], fallback: string) => {
      const candidateSet = new Set(candidates.map((name) => name.toLowerCase()));
      const exact = allFieldNames.find((fieldName) => candidateSet.has(fieldName.toLowerCase()));
      return exact ?? fallback;
    },
    [allFieldNames],
  );

  const titleFieldName = useMemo(
    () => resolveFieldName(['Item Title', 'Shopify Title', 'Shopify REST Title', 'eBay Inventory Product Title', 'Title', 'Name'], 'Item Title'),
    [resolveFieldName],
  );

  const conditionFieldName = useMemo(
    () => resolveFieldName(['Item Condition', 'Condition', 'Shopify Condition', 'Shopify REST Status'], 'Item Condition'),
    [resolveFieldName],
  );

  const formatFieldName = useMemo(
    () => resolveFieldName(['Listing Format', 'Status', 'Shopify Status', 'Shopify REST Status'], 'Listing Format'),
    [resolveFieldName],
  );

  const priceFieldName = useMemo(
    () => resolveFieldName(['eBay Offer Price Value', 'Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'Price'], ''),
    [resolveFieldName],
  );

  const vendorFieldName = useMemo(
    () => resolveFieldName(['Shopify REST Vendor', 'Shopify Vendor', 'eBay Inventory Product Brand', 'Brand', 'Vendor', 'Manufacturer'], ''),
    [resolveFieldName],
  );

  const qtyFieldName = useMemo(
    () => resolveFieldName(['eBay Inventory Ship To Location Quantity', 'Shopify REST Variant 1 Inventory Quantity', 'Shopify Variant 1 Inventory Quantity', 'Quantity', 'Qty'], ''),
    [resolveFieldName],
  );

  function openRecord(record: AirtableRecord) {
    hydrateForm(record, allFieldNames, approvedFieldName);
    onSelectRecord(record.id);
  }

  const hasTableReference = tableReference.trim().length > 0;

  useEffect(() => {
    if (!hasTableReference) return;
    void loadRecords(tableReference, tableName);
    void loadListingFormatOptions();
  }, [hasTableReference, loadListingFormatOptions, loadRecords, tableName, tableReference]);

  useEffect(() => {
    if (!selectedRecord) return;
    hydrateForm(selectedRecord, allFieldNames, approvedFieldName);
  }, [selectedRecord?.id, records]);

  const approvedValue = selectedRecord?.fields[approvedFieldName];
  const isApproved = approvedValue === true
    || String(approvedValue ?? '').toLowerCase() === 'true'
    || String(approvedValue ?? '').toLowerCase() === 'yes';
  const hasApprovedValue = approvedValue !== null && approvedValue !== undefined && String(approvedValue).trim() !== '';

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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[1.08rem] font-semibold text-[var(--ink)]">{displayValue(selectedRecord.fields[titleFieldName])}</h3>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] ${
                isApproved
                  ? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-200'
                  : hasApprovedValue
                    ? 'border border-rose-400/35 bg-rose-500/20 text-rose-200'
                    : 'border border-amber-400/35 bg-amber-500/20 text-amber-200'
              }`}>
                {isApproved ? 'Approved' : hasApprovedValue ? displayValue(approvedValue) : 'Pending'}
              </span>
            </div>
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
          approvedFieldName={approvedFieldName}
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
              void saveRecord(false, selectedRecord, tableReference, tableName, approvedFieldName, onBackToList);
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
              void saveRecord(true, selectedRecord, tableReference, tableName, approvedFieldName, onBackToList);
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
      {!hasTableReference && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Listing approval source is not configured</p>
          <p className="mt-2 text-[var(--error-text)]/85">
            Set the Airtable table reference env variable for this page and refresh.
          </p>
        </section>
      )}

      {error && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Error loading approval workflow</p>
          <p className="mt-2 text-[var(--error-text)]/85">{error}</p>
        </section>
      )}

      {hasTableReference && loading ? (
        <section className={loadingSurfaceClass}>
          <div className={spinnerClass} />
          <p>Loading listing approval queue...</p>
        </section>
      ) : hasTableReference ? (
        <section className={panelSurfaceClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow</p>
              <h3 className="m-0 mt-1 text-[1.08rem] font-semibold text-[var(--ink)]">Listing Update & Approval</h3>
              <p className="m-0 mt-1 text-sm text-[var(--muted)]">
                Source: <code>{tableReference}</code>
              </p>
            </div>
            <button type="button" className={primaryActionButtonClass} onClick={() => void loadRecords(tableReference, tableName)}>
              Refresh Queue
            </button>
          </div>

          <p className="m-0 mb-4 text-sm text-[var(--muted)]">
            <strong>{records.length}</strong> listing rows loaded.
          </p>

          <ApprovalQueueTable
            records={records}
            approvedFieldName={approvedFieldName}
            titleFieldName={titleFieldName}
            conditionFieldName={conditionFieldName}
            formatFieldName={formatFieldName}
            priceFieldName={priceFieldName}
            vendorFieldName={vendorFieldName}
            qtyFieldName={qtyFieldName}
            openRecord={openRecord}
            onSelectRecord={onSelectRecord}
          />
        </section>
      ) : null}
    </>
  );
}
