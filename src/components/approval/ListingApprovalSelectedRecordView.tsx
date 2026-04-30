import { useState, type ReactNode } from 'react';
import { displayValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

interface ListingApprovalSelectedRecordViewProps {
  selectedRecord: AirtableRecord;
  titleFieldName: string;
  isApproved: boolean;
  saving: boolean;
  error: string | null;
  onBackToList: () => void;
  secondaryActionButtonClass: string;
  errorSurfaceClass: string;
  editor: ReactNode;
  alerts: ReactNode;
  actions: ReactNode;
  payloadPanels: ReactNode;
}

export function ListingApprovalSelectedRecordView({
  selectedRecord,
  titleFieldName,
  isApproved,
  saving,
  error,
  onBackToList,
  secondaryActionButtonClass,
  errorSurfaceClass,
  editor,
  alerts,
  actions,
  payloadPanels,
}: ListingApprovalSelectedRecordViewProps) {
  const [showPayloadPanels, setShowPayloadPanels] = useState(false);

  return (
    <>
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
                : 'border border-amber-400/35 bg-amber-500/20 text-amber-200'
            }`}>
              {isApproved ? 'Approved' : 'Unapproved'}
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

      {editor}
      {alerts}
      {actions}
      <details
        className="mt-4 rounded-lg border border-[var(--line)] bg-white/5"
        open={showPayloadPanels}
      >
        <summary
          className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          onClick={(event) => {
            event.preventDefault();
            setShowPayloadPanels((current) => !current);
          }}
        >
          API Payload Previews
        </summary>
        <div className="border-t border-[var(--line)] px-3 py-3">
          <p className="m-0 text-xs text-[var(--muted)]">
            Open to inspect exact request payloads, debug resolution details, and docs examples for the current listing.
          </p>
          {showPayloadPanels ? payloadPanels : null}
        </div>
      </details>
    </>
  );
}