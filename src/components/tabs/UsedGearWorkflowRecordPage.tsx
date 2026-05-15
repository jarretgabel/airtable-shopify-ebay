import { useEffect, useState } from 'react';
import {
  buildListingApprovalWorkflowSummaryData,
  ListingApprovalWorkflowProcessCard,
} from '@/components/approval/ListingApprovalWorkflowSummary';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { ToolbarIconButton } from '@/components/app/ToolbarIconButton';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import {
  smallPrimaryActionButtonClass,
  smallSecondaryActionButtonClass,
  smallSuccessActionButtonClass,
} from '@/components/app/buttonStyles';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { useAuthStore } from '@/stores/auth/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  completePreListingReviewStage,
  completePhotographyStage,
  completeProcessingStage,
  completeTestingStage,
  loadUsedGearWorkflowRecordContext,
  markWorkflowListingStale,
  markWorkflowRelisted,
  markWorkflowShipped,
  markWorkflowSoldReadyToShip,
  saveWorkflowStaleRecovery,
  saveWorkflowShipmentFollowThrough,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';
import { USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS, type UsedGearWorkflowStaleRecoveryStatus } from '@/services/usedGearWorkflowLifecycle';
import {
  type UsedGearCompletedStage,
} from '@/services/usedGearWorkflowStageNotifications';
import {
  type UsedGearWorkflowListingReadinessActionTarget,
} from '@/services/usedGearWorkflowListingReadiness';
import { publishUsedGearStageHandoffNotification } from '@/services/usedGearWorkflowHandoffNotifier';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearWorkflowRecordPageProps {
  currentUserName: string;
  recordId: string;
  onBackToDirectory: () => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onOpenInventoryEditor: (recordId: string) => void;
}

function statusSupportsProcessingCompletion(status: string | null): boolean {
  return status === 'Accepted - Awaiting Arrival'
    || status === 'Accepted - Arrived, Awaiting SKU'
    || status === 'Accepted - Arrived, Awaiting Missing Item';
}

function statusSupportsPreListingReview(status: string | null): boolean {
  return status === 'Awaiting Pre-Listing Review';
}

function statusSupportsListingsApproval(status: string | null): boolean {
  return status === 'Approved for Publish';
}

function statusSupportsMarkStale(status: string | null): boolean {
  return status === 'Listed, Shopify' || status === 'Listed, eBay';
}

function statusSupportsSoldReady(status: string | null): boolean {
  return status === 'Listed, Shopify'
    || status === 'Listed, eBay'
    || status === 'Stale Listing, Shopify'
    || status === 'Stale Listing, eBay';
}

function statusSupportsShipped(status: string | null): boolean {
  return status === 'Sold - Ready to Ship';
}

function statusSupportsStaleRecoveryEditing(status: string | null): boolean {
  return status === 'Stale Listing, Shopify' || status === 'Stale Listing, eBay';
}

function statusSupportsShipmentFollowThroughEditing(status: string | null): boolean {
  return status === 'Sold - Ready to Ship' || status === 'Shipped';
}

function normalizeStaleRecoveryStatus(value: unknown): UsedGearWorkflowStaleRecoveryStatus | '' {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS.includes(normalized as UsedGearWorkflowStaleRecoveryStatus)
    ? normalized as UsedGearWorkflowStaleRecoveryStatus
    : '';
}

const WORKFLOW_HEADER_FIELDS = [
  { label: 'Workflow Source', fieldName: 'Workflow Source' },
  { label: 'Trash Status', fieldName: 'Trash Status' },
] as const;

const PRELISTING_CONTEXT_FIELDS = [
  { label: 'Processing Signed By', fieldName: 'Processing Signed By' },
  { label: 'Processing Signed At', fieldName: 'Processing Signed At' },
  { label: 'Testing Signed By', fieldName: 'Testing Signed By' },
  { label: 'Testing Signed At', fieldName: 'Testing Signed At' },
  { label: 'Photography Signed By', fieldName: 'Photography Signed By' },
  { label: 'Photography Signed At', fieldName: 'Photography Signed At' },
  { label: 'Pre-Listing Reviewed By', fieldName: 'Pre-Listing Reviewed By' },
  { label: 'Pre-Listing Reviewed At', fieldName: 'Pre-Listing Reviewed At' },
  { label: 'Inventory Notes', fieldName: 'Inventory Notes' },
  { label: 'Internal Inclusion Notes', fieldName: 'Internal Inclusion Notes' },
  { label: 'Internal Cosmetic Notes', fieldName: 'Internal Cosmetic Notes' },
  { label: 'Internal Functional Notes', fieldName: 'Internal Functional Notes' },
] as const;

