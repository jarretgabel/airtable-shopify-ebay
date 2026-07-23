import { useEffect, useState } from 'react';
import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import {
  buildListingApprovalWorkflowSummaryData,
  ListingApprovalWorkflowProcessCard,
  type ListingApprovalWorkflowSummaryData,
} from '@/components/approval/ListingApprovalWorkflowSummary';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { EmptySurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
  detailPreBlockClass,
  infoPillClass,
  insetPanelClass,
  insetPanelMutedClass,
  sectionLabelClass,
  sectionTitleDescriptionClass,
  sectionTitleHeadingClass,
  snapshotOpenListingsButtonClass,
} from '@/components/tabs/uiClasses';
import type { EbayTabViewModel } from '@/app/appTabViewModels';
import { loadUsedGearOperationalRecordBySku } from '@/services/usedGearQueue';
import type { EbayInventoryItem, EbayOffer, EbayPublishedListing } from '@/services/ebay/types';

interface EbaySnapshotRecordPageProps {
  recordId: string;
  viewModel: EbayTabViewModel;
  onBackToSnapshot: () => void;
  onOpenListings: () => void;
  onOpenOperationalRecord: (recordId: string) => void;
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
    <div className={`${insetPanelClass} px-3 py-2`}>
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
      <h3 className={sectionTitleHeadingClass}>{title}</h3>
      <p className={sectionTitleDescriptionClass}>{description}</p>
    </div>
  );
}

function humanizeCondition(value?: string): string {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()) : '—';
}

function DetailJsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <details className={detailDisclosureClass}>
      <summary className={detailDisclosureSummaryClass}>{title}</summary>
      <div className={detailDisclosureBodyClass}>
        <pre className={detailPreBlockClass}>{stringifyJson(value)}</pre>
      </div>
    </details>
  );
}

