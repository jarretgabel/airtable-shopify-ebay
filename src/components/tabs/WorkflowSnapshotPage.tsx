import { useEffect, useMemo, useState } from 'react';
import {
  ListingApprovalWorkflowProcessCard,
  buildListingApprovalWorkflowSummaryData,
  type ListingApprovalWorkflowSummaryData,
} from '@/components/approval/ListingApprovalWorkflowSummary';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { WorkflowReferenceImagesPanel } from '@/components/tabs/WorkflowReferenceImagesPanel';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { getUsedGearRecordItemTitle } from '@/services/usedGearItemTitle';
import {
  loadUsedGearOperationalRecordContext,
  type UsedGearOperationalRecordContext,
} from '@/services/usedGearQueue';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';
import { getUsedGearWorkflowPostPublishSnapshot } from '@/services/usedGearWorkflowLifecycle';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { buildUsedGearWorkflowTimeline } from '@/services/usedGearWorkflowTimeline';
import {
  filterWorkflowImageMetadataByStage,
  parseWorkflowImageMetadata,
} from '@/services/workflowImageMetadata';

interface WorkflowSnapshotPageProps {
  recordId: string;
  onBackToDirectory: () => void;
  onOpenIntake: (recordId: string) => void;
  onOpenTesting: (recordId: string) => void;
  onOpenPhotos: (recordId: string) => void;
  onOpenListings: (recordId: string) => void;
  onOpenPostPublish: (bucket: UsedGearWorkflowPostPublishBucket) => void;
}

type WorkflowSnapshotSectionKey = 'overview' | 'timeline' | 'intake' | 'testing' | 'photography' | 'listings' | 'post-publish';

const WORKFLOW_SNAPSHOT_SECTION_ITEMS: Array<{ id: WorkflowSnapshotSectionKey; key: WorkflowSnapshotSectionKey; label: string }> = [
  { id: 'overview', key: 'overview', label: 'Overview' },
  { id: 'timeline', key: 'timeline', label: 'Timeline' },
  { id: 'intake', key: 'intake', label: 'Intake' },
  { id: 'testing', key: 'testing', label: 'Testing' },
  { id: 'photography', key: 'photography', label: 'Photography' },
  { id: 'listings', key: 'listings', label: 'Listings' },
  { id: 'post-publish', key: 'post-publish', label: 'Post-Publish' },
];

function SnapshotCard({
  sectionId,
  title,
  fields,
  actionLabel,
  onAction,
  children,
}: {
  sectionId: WorkflowSnapshotSectionKey;
  title: string;
  fields: Array<{ label: string; value: unknown }>;
  actionLabel?: string;
  onAction?: (() => void) | null;
  children?: React.ReactNode;
}) {
  return (
    <section id={sectionId} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] scroll-mt-28">
      <AppSectionTitle
        title={title}
        actions={actionLabel && onAction
          ? <CompactIconActionButton label={actionLabel} variant="small-secondary" icon="edit" onClick={onAction} />
          : undefined}
        className="pt-0"
      />

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{field.label}</dt>
            <dd className="m-0 mt-2 text-sm leading-6 text-[var(--ink)]">{displayInventoryValue(field.value)}</dd>
          </div>
        ))}
      </dl>

      {children}
    </section>
  );
}

interface SnapshotReferenceImage {
  id?: string;
  url?: string;
  filename: string;
}

function buildSnapshotStageImages(record: UsedGearOperationalRecordContext['record']): {
  intakeImages: SnapshotReferenceImage[];
  testingImages: SnapshotReferenceImage[];
  photographyImages: SnapshotReferenceImage[];
} {
  const parsedMetadata = parseWorkflowImageMetadata(record.fields['Workflow Image Metadata JSON']);

  if (parsedMetadata.length > 0) {
    return {
      intakeImages: filterWorkflowImageMetadataByStage(parsedMetadata, 'intake').map((image) => ({
        id: image.attachmentId,
        url: image.url,
        filename: image.filename,
      })),
      testingImages: filterWorkflowImageMetadataByStage(parsedMetadata, 'testing').map((image) => ({
        id: image.attachmentId,
        url: image.url,
        filename: image.filename,
      })),
      photographyImages: filterWorkflowImageMetadataByStage(parsedMetadata, 'photos').map((image) => ({
        id: image.attachmentId,
        url: image.url,
        filename: image.filename,
      })),
    };
  }
  return {
    intakeImages: [],
    testingImages: [],
    photographyImages: [],
  };
}

