import { useState } from 'react';
import type { AirtableTabViewModel } from '@/app/appTabViewModels';
import { ExpandableDataCard } from '@/components/app/ExpandableDataCard';
import { EmptySurface, ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { listingSummaryClass, mutedCodeClass } from '@/components/tabs/uiClasses';

interface AirtableTabProps {
  viewModel: AirtableTabViewModel;
}

export function AirtableTab({ viewModel }: AirtableTabProps) {
  const { loading, error, listings, displayValue, hasValue, recordTitle } = viewModel;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (error) {
    return <ErrorSurface title="Error loading Airtable records" message={error.message} />;
  }

  if (loading && !listings.length) {
    return <LoadingSurface message="Loading records from Airtable..." />;
  }

  if (!loading && listings.length === 0) {
    return <EmptySurface title="No non-empty rows found" message="Rows with empty field payloads are currently hidden." />;
  }

  return (
    <PanelSurface>
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
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3">
              <p className="m-0 whitespace-pre-wrap font-mono text-xs text-[var(--muted)]">{JSON.stringify(listing.fields, null, 2)}</p>
            </div>
          </div>
        </ExpandableDataCard>
      ))}
    </PanelSurface>
  );
}