const WORKFLOW_AUDIT_FIELDS = [
  { label: 'Workflow Owner', fieldName: 'Workflow Owner' },
  { label: 'Workflow Owner Assigned At', fieldName: 'Workflow Owner Assigned At' },
  { label: 'Accepted By', fieldName: 'Accepted By' },
  { label: 'Accepted At', fieldName: 'Accepted At' },
  { label: 'Qualification Complete', fieldName: 'Qualification Complete' },
  { label: 'Allocation Mode', fieldName: 'Allocation Mode' },
  { label: 'Allocation Notes', fieldName: 'Allocation Notes' },
  { label: 'Offer Amount', fieldName: 'Offer Amount' },
  { label: 'Paid Amount', fieldName: 'Paid Amount' },
  { label: 'Confirmed Grand Total', fieldName: 'Confirmed Grand Total' },
  { label: 'Awaiting Pre-Listing Review At', fieldName: 'Awaiting Pre-Listing Review At' },
  { label: 'Approved For Publish At', fieldName: 'Approved For Publish At' },
  { label: 'Listed At', fieldName: 'Listed At' },
  { label: 'eBay Published At', fieldName: 'eBay Published At' },
  { label: 'eBay Offer ID', fieldName: 'eBay Offer ID' },
  { label: 'eBay Listing ID', fieldName: 'eBay Listing ID' },
  { label: 'Stale Listing At', fieldName: 'Stale Listing At' },
  { label: 'Sold Ready To Ship At', fieldName: 'Sold Ready To Ship At' },
  { label: 'Shipment Follow-Through Updated At', fieldName: 'Shipment Follow-Through Updated At' },
  { label: 'Shipped At', fieldName: 'Shipped At' },
] as const;

const REFERENCE_NOTE_FIELDS = [
  { label: 'Qualification Notes', fieldName: 'Qualification Notes' },
  { label: 'Unqualified Reason', fieldName: 'Unqualified Reason' },
  { label: 'Customer Cosmetic Notes', fieldName: 'Customer Cosmetic Notes' },
  { label: 'Customer Functional Notes', fieldName: 'Customer Functional Notes' },
  { label: 'Customer Inclusion Notes', fieldName: 'Customer Inclusion Notes' },
  { label: 'Customer Submitted Photos Notes', fieldName: 'Customer Submitted Photos Notes' },
  { label: 'Internal Cosmetic Notes', fieldName: 'Internal Cosmetic Notes' },
  { label: 'Internal Functional Notes', fieldName: 'Internal Functional Notes' },
  { label: 'Internal Inclusion Notes', fieldName: 'Internal Inclusion Notes' },
  { label: 'Inventory Notes', fieldName: 'Inventory Notes' },
  { label: 'Shipment Follow-Through Notes', fieldName: 'Shipment Follow-Through Notes' },
] as const;

function runReadinessAction(target: UsedGearWorkflowListingReadinessActionTarget, recordId: string, actions: {
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onOpenInventoryEditor: (recordId: string) => void;
}) {
  if (target === 'incoming-gear') {
    actions.onOpenIncomingGearForm(recordId);
    return;
  }

  if (target === 'testing') {
    actions.onOpenTestingForm(recordId);
    return;
  }

  if (target === 'photos') {
    actions.onOpenPhotosForm(recordId);
    return;
  }

  if (target === 'listings-approval') {
    actions.onOpenListingsRecord(recordId);
    return;
  }

  actions.onOpenInventoryEditor(recordId);
}