function countPhotographyImages(record: UsedGearOperationalRecordContext['record']): string {
  const parsedMetadata = parseWorkflowImageMetadata(record.fields['Workflow Image Metadata JSON']);
  const photographyImages = filterWorkflowImageMetadataByStage(parsedMetadata, 'photos');
  const count = photographyImages.length;
  if (count > 0) {
    return `${count} item${count === 1 ? '' : 's'}`;
  }

  return countFieldItems(record.fields.Images);
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

export function WorkflowSnapshotPage({
  recordId,
  onBackToDirectory,
  onOpenIntake,
  onOpenTesting,
  onOpenPhotos,
  onOpenListings,
  onOpenPostPublish,
}: WorkflowSnapshotPageProps) {
  const [context, setContext] = useState<UsedGearOperationalRecordContext | null>(null);
  const [loading, setLoading] = useState(true);
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
  }, [recordId]);

  const record = context?.record ?? null;
  const workflowSummary = useMemo(() => (record ? buildSnapshotWorkflowSummary(record) : null), [record]);
  const workflowStatus = record ? getUsedGearWorkflowStatus(record.fields) ?? '' : '';
  const stageImages = useMemo(() => (record ? buildSnapshotStageImages(record) : { intakeImages: [], testingImages: [], photographyImages: [] }), [record]);
  const postPublishSnapshot = useMemo(() => (record ? getUsedGearWorkflowPostPublishSnapshot(record) : null), [record]);
  const showSpecialistCards = workflowStatus !== 'Pending Review' && workflowStatus !== 'Unqualified';
  const showListingsCard = showSpecialistCards && workflowStatus !== 'Accepted - Awaiting Arrival';
  const sectionItems = useMemo(
    () => WORKFLOW_SNAPSHOT_SECTION_ITEMS.filter((item) => item.id !== 'post-publish' || Boolean(postPublishSnapshot)),
    [postPublishSnapshot],
  );
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, sectionItems[0]?.id ?? 'overview');

  const sectionNav = record ? (
    <MainPageSectionNav
      ariaLabel="Workflow snapshot sections"
      items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionId as WorkflowSnapshotSectionKey}
      onSelect={(sectionKey) => scrollToSection(sectionKey)}
    />
  ) : null;

  if (loading && !record) {
    return <LoadingSurface message="Loading workflow snapshot..." />;
  }

  if (error && !record) {
    return (
      <ErrorSurface title="Unable to load workflow snapshot" message={error}>
        <div className="mt-4">
          <BackToolbarButton label="Back to Workflow Hub" onClick={onBackToDirectory} />
        </div>
      </ErrorSurface>
    );
  }

  return (
    <>
      <WorkflowRecordPageLayout
        eyebrow="Workflow Hub"
        title={record ? getUsedGearRecordItemTitle(record.fields, record.id) : 'Workflow Snapshot'}
        belowHeader={sectionNav}
        actions={<BackToolbarButton label="Back to Workflow Hub" onClick={onBackToDirectory} />}
      >

        {record ? (
          <div className="space-y-6">
            <section id="overview" className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] scroll-mt-28">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Record Overview</p>
              <h2 className="m-0 mt-2 text-2xl font-semibold text-[var(--ink)]">{getUsedGearRecordItemTitle(record.fields, record.id)}</h2>
            </section>

            <section id="timeline" className="scroll-mt-28">
              <ListingApprovalWorkflowProcessCard summary={workflowSummary} timelineOnly />
            </section>

            <div className="space-y-6">
              <SnapshotCard
                sectionId="intake"
                title="Intake Data"
                actionLabel="Open Intake"
                onAction={() => onOpenIntake(record.id)}
                fields={[
                  {
                    label: 'Grouped Intake',
                    value: context?.group
                      ? `${context.group.label} (${context.group.records.length} row${context.group.records.length === 1 ? '' : 's'})`
                      : 'Single record',
                  },
                  { label: 'Pick Up #', value: record.fields['Pick Up #'] },
                  { label: 'Arrival Date', value: record.fields['Arrival Date'] },
                  { label: 'Acquired From', value: record.fields['Acquired From'] },
                  { label: 'Seller Email', value: record.fields['Seller Email'] },
                  { label: 'Seller Phone', value: record.fields['Seller Phone'] },
                  { label: 'Seller Zip Code', value: record.fields['Seller Zip Code'] },
                  { label: 'Seller Location', value: record.fields['Seller Location'] },
                  { label: 'How Did You Hear', value: record.fields['How Did You Hear'] },
                  { label: 'Mailing List Opt In', value: record.fields['Mailing List Opt In'] },
                  { label: 'Cost', value: record.fields.Cost },
                  { label: 'Make / Model', value: [record.fields.Make, record.fields.Model].filter(Boolean).join(' ') || null },
                  { label: 'Component Type', value: record.fields['Component Type'] },
                  { label: 'Serial Number', value: record.fields['Serial Number'] },
                  { label: 'Voltage', value: record.fields.Voltage },
                  { label: 'Customer Cosmetic Notes', value: record.fields['Customer Cosmetic Notes'] },
                  { label: 'Customer Functional Notes', value: record.fields['Customer Functional Notes'] },
                  { label: 'Customer Inclusion Notes', value: record.fields['Customer Inclusion Notes'] },
                  { label: 'Original Owner', value: record.fields['Original Owner'] },
                  { label: 'Smoke Exposure', value: record.fields['Smoke Exposure'] },
                  { label: 'Original Box', value: record.fields['Original Box'] },
                  { label: 'Manual', value: record.fields.Manual },
                  { label: 'Remote', value: record.fields.Remote },
                  { label: 'Power Cable', value: record.fields['Power Cable'] },
                  { label: 'Additional Items', value: record.fields['Additional Items'] },
                  { label: 'Weight', value: record.fields.Weight },
                  { label: 'Shipping Dims', value: record.fields['Shipping Dims'] },
                  { label: 'Shipping Method', value: record.fields['Shipping Method'] },
                  { label: 'Inventory Notes', value: record.fields['Inventory Notes'] },
                ]}
              >
                <WorkflowReferenceImagesPanel
                  title="Intake Images"
                  description="Images submitted at intake via JotForm, archived to Google Drive."
                  images={stageImages.intakeImages}
                />
              </SnapshotCard>

              <SnapshotCard
                sectionId="testing"
                title="Testing"
                actionLabel={showSpecialistCards ? 'Open Testing' : undefined}
                onAction={showSpecialistCards ? () => onOpenTesting(record.id) : null}
                fields={[
                  { label: 'Testing Notes', value: record.fields['Testing Notes'] },
                  { label: 'Testing Cosmetic Notes', value: record.fields['Testing Cosmetic Notes'] },
                  { label: 'Testing Time', value: record.fields['Testing Time'] },
                  { label: 'Tested', value: record.fields.Tested },
                ]}
              >
                <WorkflowReferenceImagesPanel
                  title="Testing Images"
                  description="Saved testing-stage images appear here for record review and listing handoff context."
                  images={stageImages.testingImages}
                />
              </SnapshotCard>

              <SnapshotCard
                sectionId="photography"
                title="Photography"
                actionLabel={showSpecialistCards ? 'Open Photos' : undefined}
                onAction={showSpecialistCards ? () => onOpenPhotos(record.id) : null}
                fields={[
                  { label: 'Photography Cosmetic Notes', value: record.fields['Photography Cosmetic Notes'] },
                  { label: "Photo'd", value: record.fields["Photo'd"] },
                  { label: 'Images', value: countPhotographyImages(record) },
                  { label: 'Additional Items', value: record.fields['Additional Items'] },
                ]}
              >
                <WorkflowReferenceImagesPanel
                  title="Testing Reference Images"
                  description="These prior-step testing images stay visible here so photography and listing review can compare earlier documentation against final media."
                  images={stageImages.testingImages}
                />
                <WorkflowReferenceImagesPanel
                  title="Photography Images"
                  description="Saved photography-stage images appear here as the current listing-media source for this record."
                  images={stageImages.photographyImages}
                />
              </SnapshotCard>

              <SnapshotCard
                sectionId="listings"
                title="Listings"
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
                  sectionId="post-publish"
                  title="Post-Publish"
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