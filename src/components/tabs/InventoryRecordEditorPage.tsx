import { useEffect, useMemo, useState } from 'react';
import {
  ListingApprovalWorkflowProcessCard,
  buildListingApprovalWorkflowSummaryData,
  getListingApprovalActiveTimelineEntry,
  type ListingApprovalWorkflowSummaryData,
} from '@/components/approval/ListingApprovalWorkflowSummary';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  loadUsedGearOperationalRecordContext,
  type UsedGearOperationalRecordContext,
} from '@/services/usedGearQueue';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';
import { getUsedGearWorkflowPostPublishSnapshot } from '@/services/usedGearWorkflowLifecycle';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { buildUsedGearWorkflowTimeline } from '@/services/usedGearWorkflowTimeline';

interface InventoryRecordEditorPageProps {
  recordId: string;
  onBackToDirectory: () => void;
  onOpenIntake: (recordId: string) => void;
  onOpenTesting: (recordId: string) => void;
  onOpenPhotos: (recordId: string) => void;
  onOpenListings: (recordId: string) => void;
  onOpenPostPublish: (bucket: UsedGearWorkflowPostPublishBucket) => void;
}

function SnapshotCard({
  title,
  description,
  fields,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  fields: Array<{ label: string; value: unknown }>;
  actionLabel?: string;
  onAction?: (() => void) | null;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{field.label}</dt>
            <dd className="m-0 mt-2 text-sm leading-6 text-[var(--ink)]">{displayInventoryValue(field.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function countFieldItems(value: unknown): string {
  if (!Array.isArray(value)) {
    return displayInventoryValue(value);
  }

  return value.length === 0 ? 'N/A' : `${value.length} item${value.length === 1 ? '' : 's'}`;
}

function buildSnapshotWorkflowSummary(record: UsedGearOperationalRecordContext['record']): ListingApprovalWorkflowSummaryData {
  const summary = buildListingApprovalWorkflowSummaryData(record);
  if (summary) {
    return summary;
  }

  const rawWorkflowStatus = typeof record.fields['Workflow Status'] === 'string'
    ? record.fields['Workflow Status'].trim()
    : '';

  return {
    workflowStatus: rawWorkflowStatus || 'Workflow Not Started',
    workflowNextTeam: '',
    timeline: buildUsedGearWorkflowTimeline(record),
    resolvedPrice: '',
    preListingReviewedBy: '',
  };
}

function getCurrentStepLabel(summary: ListingApprovalWorkflowSummaryData | null): string {
  if (!summary) {
    return 'Workflow Not Started';
  }

  const hasCompletedMilestone = summary.timeline.some((entry) => entry.status === 'completed');
  const activeEntry = getListingApprovalActiveTimelineEntry(summary.timeline, summary.workflowStatus);

  if (!activeEntry && !hasCompletedMilestone) {
    return 'Workflow Not Started';
  }

  return activeEntry?.label ?? 'Workflow Complete';
}

export function InventoryRecordEditorPage({
  recordId,
  onBackToDirectory,
  onOpenIntake,
  onOpenTesting,
  onOpenPhotos,
  onOpenListings,
  onOpenPostPublish,
}: InventoryRecordEditorPageProps) {
  const [context, setContext] = useState<UsedGearOperationalRecordContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshotState = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContext = await loadUsedGearOperationalRecordContext(recordId);
        if (cancelled) return;

        setContext(nextContext);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : 'Unable to load the selected inventory record.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSnapshotState();

    return () => {
      cancelled = true;
    };
  }, [recordId, reloadKey]);

  const record = context?.record ?? null;
  const workflowSummary = useMemo(() => (record ? buildSnapshotWorkflowSummary(record) : null), [record]);
  const workflowStatus = record ? getUsedGearWorkflowStatus(record.fields) ?? '' : '';
  const postPublishSnapshot = useMemo(() => (record ? getUsedGearWorkflowPostPublishSnapshot(record) : null), [record]);
  const currentStepLabel = useMemo(() => getCurrentStepLabel(workflowSummary), [workflowSummary]);
  const showSpecialistCards = workflowStatus !== 'Pending Review' && workflowStatus !== 'Unqualified';
  const showListingsCard = showSpecialistCards && workflowStatus !== 'Accepted - Awaiting Arrival';

  if (loading && !record) {
    return <LoadingSurface message="Loading workflow snapshot..." />;
  }

  if (error && !record) {
    return (
      <ErrorSurface title="Unable to load workflow snapshot" message={error}>
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
    <>
      <WorkflowRecordPageLayout
        eyebrow="Workflow Hub"
        title="Workflow Snapshot"
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Refresh Snapshot
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onBackToDirectory}
            >
              Back to Directory
            </button>
          </div>
        )}
      >

        {record ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Record Overview</p>
                  <h2 className="m-0 mt-2 text-2xl font-semibold text-[var(--ink)]">SKU {displayInventoryValue(record.fields.SKU)}</h2>
                </div>
                <span className="rounded-full border border-sky-400/35 bg-sky-500/15 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-sky-100">
                  Current Step: {currentStepLabel}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {context?.group
                  ? `Grouped intake: ${context.group.label} with ${context.group.records.length} row${context.group.records.length === 1 ? '' : 's'}.`
                  : 'Grouped intake: single record.'}
              </p>
            </section>

            <ListingApprovalWorkflowProcessCard summary={workflowSummary} timelineOnly />

            <div className="grid gap-6 xl:grid-cols-2">
              <SnapshotCard
                title="Intake Data"
                description="Shared pre-listing intake data that can be edited anywhere in the workflow before listing is made."
                actionLabel="Open Intake"
                onAction={() => onOpenIntake(record.id)}
                fields={[
                  { label: 'Arrival Date', value: record.fields['Arrival Date'] },
                  { label: 'Acquired From', value: record.fields['Acquired From'] },
                  { label: 'Cost', value: record.fields.Cost },
                  { label: 'Make / Model', value: `${displayInventoryValue(record.fields.Make)} ${displayInventoryValue(record.fields.Model)}`.trim() },
                  { label: 'Component Type', value: record.fields['Component Type'] },
                  { label: 'Customer Cosmetic Notes', value: record.fields['Customer Cosmetic Notes'] },
                  { label: 'Customer Functional Notes', value: record.fields['Customer Functional Notes'] },
                  { label: 'Inventory Notes', value: record.fields['Inventory Notes'] },
                ]}
              />

              <SnapshotCard
                title="Testing"
                description="Bench-work notes and completion state for the testing stage."
                actionLabel={showSpecialistCards ? 'Open Testing' : undefined}
                onAction={showSpecialistCards ? () => onOpenTesting(record.id) : null}
                fields={[
                  { label: 'Testing Notes', value: record.fields['Testing Notes'] },
                  { label: 'Testing Cosmetic Notes', value: record.fields['Testing Cosmetic Notes'] },
                  { label: 'Testing Time', value: record.fields['Testing Time'] },
                  { label: 'Tested', value: record.fields.Tested },
                ]}
              />

              <SnapshotCard
                title="Photography"
                description="Photography notes, deliverables, and completion state for the photo stage."
                actionLabel={showSpecialistCards ? 'Open Photos' : undefined}
                onAction={showSpecialistCards ? () => onOpenPhotos(record.id) : null}
                fields={[
                  { label: 'Photography Cosmetic Notes', value: record.fields['Photography Cosmetic Notes'] },
                  { label: "Photo'd", value: record.fields["Photo'd"] },
                  { label: 'Images', value: countFieldItems(record.fields.Images) },
                  { label: 'Additional Items', value: record.fields['Additional Items'] },
                ]}
              />

              <SnapshotCard
                title="Listings"
                description="Marketplace-facing content and pricing readiness before or after publish."
                actionLabel={showListingsCard ? 'Open Listings' : undefined}
                onAction={showListingsCard ? () => onOpenListings(record.id) : null}
                fields={[
                  { label: 'Item Title', value: record.fields['Item Title'] },
                  { label: 'Shopify Price', value: record.fields['Shopify Price'] },
                  { label: 'eBay Price', value: record.fields['Ebay Price'] },
                  { label: 'Shopify Tags', value: countFieldItems(record.fields['Shopify Tags']) },
                  { label: 'eBay Categories', value: countFieldItems(record.fields['Ebay Categories']) },
                  { label: 'Shopify Approved', value: record.fields['Shopify Approved'] },
                  { label: 'eBay Approved', value: record.fields['Ebay Approved'] },
                ]}
              />

              {postPublishSnapshot ? (
                <SnapshotCard
                  title="Post-Publish"
                  description="Live-listing lifecycle and stale or shipment follow-through context once publish has started."
                  actionLabel="Open Post-Publish"
                  onAction={() => onOpenPostPublish(postPublishSnapshot.bucket)}
                  fields={[
                    { label: 'Current Post-Publish Status', value: postPublishSnapshot.status },
                    { label: 'Listed At', value: postPublishSnapshot.listedAt },
                    { label: 'Stale Recovery Status', value: postPublishSnapshot.staleRecoveryStatus },
                    { label: 'Relisted At', value: postPublishSnapshot.relistedAt },
                    { label: 'Sold Ready To Ship At', value: postPublishSnapshot.soldReadyToShipAt },
                    { label: 'Shipped At', value: postPublishSnapshot.shippedAt },
                  ]}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </WorkflowRecordPageLayout>
    </>
  );
}