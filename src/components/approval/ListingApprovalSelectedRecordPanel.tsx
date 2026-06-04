import { Suspense, lazy, useMemo, type ReactNode } from 'react';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ListingApprovalRecordActions } from '@/components/approval/ListingApprovalRecordActions';
import { ListingApprovalRecordAlerts } from '@/components/approval/ListingApprovalRecordAlerts';
import { COMBINED_RECORD_SECTION_ITEMS, type CombinedRecordSectionKey } from '@/components/approval/listingApprovalCombinedSectionNav';
import { ListingApprovalSelectedRecordView } from '@/components/approval/ListingApprovalSelectedRecordView';
import { NotReadyForStageSurface } from '@/components/app/NotReadyForStageSurface';
import { isUsedGearWorkflowListingSurfaceEligible } from '@/services/usedGearWorkflowListingVisibility';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { ListingApprovalWorkflowSummary, type ListingApprovalWorkflowSummaryData } from '@/components/approval/ListingApprovalWorkflowSummary';
import type { buildListingApprovalSelectedRecordStatusProps } from '@/components/approval/listingApprovalSelectedRecordStatusProps';
import type { buildListingApprovalSelectedRecordViewProps } from '@/components/approval/listingApprovalSelectedRecordViewProps';
import { displayValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

const ApprovalFormFields = lazy(async () => ({ default: (await import('@/components/approval/ApprovalFormFields')).ApprovalFormFields }));
const ListingApprovalCombinedSections = lazy(async () => ({ default: (await import('@/components/approval/ListingApprovalCombinedSections')).ListingApprovalCombinedSections }));
const ListingApprovalRecordPayloadPanels = lazy(async () => ({ default: (await import('@/components/approval/ListingApprovalRecordPayloadPanels')).ListingApprovalRecordPayloadPanels }));

function getWorkflowSummaryActionSectionConfig(workflowStatus: string | null): { sectionId: string; label: string } | null {
  switch (workflowStatus) {
    case 'Awaiting Pre-Listing Review':
      return { sectionId: 'listing-record-actions', label: 'Go to Approval Actions' };
    case 'Approved for Publish':
    case 'Listed, Shopify':
    case 'Listed, eBay':
    case 'Stale Listing, Shopify':
    case 'Stale Listing, eBay':
      return { sectionId: 'listing-record-actions', label: 'Go to Publish Actions' };
    case 'Sold - Ready to Ship':
      return { sectionId: 'listing-workflow-details', label: 'Go to Shipping Actions' };
    default:
      return null;
  }
}

function ApprovalEditorFallback() {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
      <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-400">Loading record editor</p>
      <div className="mt-4 space-y-3" aria-hidden="true">
        <div className="h-4 w-36 animate-pulse rounded-md bg-white/10" />
        <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-28 animate-pulse rounded-xl bg-white/5" />
          <div className="h-28 animate-pulse rounded-xl bg-white/5" />
        </div>
      </div>
    </section>
  );
}

export interface ListingApprovalSelectedRecordPanelProps {
  selectedRecord: AirtableRecord;
  titleFieldName: string;
  eyebrowLabel?: string;
  isApproved: boolean;
  saving: boolean;
  error: string | null;
  onBackToList: () => void;
  backToListLabel?: string;
  errorSurfaceClass: string;
  isCombinedApproval: boolean;
  workflowSummary: ListingApprovalWorkflowSummaryData | null;
  workflowDetails: ReactNode | null;
  selectedRecordViewProps: ReturnType<typeof buildListingApprovalSelectedRecordViewProps>;
  selectedRecordStatusProps: ReturnType<typeof buildListingApprovalSelectedRecordStatusProps>;
}

