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
import type { ShopifyTabViewModel } from '@/app/appTabViewModels';
import { loadUsedGearOperationalRecordBySku } from '@/services/usedGearQueue';
import type { ShopifyProduct } from '@/types/shopify';

interface ShopifySnapshotRecordPageProps {
  productId: string;
  viewModel: ShopifyTabViewModel;
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
    <div className="rounded-lg border border-[var(--line)] bg-white/5 px-3 py-2">
      <p className="m-0 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="m-0 mt-1 text-sm text-[var(--ink)] break-words">{value || '—'}</p>
    </div>
  );
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function trimProductType(value?: string): string {
  if (!value) return '—';
  const lastGt = value.lastIndexOf('>');
  return lastGt >= 0 ? value.slice(lastGt + 1).trim() : value;
}

function formatMoney(value?: string | null): string {
  return value ? `$${value}` : '—';
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="m-0 text-base font-semibold text-[var(--ink)]">{title}</h3>
      <p className="m-0 mt-2 text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
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

export function ShopifySnapshotRecordPage({
  productId,
  viewModel,
  onBackToSnapshot,
  onOpenListings,
  onOpenOperationalRecord,
}: ShopifySnapshotRecordPageProps) {
  const [workflowSummary, setWorkflowSummary] = useState<ListingApprovalWorkflowSummaryData | null>(null);
  const [operationalRecordId, setOperationalRecordId] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const product = viewModel.products.find((entry) => String(entry.id) === productId) as (ShopifyProduct & { id: number; created_at: string; updated_at: string }) | undefined;
  const tags = product?.tags ? product.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  const options = product?.options?.filter((option) => !(product.options?.length === 1 && option.name === 'Title')) ?? [];
  const variants = product?.variants ?? [];
  const images = product?.images ?? [];
  const metafields = product?.metafields ?? [];
  const workflowSku = variants.map((variant) => variant.sku?.trim() ?? '').find(Boolean) ?? '';
  const headerActions = (
    <>
      <BackToolbarButton label="Back to Shopify Snapshot" onClick={onBackToSnapshot} />
      <button type="button" className="rounded-md border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100" onClick={onOpenListings}>Open Listings</button>
    </>
  );

  useEffect(() => {
    let cancelled = false;

    if (!workflowSku) {
      setWorkflowSummary(null);
      setOperationalRecordId(null);
      setWorkflowLoading(false);
      setWorkflowError('This Shopify snapshot does not expose a SKU for workflow matching.');
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
        setWorkflowError(lookupError instanceof Error ? lookupError.message : 'Unable to load the used-gear operational row for this Shopify snapshot.');
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

  if (viewModel.loading && viewModel.products.length === 0) {
    return (
      <WorkflowRecordPageLayout eyebrow="Channels" title="Shopify Snapshot" actions={headerActions}>
        <LoadingSurface message="Loading Shopify snapshot..." />
      </WorkflowRecordPageLayout>
    );
  }

  if (!product) {
    return (
      <WorkflowRecordPageLayout eyebrow="Channels" title="Shopify Snapshot" actions={headerActions}>
        <EmptySurface title="Shopify snapshot not found" message="This product is no longer available in the current Shopify snapshot.">
          <div className="mt-4 flex flex-wrap gap-2">
            <BackToolbarButton label="Back to Shopify Snapshot" onClick={onBackToSnapshot} />
            <button type="button" className="rounded-md border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100" onClick={onOpenListings}>Open Listings</button>
          </div>
        </EmptySurface>
      </WorkflowRecordPageLayout>
    );
  }

  return (
    <WorkflowRecordPageLayout eyebrow="Channels" title="Shopify Snapshot" actions={headerActions}>

      <ListingApprovalWorkflowProcessCard
        summary={workflowSummary}
        eyebrow="Workflow Match"
        title="Workflow Status For This Shopify Snapshot"
        loading={workflowLoading}
        error={workflowError}
        description="Cross-referenced from the used-gear workflow by SKU so you can see where this read-only Shopify snapshot sits in the intake-to-listing pipeline."
        emptyMessage="No used-gear operational row is linked to this Shopify snapshot yet."
        primaryActionLabel="Open Listings"
        onPrimaryAction={onOpenListings}
        secondaryActionLabel={operationalRecordId ? 'Edit Workflow Record' : undefined}
        onSecondaryAction={operationalRecordId ? () => onOpenOperationalRecord(operationalRecordId) : null}
      />

      <PanelSurface>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FieldRow label="Product ID" value={String(product.id)} />
          <FieldRow label="Status" value={product.status ?? '—'} />
          <FieldRow label="Vendor" value={product.vendor ?? '—'} />
          <FieldRow label="Product Type" value={trimProductType(product.product_type)} />
          <FieldRow label="Handle" value={product.handle ?? '—'} />
          <FieldRow label="Published At" value={formatDateTime(product.published_at)} />
          <FieldRow label="Created At" value={formatDateTime(product.created_at)} />
          <FieldRow label="Updated At" value={formatDateTime(product.updated_at)} />
          <FieldRow label="Published Scope" value={product.published_scope ?? '—'} />
          <FieldRow label="Template Suffix" value={product.template_suffix ?? '—'} />
          <FieldRow label="Variants" value={String(variants.length)} />
          <FieldRow label="Images" value={String(images.length)} />
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="Merchandising Details" description="Snapshot of the customer-facing content that drives the Shopify listing." />
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Body Copy</p>
            <p className="m-0 mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">{product.body_html ? product.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '—' : '—'}</p>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.length > 0 ? tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-[var(--line)] bg-black/20 px-2.5 py-1 text-xs text-[var(--ink)]">{tag}</span>
                )) : <p className="m-0 text-sm text-[var(--muted)]">No tags on this Shopify product.</p>}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Options</p>
              <div className="mt-3 space-y-2">
                {options.length > 0 ? options.map((option) => (
                  <div key={option.name} className="rounded-md border border-[var(--line)] bg-black/20 px-3 py-2">
                    <p className="m-0 text-sm font-semibold text-[var(--ink)]">{option.name}</p>
                    <p className="m-0 mt-1 text-xs text-[var(--muted)]">{option.values.join(', ') || '—'}</p>
                  </div>
                )) : <p className="m-0 text-sm text-[var(--muted)]">No multi-value options on this product.</p>}
              </div>
            </div>
          </div>
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="Variant Breakdown" description="Inventory-facing variant data captured from the live Shopify product." />
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-black/20 text-left text-xs font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-3 py-2">Variant</th>
                <th scope="col" className="px-3 py-2">SKU</th>
                <th scope="col" className="px-3 py-2">Price</th>
                <th scope="col" className="px-3 py-2">Compare At</th>
                <th scope="col" className="px-3 py-2">Qty</th>
                <th scope="col" className="px-3 py-2">Inventory</th>
                <th scope="col" className="px-3 py-2">Shipping</th>
                <th scope="col" className="px-3 py-2">Weight</th>
              </tr>
            </thead>
            <tbody>
              {variants.length > 0 ? variants.map((variant, index) => (
                <tr key={variant.id ?? index} className="border-t border-[var(--line)] text-[var(--ink)]">
                  <td className="px-3 py-2">{variant.title || `Variant ${index + 1}`}</td>
                  <td className="px-3 py-2 font-mono text-[var(--muted)]">{variant.sku || '—'}</td>
                  <td className="px-3 py-2">{formatMoney(variant.price)}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{formatMoney(variant.compare_at_price)}</td>
                  <td className="px-3 py-2">{variant.inventory_quantity ?? '—'}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{variant.inventory_management || variant.inventory_policy || '—'}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{variant.requires_shipping === undefined ? '—' : variant.requires_shipping ? 'Requires shipping' : 'No shipping'}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{variant.weight != null ? `${variant.weight} ${variant.weight_unit ?? ''}`.trim() : '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-3 py-4 text-sm text-[var(--muted)]" colSpan={8}>No variants on this product.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="Media And Metafields" description="Supporting assets and Shopify-specific metadata surfaced on this snapshot." />
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Images</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {images.length > 0 ? images.map((image, index) => (
                <figure key={image.id ?? index} className="m-0 overflow-hidden rounded-lg border border-[var(--line)] bg-black/20">
                  <img src={image.src} alt={image.alt || `Product image ${index + 1}`} className="h-36 w-full object-cover" loading="lazy" />
                  <figcaption className="px-3 py-2 text-xs text-[var(--muted)]">Image #{image.position ?? index + 1}{image.alt ? ` · ${image.alt}` : ''}</figcaption>
                </figure>
              )) : <p className="m-0 text-sm text-[var(--muted)]">No Shopify media on this product.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white/5 p-4">
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Metafields</p>
            <div className="mt-3 space-y-2">
              {metafields.length > 0 ? metafields.map((metafield, index) => (
                <div key={metafield.id ?? `${metafield.namespace}.${metafield.key}.${index}`} className="rounded-md border border-[var(--line)] bg-black/20 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 text-sm font-semibold text-[var(--ink)]">{metafield.namespace}.{metafield.key}</p>
                    <span className="rounded-full border border-[var(--line)] bg-white/5 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.05em] text-[var(--muted)]">{metafield.type}</span>
                  </div>
                  <pre className="m-0 mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-[var(--line)] bg-black/30 p-2 text-xs text-[var(--ink)]">{metafield.value}</pre>
                </div>
              )) : <p className="m-0 text-sm text-[var(--muted)]">No Shopify metafields on this product.</p>}
            </div>
          </div>
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="HTML Preview" description="Shopify body HTML rendered from the live store record." />
        <div className="mt-4">
          <BodyHtmlPreview
            value={product.body_html ?? ''}
            helperText="Rendered from the current Shopify product body_html field."
            emptyStateText="This Shopify product does not have body HTML."
          />
        </div>
      </PanelSurface>

      <PanelSurface>
        <SectionTitle title="JSON Preview" description="Raw Shopify product payload captured for this snapshot route." />
        <div className="mt-4 space-y-4">
          <DetailJsonPanel title="Shopify Product JSON" value={product} />
        </div>
      </PanelSurface>
    </WorkflowRecordPageLayout>
  );
}