export function EbaySnapshotRecordPage({
  recordId,
  viewModel,
  onBackToSnapshot,
  onOpenListings,
  onOpenOperationalRecord,
}: EbaySnapshotRecordPageProps) {
  const [workflowSummary, setWorkflowSummary] = useState<ListingApprovalWorkflowSummaryData | null>(null);
  const [operationalRecordId, setOperationalRecordId] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const item = viewModel.inventory.items.find((entry) => entry.sku === recordId);
  const offer = viewModel.inventory.offers.find((entry) => entry.sku === recordId);
  const recentListing = viewModel.inventory.recentListings.find((entry) => entry.item.sku === recordId);
  const snapshotItem = viewModel.inventory.items.find((entry) => entry.snapshotId === recordId || entry.sourceRecordId === recordId);
  const snapshotOffer = viewModel.inventory.offers.find((entry) => entry.snapshotId === recordId || entry.sourceRecordId === recordId);
  const snapshotRecentListing = viewModel.inventory.recentListings.find((entry) => entry.item.snapshotId === recordId || entry.item.sourceRecordId === recordId);

  const resolvedDirectItem = item ?? snapshotItem;
  const resolvedDirectOffer = offer ?? snapshotOffer;
  const resolvedRecentListing = recentListing ?? snapshotRecentListing;

  const resolvedItem = resolvedDirectItem ?? resolvedRecentListing?.item;
  const resolvedOffer = resolvedDirectOffer ?? resolvedRecentListing?.offer;
  const htmlPreview = resolvedOffer?.listingDescription ?? resolvedItem?.product?.description ?? '';
  const aspects = resolvedItem?.product?.aspects ? Object.entries(resolvedItem.product.aspects) : [];
  const imageUrls = resolvedItem?.product?.imageUrls ?? [];
  const listingPolicies = resolvedOffer?.listingPolicies;
  const workflowSku = resolvedItem?.sku?.trim() || resolvedOffer?.sku?.trim() || '';
  const headerActions = (
    <>
      <BackToolbarButton label="Back to eBay Snapshot" onClick={onBackToSnapshot} />
      <button type="button" className={snapshotOpenListingsButtonClass} onClick={onOpenListings}>Open Listings</button>
    </>
  );

  useEffect(() => {
    let cancelled = false;

    if (!workflowSku) {
      setWorkflowSummary(null);
      setOperationalRecordId(null);
      setWorkflowLoading(false);
      setWorkflowError('This eBay snapshot does not expose a SKU for workflow matching.');
      return () => {
        cancelled = true;
      };
    }

    setWorkflowLoading(true);
    setWorkflowError(null);

    void loadUsedGearOperationalRecordBySku(workflowSku)
      .then((record) => {
        if (cancelled) {
          return;
        }

        setWorkflowSummary(buildListingApprovalWorkflowSummaryData(record));
        setOperationalRecordId(record.id);
      })
      .catch((lookupError) => {
        if (cancelled) {
          return;
        }

        setWorkflowSummary(null);
        setOperationalRecordId(null);
        setWorkflowError(lookupError instanceof Error ? lookupError.message : 'Unable to load the used-gear operational row for this eBay snapshot.');
      })
      .finally(() => {
        if (!cancelled) {
          setWorkflowLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workflowSku]);

  if (viewModel.state.loading && viewModel.inventory.items.length === 0 && viewModel.inventory.recentListings.length === 0) {
    return (
      <WorkflowRecordPageLayout eyebrow="eBay Listing Snapshot" title="eBay Snapshot" actions={headerActions}>
        <LoadingSurface message="Loading eBay snapshot..." />
      </WorkflowRecordPageLayout>
    );
  }

  if (!resolvedDirectItem && !resolvedDirectOffer && !resolvedRecentListing) {
    return (
      <WorkflowRecordPageLayout eyebrow="eBay Listing Snapshot" title="eBay Snapshot" actions={headerActions}>
        <EmptySurface title="eBay snapshot not found" message="This SKU is no longer available in the current eBay snapshot.">
          <div className="mt-4 flex flex-wrap gap-2">
            <BackToolbarButton label="Back to eBay Snapshot" onClick={onBackToSnapshot} />
            <button type="button" className={snapshotOpenListingsButtonClass} onClick={onOpenListings}>Open Listings</button>
          </div>
        </EmptySurface>
      </WorkflowRecordPageLayout>
    );
  }

  return (
    <WorkflowRecordPageLayout eyebrow="eBay Listing Snapshot" title="eBay Snapshot" actions={headerActions}>

      <ListingApprovalWorkflowProcessCard
        summary={workflowSummary}
        eyebrow="Workflow Match"
        title="Workflow Status For This eBay Snapshot"
        loading={workflowLoading}
        error={workflowError}
        description="Cross-referenced from the used-gear workflow by SKU so you can see where this read-only eBay snapshot sits in the intake-to-listing pipeline."
        emptyMessage="No used-gear operational row is linked to this eBay snapshot yet."
        primaryActionLabel="Open Listings"
        onPrimaryAction={onOpenListings}
        secondaryActionLabel={operationalRecordId ? 'Edit Workflow Record' : undefined}
        onSecondaryAction={operationalRecordId ? () => onOpenOperationalRecord(operationalRecordId) : null}
      />

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
          <div className={insetPanelClass}>
            <p className={sectionLabelClass}>Pricing And Publishing</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FieldRow label="Price" value={formatMoney(resolvedOffer?.pricingSummary?.price)} />
              <FieldRow label="Include Catalog Details" value={resolvedOffer?.includeCatalogProductDetails === undefined ? '—' : resolvedOffer.includeCatalogProductDetails ? 'Yes' : 'No'} />
              <FieldRow label="Offer Status" value={resolvedOffer?.status ?? '—'} />
              <FieldRow label="Recent Listing" value={resolvedRecentListing ? 'Yes' : 'No'} />
            </div>
          </div>
          <div className={insetPanelClass}>
            <p className={sectionLabelClass}>Business Policies</p>
            <p className="m-0 mt-2 text-xs text-[var(--muted)]">
              <a
                className="text-[var(--link)] underline decoration-dotted underline-offset-2 hover:opacity-90"
                href="https://www.ebay.com/bp/manage?sortType=-listingCount&_pgn=1&limit=25"
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage business policies
              </a>
            </p>
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
            <div className={insetPanelClass}>
              <p className={sectionLabelClass}>Product Metadata</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FieldRow label="Title" value={resolvedItem?.product?.title ?? '—'} />
                <FieldRow label="Brand" value={resolvedItem?.product?.brand ?? '—'} />
                <FieldRow label="MPN" value={resolvedItem?.product?.mpn ?? '—'} />
                <FieldRow label="Condition Notes" value={resolvedItem?.conditionDescription ?? '—'} />
              </div>
            </div>
            <div className={insetPanelClass}>
              <p className={sectionLabelClass}>Aspects</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aspects.length > 0 ? aspects.map(([key, values]) => (
                  <span key={key} className={infoPillClass}>{key}: {values.join(', ')}</span>
                )) : <p className="m-0 text-sm text-[var(--muted)]">No item aspects on this record.</p>}
              </div>
            </div>
          </div>
          <div className={insetPanelClass}>
            <p className={sectionLabelClass}>Images</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {imageUrls.length > 0 ? imageUrls.map((imageUrl, index) => (
                <figure key={`${imageUrl}-${index}`} className={`${insetPanelMutedClass} m-0 overflow-hidden`}>
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
          {resolvedRecentListing && <DetailJsonPanel title="Recent Listing JSON" value={resolvedRecentListing as EbayPublishedListing} />}
        </div>
      </PanelSurface>
    </WorkflowRecordPageLayout>
  );
}