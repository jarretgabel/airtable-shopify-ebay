import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import { EmptySurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import type { EbayTabViewModel } from '@/app/appTabViewModels';
import type { EbayInventoryItem, EbayOffer, EbayPublishedListing } from '@/services/ebay/types';

interface EbaySnapshotRecordPageProps {
  recordId: string;
  viewModel: EbayTabViewModel;
  onBackToSnapshot: () => void;
  onOpenListings: () => void;
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{\n  "error": "Unable to serialize value"\n}';
  }
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white/5 px-3 py-2">
      <p className="m-0 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="m-0 mt-1 text-sm text-[var(--ink)] break-words">{value || '—'}</p>
    </div>
  );
}

function formatMoney(value?: { value: string; currency: string }): string {
  if (!value) return '—';
  const prefix = value.currency === 'USD' ? '$' : `${value.currency} `;
  return `${prefix}${Number(value.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="m-0 text-base font-semibold text-[var(--ink)]">{title}</h3>
      <p className="m-0 mt-2 text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}

function humanizeCondition(value?: string): string {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()) : '—';
}

function DetailJsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-lg border border-[var(--line)] bg-white/5">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">{title}</summary>
      <div className="border-t border-[var(--line)] px-3 py-3">
        <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{stringifyJson(value)}</pre>
      </div>
    </details>
  );
}

export function EbaySnapshotRecordPage({
  recordId,
  viewModel,
  onBackToSnapshot,
  onOpenListings,
}: EbaySnapshotRecordPageProps) {
  if (viewModel.state.loading && viewModel.inventory.items.length === 0 && viewModel.inventory.recentListings.length === 0) {
    return <LoadingSurface message="Loading eBay snapshot..." />;
  }

  const item = viewModel.inventory.items.find((entry) => entry.sku === recordId);
  const offer = viewModel.inventory.offers.find((entry) => entry.sku === recordId);
  const recentListing = viewModel.inventory.recentListings.find((entry) => entry.item.sku === recordId);

  if (!item && !offer && !recentListing) {
    return (
      <EmptySurface title="eBay snapshot not found" message="This SKU is no longer available in the current eBay snapshot.">
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-md border border-[var(--line)] bg-white/5 px-3 py-2 text-sm font-semibold text-[var(--ink)]" onClick={onBackToSnapshot}>Back to eBay Snapshot</button>
          <button type="button" className="rounded-md border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100" onClick={onOpenListings}>Open Listings</button>
        </div>
      </EmptySurface>
    );
  }

  const resolvedItem = item ?? recentListing?.item;
  const resolvedOffer = offer ?? recentListing?.offer;
  const htmlPreview = resolvedOffer?.listingDescription ?? resolvedItem?.product?.description ?? '';
  const aspects = resolvedItem?.product?.aspects ? Object.entries(resolvedItem.product.aspects) : [];
  const imageUrls = resolvedItem?.product?.imageUrls ?? [];
  const listingPolicies = resolvedOffer?.listingPolicies;

  return (
    <div className="space-y-4">
      <PanelSurface>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">eBay Snapshot</p>
            <h2 className="m-0 mt-1 text-[1.18rem] font-semibold text-[var(--ink)]">{resolvedItem?.product?.title ?? resolvedOffer?.listingId ?? recordId}</h2>
            <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Read-only eBay detail snapshot. Use the combined Listings page for any listing edits or publishing workflow changes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-[var(--line)] bg-white/5 px-3 py-2 text-sm font-semibold text-[var(--ink)]" onClick={onBackToSnapshot}>Back to eBay Snapshot</button>
            <button type="button" className="rounded-md border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100" onClick={onOpenListings}>Open Listings</button>
          </div>
        </div>
      </PanelSurface>

      <PanelSurface>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FieldRow label="SKU" value={resolvedItem?.sku ?? resolvedOffer?.sku ?? recordId} />
          <FieldRow label="Offer Status" value={resolvedOffer?.status ?? '—'} />
          <FieldRow label="Listing ID" value={resolvedOffer?.listingId ?? '—'} />
          <FieldRow label="Offer ID" value={resolvedOffer?.offerId ?? '—'} />
          <FieldRow label="Category ID" value={resolvedOffer?.categoryId ?? '—'} />
          <FieldRow label="Marketplace" value={resolvedOffer?.marketplaceId ?? '—'} />
          <FieldRow label="Condition" value={humanizeCondition(resolvedItem?.condition)} />
          <FieldRow label="Available Quantity" value={String(resolvedOffer?.availableQuantity ?? resolvedItem?.availability?.shipToLocationAvailability?.quantity ?? '—')} />
          <FieldRow label="Format" value={resolvedOffer?.format ?? '—'} />
          <FieldRow label="Duration" value={resolvedOffer?.listingDuration ?? '—'} />
          <FieldRow label="Merchant Location" value={resolvedOffer?.merchantLocationKey ?? '—'} />
          <FieldRow label="Price" value={formatMoney(resolvedOffer?.pricingSummary?.price)} />
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="Offer Setup" description="Marketplace, pricing, and policy configuration present on this eBay snapshot." />
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Pricing And Publishing</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FieldRow label="Price" value={formatMoney(resolvedOffer?.pricingSummary?.price)} />
              <FieldRow label="Include Catalog Details" value={resolvedOffer?.includeCatalogProductDetails === undefined ? '—' : resolvedOffer.includeCatalogProductDetails ? 'Yes' : 'No'} />
              <FieldRow label="Offer Status" value={resolvedOffer?.status ?? '—'} />
              <FieldRow label="Recent Listing" value={recentListing ? 'Yes' : 'No'} />
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Business Policies</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FieldRow label="Fulfillment Policy" value={listingPolicies?.fulfillmentPolicyId ?? '—'} />
              <FieldRow label="Payment Policy" value={listingPolicies?.paymentPolicyId ?? '—'} />
              <FieldRow label="Return Policy" value={listingPolicies?.returnPolicyId ?? '—'} />
              <FieldRow label="Category ID" value={resolvedOffer?.categoryId ?? '—'} />
            </div>
          </div>
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="Inventory Details" description="Product-facing information from the current inventory item snapshot." />
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Product Metadata</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FieldRow label="Title" value={resolvedItem?.product?.title ?? '—'} />
                <FieldRow label="Brand" value={resolvedItem?.product?.brand ?? '—'} />
                <FieldRow label="MPN" value={resolvedItem?.product?.mpn ?? '—'} />
                <FieldRow label="Condition Notes" value={resolvedItem?.conditionDescription ?? '—'} />
              </div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Aspects</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aspects.length > 0 ? aspects.map(([key, values]) => (
                  <span key={key} className="rounded-full border border-blue-400/35 bg-blue-500/20 px-2.5 py-1 text-xs text-blue-100">{key}: {values.join(', ')}</span>
                )) : <p className="m-0 text-sm text-[var(--muted)]">No item aspects on this record.</p>}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Images</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {imageUrls.length > 0 ? imageUrls.map((imageUrl, index) => (
                <figure key={`${imageUrl}-${index}`} className="m-0 overflow-hidden rounded-lg border border-[var(--line)] bg-black/20">
                  <img src={imageUrl} alt={`${resolvedItem?.product?.title ?? recordId} image ${index + 1}`} className="h-36 w-full object-cover" loading="lazy" />
                  <figcaption className="px-3 py-2 text-xs text-[var(--muted)]">Image #{index + 1}</figcaption>
                </figure>
              )) : <p className="m-0 text-sm text-[var(--muted)]">No inventory images on this record.</p>}
            </div>
          </div>
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="HTML Preview" description="Rendered from the eBay listing description or the inventory description fallback." />
        <div className="mt-4">
          <BodyHtmlPreview
            value={htmlPreview}
            helperText="Rendered from the current eBay listingDescription or inventory description."
            emptyStateText="This eBay snapshot does not include listing HTML."
          />
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="JSON Preview" description="Raw eBay snapshot objects for this SKU." />
        <div className="mt-4 space-y-4">
          {resolvedItem && <DetailJsonPanel title="Inventory Item JSON" value={resolvedItem as EbayInventoryItem} />}
          {resolvedOffer && <DetailJsonPanel title="Offer JSON" value={resolvedOffer as EbayOffer} />}
          {recentListing && <DetailJsonPanel title="Recent Listing JSON" value={recentListing as EbayPublishedListing} />}
        </div>
      </PanelSurface>
    </div>
  );
}