import { FormEvent, useRef } from 'react';
import { HiFiSharkListing } from '@/types/hifishark';
import { primaryActionButtonClass } from '@/components/app/buttonStyles';
import { emptySurfaceClass, errorSurfaceClass, listingSummaryClass, loadingSurfaceClass, panelSurfaceClass, spinnerClass } from '@/components/tabs/uiClasses';

interface MarketTabProps {
  loading: boolean;
  error: Error | null;
  listings: HiFiSharkListing[];
  currentSlug: string;
  onSearch: (slug: string) => void;
}

export function MarketTab({ loading, error, listings, currentSlug, onSearch }: MarketTabProps) {
  const sharkInputRef = useRef<HTMLInputElement>(null);

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = sharkInputRef.current?.value?.trim();
    if (value) {
      onSearch(value);
    }
  }

  return (
    <>
      <section className={panelSurfaceClass}>
        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="shark-input" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Model Slug
              </label>
              <input
                id="shark-input"
                ref={sharkInputRef}
                type="text"
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-200"
                placeholder="e.g. accuphase-e-530"
                defaultValue={currentSlug}
              />
            </div>
            <button type="submit" className={primaryActionButtonClass} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="m-0 text-sm text-[var(--muted)]">
            Enter a HiFiShark model slug from{' '}
            <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[0.85em] text-slate-900">hifishark.com/model/accuphase-e-530</code>.
            You can also click a model in the Airtable tab to pre-fill.
          </p>
        </form>
      </section>

      {error && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Error loading market data</p>
          <p className="mt-2 text-[var(--error-text)]/85">{error.message}</p>
        </section>
      )}

      {loading && (
        <section className={loadingSurfaceClass}>
          <div className={spinnerClass} />
          <p>Fetching market listings from HiFiShark...</p>
        </section>
      )}

      {!loading && listings.length > 0 && (
        <section className={panelSurfaceClass}>
          <p className={listingSummaryClass}>
            <strong>{listings.length}</strong> listings found for <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[0.85em] text-slate-900">{currentSlug}</code>
            {' · '}
            {listings.filter((listing) => listing.price).length} with prices
            {' · '}
            lowest{' '}
            <strong>
              {(() => {
                const priced = listings.filter((listing) => listing.priceNumeric && listing.currency === 'USD');
                if (!priced.length) return 'N/A';
                const min = Math.min(...priced.map((listing) => listing.priceNumeric!));
                return `$${min.toLocaleString()}`;
              })()}
            </strong>
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Listing</th>
                  <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Site</th>
                  <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Country</th>
                  <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Price</th>
                  <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Listed</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr key={listing.id} className="transition hover:bg-slate-50/70">
                    <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">
                      <a href={listing.url} target="_blank" rel="noreferrer" className="font-medium text-[var(--accent)] hover:underline">
                        {listing.title || '(no title)'}
                      </a>
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-2.5 text-[var(--muted)]">{listing.site || '—'}</td>
                    <td className="border-b border-[var(--line)] px-3 py-2.5 text-[var(--muted)]">{listing.country || '—'}</td>
                    <td className="border-b border-[var(--line)] px-3 py-2.5 font-semibold">{listing.price || '—'}</td>
                    <td className="border-b border-[var(--line)] px-3 py-2.5 text-[var(--muted)]">{listing.listedDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && !error && listings.length === 0 && currentSlug && (
        <section className={emptySurfaceClass}>
          <p className="m-0 font-bold text-[var(--ink)]">No listings found</p>
          <p>Try a different slug or check if the model exists on HiFiShark.</p>
        </section>
      )}

      {!currentSlug && !loading && (
        <section className={emptySurfaceClass}>
          <p className="m-0 font-bold text-[var(--ink)]">Search for a model above</p>
          <p>Example slugs: <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[0.85em] text-slate-900">accuphase-e-530</code>, <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[0.85em] text-slate-900">naim-nac-282</code>, <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[0.85em] text-slate-900">wilson-audio-sasha</code></p>
        </section>
      )}
    </>
  );
}