function buildWorkflowCardActionConfig(params: {
  recordId: string;
  status: string | null;
  testingSigned: boolean;
  photographySigned: boolean;
  readiness: ReturnType<typeof getUsedGearWorkflowListingReadiness> | null;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onOpenInventoryEditor: (recordId: string) => void;
}) {
  const {
    recordId,
    status,
    testingSigned,
    photographySigned,
    readiness,
    onOpenIncomingGearForm,
    onOpenTestingForm,
    onOpenPhotosForm,
    onOpenListingsRecord,
    onOpenInventoryEditor,
  } = params;

  if (!status) {
    return {
      primaryActionLabel: undefined,
      onPrimaryAction: null,
      secondaryActionLabel: undefined,
      onSecondaryAction: null,
    };
  }

  if (status === 'Accepted - Awaiting Arrival' || status === 'Accepted - Arrived, Awaiting SKU' || status === 'Accepted - Arrived, Awaiting Missing Item') {
    return {
      primaryActionLabel: 'Open Incoming Gear',
      onPrimaryAction: () => onOpenIncomingGearForm(recordId),
      secondaryActionLabel: 'Open Full Editor',
      onSecondaryAction: () => onOpenInventoryEditor(recordId),
    };
  }

  if (status === 'Testing and Photography In Progress') {
    if (!testingSigned && !photographySigned) {
      return {
        primaryActionLabel: 'Open Testing',
        onPrimaryAction: () => onOpenTestingForm(recordId),
        secondaryActionLabel: 'Open Photos',
        onSecondaryAction: () => onOpenPhotosForm(recordId),
      };
    }

    if (!testingSigned) {
      return {
        primaryActionLabel: 'Open Testing',
        onPrimaryAction: () => onOpenTestingForm(recordId),
        secondaryActionLabel: undefined,
        onSecondaryAction: null,
      };
    }

    if (!photographySigned) {
      return {
        primaryActionLabel: 'Open Photos',
        onPrimaryAction: () => onOpenPhotosForm(recordId),
        secondaryActionLabel: undefined,
        onSecondaryAction: null,
      };
    }
  }

  if (status === 'Awaiting Pre-Listing Review' || status === 'Approved for Publish' || status === 'Listed, Shopify' || status === 'Listed, eBay' || status === 'Stale Listing, Shopify' || status === 'Stale Listing, eBay') {
    return {
      primaryActionLabel: 'Open Listings Approval',
      onPrimaryAction: () => onOpenListingsRecord(recordId),
      secondaryActionLabel: readiness?.blockers[0]?.actionLabel,
      onSecondaryAction: readiness?.blockers[0]
        ? () => runReadinessAction(readiness.blockers[0].actionTarget, recordId, {
          onOpenIncomingGearForm,
          onOpenTestingForm,
          onOpenPhotosForm,
          onOpenListingsRecord,
          onOpenInventoryEditor,
        })
        : null,
    };
  }

  return {
    primaryActionLabel: readiness?.blockers[0]?.actionLabel,
    onPrimaryAction: readiness?.blockers[0]
      ? () => runReadinessAction(readiness.blockers[0].actionTarget, recordId, {
        onOpenIncomingGearForm,
        onOpenTestingForm,
        onOpenPhotosForm,
        onOpenListingsRecord,
        onOpenInventoryEditor,
      })
      : null,
    secondaryActionLabel: undefined,
    onSecondaryAction: null,
  };
}

function StaleRecoveryTemplateRow({ onApplyTemplate }: { onApplyTemplate: (templateValue: string) => void }) {
  const templates = getUsedGearWorkflowNoteTemplates('stale-recovery');

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="self-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]/80">Recovery templates</span>
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          onClick={() => onApplyTemplate(template.value)}
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}

function ShipmentFollowThroughTemplateRow({ onApplyTemplate }: { onApplyTemplate: (templateValue: string) => void }) {
  const templates = getUsedGearWorkflowNoteTemplates('shipment-follow-through');

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="self-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]/80">Shipment templates</span>
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          onClick={() => onApplyTemplate(template.value)}
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}