export function ListingApprovalSelectedRecordPanel({
  selectedRecord,
  titleFieldName,
  eyebrowLabel,
  isApproved,
  saving,
  error,
  onBackToList,
  backToListLabel,
  errorSurfaceClass,
  isCombinedApproval,
  workflowSummary,
  workflowDetails,
  selectedRecordViewProps,
  selectedRecordStatusProps,
}: ListingApprovalSelectedRecordPanelProps) {
  const selectedRecordTitle = displayValue(selectedRecord.fields[titleFieldName]) || 'Listing Record';
  const backButton = (
    <BackToolbarButton
      label={backToListLabel ?? 'Back to Listings'}
      onClick={onBackToList}
      disabled={saving}
    />
  );
  const combinedSectionItems = useMemo(() => [...COMBINED_RECORD_SECTION_ITEMS], []);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(combinedSectionItems, COMBINED_RECORD_SECTION_ITEMS[0].id);
  const activeSectionKey = useMemo<CombinedRecordSectionKey>(
    () => combinedSectionItems.find((item) => item.id === activeSectionId)?.key ?? 'intake',
    [activeSectionId, combinedSectionItems],
  );
  const combinedSectionNav = isCombinedApproval ? (
    <MainPageSectionNav
      ariaLabel="Combined listing record sections"
      items={combinedSectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionKey}
      onSelect={(sectionKey) => {
        const sectionId = combinedSectionItems.find((item) => item.key === sectionKey)?.id;
        if (sectionId) {
          scrollToSection(sectionId);
        }
      }}
    />
  ) : null;
  const workflowSummaryAction = useMemo(
    () => getWorkflowSummaryActionSectionConfig(workflowSummary?.workflowStatus ?? null),
    [workflowSummary?.workflowStatus],
  );

  // Enforce listing surface eligibility, but allow post-publish access for follow-through actions.
  const currentStep = getUsedGearWorkflowStatus(selectedRecord.fields) || 'Unknown';
  const isPostPublishAccess = currentStep === 'Sold - Ready to Ship' || currentStep === 'Shipped';
  const isEligible = isPostPublishAccess || isUsedGearWorkflowListingSurfaceEligible(selectedRecord);
  // Helper to get a user-friendly label for the current step
  function getStepLabel(status: string): string {
    switch (status) {
      case 'Pending Review': return 'Intake Review';
      case 'Accepted - Awaiting Arrival': return 'Arrival';
      case 'Accepted - Arrived, Awaiting SKU':
      case 'Accepted - Arrived, Awaiting Missing Item': return 'Intake';
      case 'Testing In Progress': return 'Testing';
      case 'Photography In Progress': return 'Photography';
      case 'Awaiting Pre-Listing Review': return 'Pre-Listing Review';
      case 'Approved for Publish': return 'Approval';
      case 'Listed, Shopify': return 'Shopify Listing';
      case 'Listed, eBay': return 'eBay Listing';
      case 'Stale Listing, Shopify': return 'Shopify Listing (Stale)';
      case 'Stale Listing, eBay': return 'eBay Listing (Stale)';
      case 'Sold - Ready to Ship': return 'Shipping';
      case 'Shipped': return 'Shipped';
      case 'Unqualified': return 'Unqualified';
      default: return status;
    }
  }
  // Handler to go to the current step (fallback to backToList)
  function handleGoToCurrentStep() {
    onBackToList();
  }
  const selectedRecordView = isEligible ? (
    <ListingApprovalSelectedRecordView
      selectedRecord={selectedRecord}
      titleFieldName={titleFieldName}
      eyebrowLabel={eyebrowLabel}
      showRecordHeader={false}
      isApproved={isApproved}
      showApprovalStateBadge={!isCombinedApproval}
      saving={saving}
      error={error}
      onBackToList={onBackToList}
      backToListLabel={backToListLabel}
      errorSurfaceClass={errorSurfaceClass}
      workflowSummary={workflowSummary ? (
        <ListingApprovalWorkflowSummary
          summary={workflowSummary}
          timelineOnly
          activeActionLabel={workflowSummaryAction?.label}
          onActiveAction={workflowSummaryAction
            ? () => {
              const section = document.getElementById(workflowSummaryAction.sectionId);
              section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            : null}
        />
      ) : null}
      workflowDetails={workflowDetails}
      editor={(
        <Suspense fallback={<ApprovalEditorFallback />}>
          {isCombinedApproval ? (
            <ListingApprovalCombinedSections {...selectedRecordViewProps.combinedSectionsProps} />
          ) : (
            <ApprovalFormFields {...selectedRecordViewProps.approvalFormFieldsProps} />
          )}
        </Suspense>
      )}
      alerts={<ListingApprovalRecordAlerts {...selectedRecordStatusProps.alertsProps} />}
      actions={<ListingApprovalRecordActions {...selectedRecordStatusProps.actionsProps} />}
      payloadPanels={isCombinedApproval
        ? null
        : (
          <Suspense fallback={<ApprovalEditorFallback />}>
            <ListingApprovalRecordPayloadPanels {...selectedRecordViewProps.payloadPanelProps} />
          </Suspense>
        )}
    />
  ) : (
    <NotReadyForStageSurface
      stageLabel="Listings"
      nextStepLabel="Workflow Home"
      onGoToNextStep={onBackToList}
    />
  );

  return (
    <WorkflowRecordPageLayout
      eyebrow="Listings"
      title={selectedRecordTitle}
      actions={backButton}
      belowHeader={isEligible ? combinedSectionNav : null}
    >
      {isEligible ? selectedRecordView : (
        <NotReadyForStageSurface
          stageLabel="Listings"
          nextStepLabel={getStepLabel(currentStep)}
          onGoToNextStep={handleGoToCurrentStep}
          currentStepLabel={getStepLabel(currentStep)}
        />
      )}
    </WorkflowRecordPageLayout>
  );
}