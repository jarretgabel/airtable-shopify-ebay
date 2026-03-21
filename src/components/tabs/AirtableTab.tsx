import { useState } from 'react';
import { AirtableRecord } from '@/types/airtable';
import { ExpandableDataCard } from '@/components/app/ExpandableDataCard';
import { emptySurfaceClass, errorSurfaceClass, listingSummaryClass, loadingSurfaceClass, mutedCodeClass, panelSurfaceClass, spinnerClass } from '@/components/tabs/uiClasses';

interface AirtableTabProps {
  loading: boolean;
  error: Error | null;
  listings: AirtableRecord[];
  displayValue: (value: unknown) => string;
  hasValue: (value: unknown) => boolean;
  recordTitle: (fields: Record<string, unknown>) => string;
}

export function AirtableTab({ loading, error, listings, displayValue, hasValue, recordTitle }: AirtableTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (error) {
    return (
      <section className={errorSurfaceClass}>
        <p className="m-0 font-bold text-[var(--error-text)]">Error loading Airtable records</p>
        <p className="mt-2 text-[var(--error-text)]/85">{error.message}</p>
      </section>
    );
  }

  if (loading && !listings.length) {
    return (
      <section className={loadingSurfaceClass}>
        <div className={spinnerClass} />
        <p>Loading records from Airtable...</p>
      </section>
    );
  }

  if (!loading && listings.length === 0) {
    return (
      <section className={emptySurfaceClass}>
        <p className="m-0 font-bold text-[var(--ink)]">No non-empty rows found</p>
        <p>Rows with empty field payloads are currently hidden.</p>
      </section>
    );
  }

  return (
    <section className={panelSurfaceClass}>
      <p className={listingSummaryClass}>
        Showing <strong>{listings.length}</strong> rows with meaningful data.
      </p>
      {listings.map((listing) => (
        <ExpandableDataCard
          key={listing.id}
          expanded={expandedId === listing.id}
          onToggle={() => setExpandedId(expandedId === listing.id ? null : listing.id)}
          title={recordTitle(listing.fields)}
          subtitle={<>Model: <code className={mutedCodeClass}>{displayValue(listing.fields.Model)}</code></>}
          side={(
            <>
              <p className="m-0 text-lg font-bold text-slate-900">{displayValue(listing.fields.Price)}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Distributor: {displayValue(listing.fields.Distributor)}</p>
            </>
          )}
        >
          <h4 className="m-0 mb-3 text-base font-semibold text-slate-900">Record Details</h4>
          <div className="space-y-2 text-sm text-slate-700">
            <p className="m-0"><strong>ID:</strong> <code className={mutedCodeClass}>{listing.id}</code></p>
            <p className="m-0"><strong>Created:</strong> {new Date(listing.createdTime).toLocaleString()}</p>
            {hasValue(listing.fields.Component ?? listing.fields['Component Type']) && (
              <p className="m-0"><strong>Component:</strong> {displayValue(listing.fields.Component ?? listing.fields['Component Type'])}</p>
            )}
            {hasValue(listing.fields.Status) && (
              <p className="m-0"><strong>Status:</strong> {displayValue(listing.fields.Status)}</p>
            )}
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <p className="m-0 whitespace-pre-wrap font-mono text-xs text-slate-700">{JSON.stringify(listing.fields, null, 2)}</p>
            </div>
          </div>
        </ExpandableDataCard>
      ))}
    </section>
  );
}