export function UsedGearWorkflowRecordPage({
  currentUserName,
  recordId,
  onBackToDirectory,
  onOpenWorkflowRecord,
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenListingsRecord,
  onOpenInventoryEditor,
}: UsedGearWorkflowRecordPageProps) {
  const currentUser = useAuthStore((state) => state.users.find((user) => user.id === state.currentUserId) ?? null);
  const upsertByKey = useNotificationStore((state) => state.upsertByKey);
  const [record, setRecord] = useState<AirtableRecord | null>(null);
  const [relatedGroupRecords, setRelatedGroupRecords] = useState<AirtableRecord[]>([]);
  const [relatedGroupLabel, setRelatedGroupLabel] = useState<string | null>(null);
  const [relatedGroupDescription, setRelatedGroupDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRecordActions, setShowRecordActions] = useState(false);
  const [pricingConfirmed, setPricingConfirmed] = useState(false);
  const [contentConfirmed, setContentConfirmed] = useState(false);
  const [staleRecoveryDraftStatus, setStaleRecoveryDraftStatus] = useState<UsedGearWorkflowStaleRecoveryStatus | ''>('');
  const [staleRecoveryDraftNotes, setStaleRecoveryDraftNotes] = useState('');
  const [shipmentFollowThroughDraftNotes, setShipmentFollowThroughDraftNotes] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRecord = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContext = await loadUsedGearWorkflowRecordContext(recordId);
        if (!cancelled) {
          setRecord(nextContext.record);
          setRelatedGroupRecords(nextContext.group?.records.filter((candidate) => candidate.id !== recordId) ?? []);
          setRelatedGroupLabel(nextContext.group?.label ?? null);
          setRelatedGroupDescription(nextContext.group?.description ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected workflow record.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRecord();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const status = record ? getUsedGearWorkflowStatus(record.fields) : null;
  const testingSigned = typeof record?.fields['Testing Signed By'] === 'string' && record.fields['Testing Signed By'].trim().length > 0;
  const photographySigned = typeof record?.fields['Photography Signed By'] === 'string' && record.fields['Photography Signed By'].trim().length > 0;
  const readiness = record ? getUsedGearWorkflowListingReadiness(record) : null;
  const workflowSummary = record ? buildListingApprovalWorkflowSummaryData(record) : null;
  const canApproveForPublish = Boolean(
    statusSupportsPreListingReview(status)
      && readiness
      && readiness.missingRequirements.length === 0
      && pricingConfirmed
      && contentConfirmed,
  );
  const relatedGroupSummary = relatedGroupRecords.length > 0 ? {
    pricedCount: relatedGroupRecords.filter((candidate) => {
      const value = candidate.fields.Price;
      return typeof value === 'string' ? value.trim().length > 0 : typeof value === 'number';
    }).length,
    offerCount: relatedGroupRecords.filter((candidate) => {
      const value = candidate.fields['Offer Amount'];
      return typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0);
    }).length,
  } : null;
  const staleRecoveryStatus = typeof record?.fields['Stale Recovery Status'] === 'string' ? record.fields['Stale Recovery Status'] : '';
  const staleRecoveryNotes = typeof record?.fields['Stale Recovery Notes'] === 'string' ? record.fields['Stale Recovery Notes'] : '';
  const staleRecoveryUpdatedAt = typeof record?.fields['Stale Recovery Updated At'] === 'string' ? record.fields['Stale Recovery Updated At'] : '';
  const relistedAt = typeof record?.fields['Relisted At'] === 'string' ? record.fields['Relisted At'] : '';
  const shipmentFollowThroughNotes = typeof record?.fields['Shipment Follow-Through Notes'] === 'string' ? record.fields['Shipment Follow-Through Notes'] : '';
  const shipmentFollowThroughUpdatedAt = typeof record?.fields['Shipment Follow-Through Updated At'] === 'string' ? record.fields['Shipment Follow-Through Updated At'] : '';
  const workflowCardActionConfig = buildWorkflowCardActionConfig({
    recordId,
    status,
    testingSigned,
    photographySigned,
    readiness,
    onOpenIncomingGearForm,
    onOpenTestingForm,
    onOpenPhotosForm,
    onOpenListingsRecord,
    onOpenInventoryEditor,
  });
  const showStaleRecoveryPanel = status === 'Stale Listing, Shopify'
    || status === 'Stale Listing, eBay'
    || staleRecoveryStatus.length > 0
    || staleRecoveryNotes.length > 0
    || staleRecoveryUpdatedAt.length > 0
    || relistedAt.length > 0;
  const showShipmentFollowThroughPanel = statusSupportsShipmentFollowThroughEditing(status)
    || shipmentFollowThroughNotes.length > 0
    || shipmentFollowThroughUpdatedAt.length > 0;
  const primaryActionLabel = statusSupportsProcessingCompletion(status)
    ? 'Complete Processing'
    : status === 'Testing and Photography In Progress'
      ? (!testingSigned ? 'Mark Testing Complete' : !photographySigned ? 'Mark Photography Complete' : null)
      : statusSupportsListingsApproval(status)
        ? 'Open Listings Approval'
        : workflowCardActionConfig.primaryActionLabel ?? null;

  const runPrimaryAction = () => {
    if (statusSupportsProcessingCompletion(status)) {
      void runAction(() => completeProcessingStage(recordId, currentUserName), 'processing');
      return;
    }

    if (status === 'Testing and Photography In Progress') {
      if (!testingSigned) {
        void runAction(() => completeTestingStage(recordId, currentUserName), 'testing');
        return;
      }

      if (!photographySigned) {
        void runAction(() => completePhotographyStage(recordId, currentUserName), 'photography');
        return;
      }
    }

    if (statusSupportsListingsApproval(status)) {
      onOpenListingsRecord(recordId);
      return;
    }

    workflowCardActionConfig.onPrimaryAction?.();
  };

  const primaryActionDisabled = saving
    || (status === 'Testing and Photography In Progress' && testingSigned && photographySigned)
    || !primaryActionLabel;

  useEffect(() => {
    setPricingConfirmed(false);
    setContentConfirmed(false);
  }, [recordId, status]);

  useEffect(() => {
    setStaleRecoveryDraftStatus(normalizeStaleRecoveryStatus(staleRecoveryStatus));
    setStaleRecoveryDraftNotes(staleRecoveryNotes);
  }, [recordId, staleRecoveryStatus, staleRecoveryNotes]);

  useEffect(() => {
    setShipmentFollowThroughDraftNotes(shipmentFollowThroughNotes);
  }, [recordId, shipmentFollowThroughNotes]);

  const runAction = async (
    action: () => Promise<AirtableRecord>,
    completedStage?: UsedGearCompletedStage,
  ) => {
    setSaving(true);
    setError(null);

    try {
      const updatedRecord = await action();
      setRecord(updatedRecord);

      if (completedStage) {
        publishUsedGearStageHandoffNotification({
          completedStage,
          currentUser,
          record: updatedRecord,
          onOpenWorkflowRecord,
          upsertByKey,
        });
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the workflow record.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !record) {
    return <LoadingSurface message="Loading used-gear workflow detail..." />;
  }

  if (error && !record) {
    return (
      <ErrorSurface title="Unable to load workflow record" message={error}>
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
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="Used Gear Workflow"
          title="Workflow Detail"
          description="Track routing, grouped intake context, and operational handoff actions for this row."
          actions={(
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onBackToDirectory}
            >
              Back to Directory
            </button>
          )}
        />

        {error ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Record</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields.SKU)}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{displayInventoryValue(record?.fields.Make)} · {displayInventoryValue(record?.fields.Model)}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Status</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Workflow Status'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Next Team</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Workflow Next Team'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Submission Group</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Submission Group ID'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Pick Up</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Pick Up ID'])}</div>
              </div>
              {WORKFLOW_HEADER_FIELDS.map((field) => (
                <div key={field.fieldName} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div>{field.label}</div>
                  <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields[field.fieldName])}</div>
                </div>
              ))}
            </div>

            <details className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 px-4 py-3 text-sm text-[var(--muted)]">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                More Record Details
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>Submission Group: {displayInventoryValue(record?.fields['Submission Group ID'])}</div>
                <div>Pick Up: {displayInventoryValue(record?.fields['Pick Up ID'])}</div>
                {WORKFLOW_HEADER_FIELDS.map((field) => (
                  <div key={`detail-${field.fieldName}`}>{field.label}: {displayInventoryValue(record?.fields[field.fieldName])}</div>
                ))}
              </div>
            </details>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Next Step</p>
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 px-4 py-4 text-sm text-[var(--muted)]">
              <p className="m-0">Focus on the current workflow handoff first. Navigation and secondary tools stay available when you need them.</p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {primaryActionLabel ? (
                <button
                  type="button"
                  className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={runPrimaryAction}
                  disabled={primaryActionDisabled}
                >
                  {saving ? 'Saving...' : primaryActionLabel}
                </button>
              ) : null}
              {workflowCardActionConfig.secondaryActionLabel && workflowCardActionConfig.onSecondaryAction ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={workflowCardActionConfig.onSecondaryAction}
                >
                  {workflowCardActionConfig.secondaryActionLabel}
                </button>
              ) : null}

                <div className="flex justify-end">
                  <ToolbarIconButton
                    label={showRecordActions ? 'Hide More Actions' : 'Show More Actions'}
                    aria-expanded={showRecordActions}
                    className={showRecordActions ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)]' : undefined}
                    icon={(
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                        <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                        <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                      </svg>
                    )}
                    onClick={() => setShowRecordActions((current) => !current)}
                  />
                </div>

              {showRecordActions ? (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 p-3">
                    <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                        className={smallSecondaryActionButtonClass}
                      onClick={() => onOpenIncomingGearForm(recordId)}
                    >
                      Open Incoming Gear
                    </button>
                    <button
                      type="button"
                        className={smallSecondaryActionButtonClass}
                      onClick={() => onOpenTestingForm(recordId)}
                    >
                      Open Testing
                    </button>
                    <button
                      type="button"
                        className={smallSecondaryActionButtonClass}
                      onClick={() => onOpenPhotosForm(recordId)}
                    >
                      Open Photos
                    </button>
                    <button
                      type="button"
                        className={smallSecondaryActionButtonClass}
                      onClick={() => onOpenInventoryEditor(recordId)}
                    >
                      Open Full Editor
                    </button>
                    {statusSupportsListingsApproval(status) ? (
                      <button
                        type="button"
                          className={smallSecondaryActionButtonClass}
                        onClick={() => onOpenListingsRecord(recordId)}
                      >
                        Open Listings Approval
                      </button>
                    ) : null}
                    {status === 'Testing and Photography In Progress' && !testingSigned ? (
                      <button
                        type="button"
                          className={smallPrimaryActionButtonClass}
                        onClick={() => {
                          void runAction(() => completeTestingStage(recordId, currentUserName), 'testing');
                        }}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Mark Testing Complete'}
                      </button>
                    ) : null}
                    {status === 'Testing and Photography In Progress' && !photographySigned ? (
                      <button
                        type="button"
                        className={smallPrimaryActionButtonClass}
                        onClick={() => {
                          void runAction(() => completePhotographyStage(recordId, currentUserName), 'photography');
                        }}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Mark Photography Complete'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Pre-Listing Readiness</p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">Reviewer And Pricing Gate</h3>
              <div className="mt-3 max-w-2xl">
                <CollapsibleHelperText label="Review guide">
                  Review the listing-critical fields gathered through intake, testing, photography, and prefill before promoting this row to publish-ready status.
                </CollapsibleHelperText>
              </div>
            </div>
            <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              {statusSupportsPreListingReview(status) ? 'Awaiting reviewer confirmation' : displayInventoryValue(record?.fields['Workflow Status'])}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
              <div>Listing Title</div>
              <div className="mt-1 text-base font-semibold text-[var(--ink)]">{readiness?.title || 'Not ready'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.08em]">{readiness?.titleFieldName || 'Derived from workflow data'}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
              <div>Listing Price</div>
              <div className="mt-1 text-base font-semibold text-[var(--ink)]">{readiness?.price || 'Missing price'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.08em]">{readiness?.priceFieldName || 'No price field found'}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
              <div>Listing Description</div>
              <div className="mt-1 text-sm leading-6 text-[var(--ink)]">{readiness?.description || 'No listing description yet.'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.08em]">{readiness?.descriptionFieldName || 'Derived from inventory notes'}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <details className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
              <summary className="cursor-pointer text-base font-semibold text-[var(--ink)]">Stage Context</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {PRELISTING_CONTEXT_FIELDS.map((field) => (
                  <div key={field.fieldName}>{field.label}: {displayInventoryValue(record?.fields[field.fieldName])}</div>
                ))}
              </div>
            </details>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
              <h4 className="m-0 text-base font-semibold text-[var(--ink)]">Reviewer Checklist</h4>

              {readiness && readiness.missingRequirements.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-3 text-amber-200">
                  <p className="m-0">{readiness.missingRequirements[0]}</p>
                  {readiness.blockers[0] ? (
                    <button
                      type="button"
                      className="mt-3 rounded-xl border border-amber-300/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-100 transition hover:border-amber-200 hover:text-white"
                      onClick={() => runReadinessAction(readiness.blockers[0].actionTarget, recordId, {
                        onOpenIncomingGearForm,
                        onOpenTestingForm,
                        onOpenPhotosForm,
                        onOpenListingsRecord,
                        onOpenInventoryEditor,
                      })}
                    >
                      {readiness.blockers[0].actionLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={pricingConfirmed}
                  onChange={(event) => setPricingConfirmed(event.currentTarget.checked)}
                  disabled={!statusSupportsPreListingReview(status) || saving}
                />
                <span>
                  <span className="block font-semibold text-[var(--ink)]">Pricing confirmed</span>
                  <span className="block text-xs leading-5">I verified the current listing price and it is ready to hand off to listing approval.</span>
                </span>
              </label>

              <label className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={contentConfirmed}
                  onChange={(event) => setContentConfirmed(event.currentTarget.checked)}
                  disabled={!statusSupportsPreListingReview(status) || saving}
                />
                <span>
                  <span className="block font-semibold text-[var(--ink)]">Content reviewed</span>
                  <span className="block text-xs leading-5">I reviewed the derived title, description, notes, and stage signoffs before approving this row for publish.</span>
                </span>
              </label>

              {statusSupportsPreListingReview(status) ? (
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void runAction(() => completePreListingReviewStage(recordId, currentUserName));
                  }}
                  disabled={!canApproveForPublish || saving}
                >
                  {saving ? 'Saving...' : 'Approve For Publish'}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {(statusSupportsMarkStale(status) || statusSupportsSoldReady(status) || statusSupportsShipped(status) || showStaleRecoveryPanel || showShipmentFollowThroughPanel) ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 lg:col-span-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Post-Publish Operations</p>
                  <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Post-Publish Lifecycle</h3>
                  <div className="mt-3 max-w-3xl">
                    <CollapsibleHelperText label="Lifecycle guide">
                      Use this record page for stale recovery, relist reconciliation, sold-ready handoff, and shipped completion. The queue now stays focused on triage while the detailed lifecycle work happens here.
                    </CollapsibleHelperText>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusSupportsListingsApproval(status) || statusSupportsMarkStale(status) || statusSupportsSoldReady(status) ? (
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      onClick={() => onOpenListingsRecord(recordId)}
                    >
                      Open Listings Approval
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div>Lifecycle Status</div>
                  <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Workflow Status'])}</div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div>Listed At</div>
                  <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Listed At'])}</div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div>Sold Ready</div>
                  <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Sold Ready To Ship At'])}</div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div>Shipped</div>
                  <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Shipped At'])}</div>
                </div>
              </div>

              {statusSupportsStaleRecoveryEditing(status) ? (
                <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Stale Recovery Review</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Document the recovery plan first, then mark the row relisted once the updated listing is live again.</p>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
                    <label>
                      <span className="sr-only">Stale recovery status</span>
                      <select
                        className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                        value={staleRecoveryDraftStatus}
                        onChange={(event) => setStaleRecoveryDraftStatus(normalizeStaleRecoveryStatus(event.currentTarget.value))}
                        disabled={saving}
                      >
                        <option value="">Recovery Status</option>
                        {USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="sr-only">Stale recovery notes</span>
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                        value={staleRecoveryDraftNotes}
                        onChange={(event) => setStaleRecoveryDraftNotes(event.currentTarget.value)}
                        placeholder="Add relist, pricing, or content-refresh notes"
                        disabled={saving}
                      />
                    </label>
                  </div>
                  <StaleRecoveryTemplateRow
                    onApplyTemplate={(templateValue) => {
                      setStaleRecoveryDraftNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                    }}
                  />
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)]/70 pt-4">
                    <button
                      type="button"
                      className={smallSecondaryActionButtonClass}
                      onClick={() => {
                        void runAction(() => saveWorkflowStaleRecovery(recordId, {
                          staleRecoveryStatus: staleRecoveryDraftStatus || null,
                          staleRecoveryNotes: staleRecoveryDraftNotes || null,
                        }));
                      }}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Recovery'}
                    </button>
                    <button
                      type="button"
                      className={smallPrimaryActionButtonClass}
                      onClick={() => {
                        void runAction(() => markWorkflowRelisted(recordId));
                      }}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Mark Relisted'}
                    </button>
                  </div>
                </div>
              ) : null}

              {showShipmentFollowThroughPanel ? (
                <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Shipment Follow-Through</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Capture packing, carrier, or shipment-confirmation notes on the workflow row so sold-ready and shipped follow-through stays visible to the next operator.</p>
                  </div>
                  <label className="mt-4 block">
                    <span className="sr-only">Shipment follow-through notes</span>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      value={shipmentFollowThroughDraftNotes}
                      onChange={(event) => setShipmentFollowThroughDraftNotes(event.currentTarget.value)}
                      placeholder="Add packing, carrier, or shipment confirmation notes"
                      disabled={saving || !statusSupportsShipmentFollowThroughEditing(status)}
                    />
                  </label>
                  {statusSupportsShipmentFollowThroughEditing(status) ? (
                    <ShipmentFollowThroughTemplateRow
                      onApplyTemplate={(templateValue) => {
                        setShipmentFollowThroughDraftNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                      }}
                    />
                  ) : null}
                  {shipmentFollowThroughUpdatedAt ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Last updated {shipmentFollowThroughUpdatedAt}
                    </p>
                  ) : null}
                  {statusSupportsShipmentFollowThroughEditing(status) ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)]/70 pt-4">
                      <button
                        type="button"
                        className={smallSecondaryActionButtonClass}
                        onClick={() => {
                          void runAction(() => saveWorkflowShipmentFollowThrough(recordId, {
                            shipmentFollowThroughNotes: shipmentFollowThroughDraftNotes || null,
                          }));
                        }}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save Shipment Notes'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)]/70 pt-4">
                {statusSupportsMarkStale(status) ? (
                  <button
                    type="button"
                    className={smallPrimaryActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowListingStale(recordId));
                    }}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Mark Stale'}
                  </button>
                ) : null}
                {statusSupportsSoldReady(status) ? (
                  <button
                    type="button"
                    className={smallSuccessActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowSoldReadyToShip(recordId));
                    }}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Mark Sold Ready'}
                  </button>
                ) : null}
                {statusSupportsShipped(status) ? (
                  <button
                    type="button"
                    className={smallPrimaryActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowShipped(recordId));
                    }}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Mark Shipped'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showStaleRecoveryPanel ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 lg:col-span-2">
              <details>
                <summary className="cursor-pointer text-xl font-semibold text-[var(--ink)]">Stale Recovery</summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div>Recovery Status</div>
                    <div className="mt-1 text-base font-semibold text-[var(--ink)]">{staleRecoveryStatus || 'Not set'}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div>Recovery Updated</div>
                    <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(staleRecoveryUpdatedAt)}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div>Relisted At</div>
                    <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(relistedAt)}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div>Current Lifecycle</div>
                    <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Workflow Status'])}</div>
                  </div>
                </div>
                {staleRecoveryNotes ? (
                  <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm leading-6 text-[var(--ink)]">
                    {staleRecoveryNotes}
                  </div>
                ) : null}
              </details>
            </div>
          ) : null}

          {showShipmentFollowThroughPanel ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 lg:col-span-2">
              <details>
                <summary className="cursor-pointer text-xl font-semibold text-[var(--ink)]">Shipment Follow-Through Audit</summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div>Current Lifecycle</div>
                    <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Workflow Status'])}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div>Sold Ready At</div>
                    <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Sold Ready To Ship At'])}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div>Shipment Notes Updated</div>
                    <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(shipmentFollowThroughUpdatedAt)}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div>Shipped At</div>
                    <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Shipped At'])}</div>
                  </div>
                </div>
                {shipmentFollowThroughNotes ? (
                  <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm leading-6 text-[var(--ink)]">
                    {shipmentFollowThroughNotes}
                  </div>
                ) : null}
              </details>
            </div>
          ) : null}

          {relatedGroupRecords.length > 0 ? (
            <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 lg:col-span-2 text-sm text-[var(--muted)]">
              <summary className="cursor-pointer text-xl font-semibold text-[var(--ink)]">Grouped Submission Context</summary>
              <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="mt-0 mb-0">This row shares a {relatedGroupDescription?.toLowerCase() ?? 'workflow group'} with {relatedGroupRecords.length} other row{relatedGroupRecords.length === 1 ? '' : 's'} under {relatedGroupLabel}.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Sibling rows: {relatedGroupRecords.length}
                  </div>
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Siblings with offers: {relatedGroupSummary?.offerCount ?? 0}
                  </div>
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Siblings with price: {relatedGroupSummary?.pricedCount ?? 0}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {relatedGroupRecords.map((candidate) => (
                  <div key={candidate.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[var(--ink)]">{displayInventoryValue(candidate.fields.SKU)}</div>
                        <div className="mt-1">{displayInventoryValue(candidate.fields.Make)} · {displayInventoryValue(candidate.fields.Model)}</div>
                      </div>
                      <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {displayInventoryValue(candidate.fields['Workflow Status'])}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-1 sm:grid-cols-2">
                      <div>Offer Amount: {displayInventoryValue(candidate.fields['Offer Amount'])}</div>
                      <div>Paid Amount: {displayInventoryValue(candidate.fields['Paid Amount'])}</div>
                      <div>Group Total: {displayInventoryValue(candidate.fields['Confirmed Grand Total'])}</div>
                      <div>Accepted By: {displayInventoryValue(candidate.fields['Accepted By'])}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onOpenWorkflowRecord(candidate.id)}
                      >
                        Open Sibling Workflow
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          <ListingApprovalWorkflowProcessCard
            summary={workflowSummary}
            eyebrow="Workflow Progress"
            title="End-to-End Workflow Progress"
            description="Canonical intake, processing, listing, and fulfillment status for this used-gear workflow row."
            emptyMessage="This workflow row does not currently resolve to a status summary."
            primaryActionLabel={workflowCardActionConfig.primaryActionLabel}
            onPrimaryAction={workflowCardActionConfig.onPrimaryAction}
            secondaryActionLabel={workflowCardActionConfig.secondaryActionLabel}
            onSecondaryAction={workflowCardActionConfig.onSecondaryAction}
          />

          <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 text-sm text-[var(--muted)]">
            <summary className="cursor-pointer text-xl font-semibold text-[var(--ink)]">Workflow Audit</summary>
            <div className="mt-4 space-y-2">
              {WORKFLOW_AUDIT_FIELDS.map((field) => (
                <div key={field.fieldName}>{field.label}: {displayInventoryValue(record?.fields[field.fieldName])}</div>
              ))}
            </div>
          </details>

          <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 text-sm text-[var(--muted)]">
            <summary className="cursor-pointer text-xl font-semibold text-[var(--ink)]">Reference Notes</summary>
            <div className="mt-4 space-y-2">
              {REFERENCE_NOTE_FIELDS.map((field) => (
                <div key={field.fieldName}>{field.label}: {displayInventoryValue(record?.fields[field.fieldName])}</div>
              ))}
            </div>
          </details>
        </section>
      </div>
    </PanelSurface>
  );
}