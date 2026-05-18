import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { UsedGearTrashRouteCard } from '@/components/tabs/UsedGearTrashRouteCard';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';
import { buildUsedGearIntakeSnapshot } from '@/components/tabs/usedGearIntakeSnapshot';
import {
  acceptPendingReviewRecord,
  hasUsedGearPendingReviewPricingPath,
  loadUsedGearOperationalRecordContext,
  markPendingReviewUnqualified,
  type UsedGearPendingReviewAcceptedStatus,
  type UsedGearOperationalRecordContext,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';

interface UsedGearPendingReviewRecordPageProps {
  currentUserName: string;
  recordId: string;
  onOpenManualIntake: (recordId: string) => void;
}

type PendingReviewSectionKey = 'group' | 'lot-two' | 'trash' | 'snapshot';

const ACCEPT_ROUTE_OPTIONS: Array<{
  value: UsedGearPendingReviewAcceptedStatus;
  label: string;
  description: string;
}> = [
  {
    value: 'Accepted - Awaiting Arrival',
    label: 'Awaiting Arrival',
    description: 'Use when the offer is accepted and the item has not arrived yet.',
  },
  {
    value: 'Accepted - Arrived, Awaiting SKU',
    label: 'Arrived, Awaiting SKU',
    description: 'Use when the item is on-site and still needs SKU assignment.',
  },
  {
    value: 'Accepted - Arrived, Awaiting Missing Item',
    label: 'Arrived, Awaiting Missing Item',
    description: 'Use when the intake is accepted but still needs a missing unit or accessory.',
  },
];

function stringFieldValue(fields: Record<string, unknown>, fieldName: string): string {
  const value = fields[fieldName];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function NoteTemplateRow({
  legend,
  templateGroup,
  onApplyTemplate,
}: {
  legend: string;
  templateGroup: 'qualification' | 'unqualified-reason';
  onApplyTemplate: (templateValue: string) => void;
}) {
  const templates = getUsedGearWorkflowNoteTemplates(templateGroup);

  return (
    <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_72%,transparent)] p-3">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]/85">{legend}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
            onClick={() => onApplyTemplate(template.value)}
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UsedGearPendingReviewRecordPage({
  currentUserName,
  recordId,
  onOpenManualIntake,
}: UsedGearPendingReviewRecordPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState<UsedGearOperationalRecordContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptStatus, setAcceptStatus] = useState<UsedGearPendingReviewAcceptedStatus>('Accepted - Awaiting Arrival');
  const [qualificationNotes, setQualificationNotes] = useState('');
  const [unqualifiedReason, setUnqualifiedReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRecord = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContext = await loadUsedGearOperationalRecordContext(recordId);
        if (!cancelled) {
          setContext(nextContext);
          setAcceptStatus(
            nextContext.record.fields['Workflow Status'] === 'Accepted - Arrived, Awaiting SKU'
              || nextContext.record.fields['Workflow Status'] === 'Accepted - Arrived, Awaiting Missing Item'
              ? nextContext.record.fields['Workflow Status'] as UsedGearPendingReviewAcceptedStatus
              : 'Accepted - Awaiting Arrival',
          );
          setQualificationNotes(stringFieldValue(nextContext.record.fields, 'Qualification Notes'));
          setUnqualifiedReason(stringFieldValue(nextContext.record.fields, 'Unqualified Reason'));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected parking-lot review row.');
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

  const record = context?.record ?? null;
  const group = context?.group ?? null;
  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const hasPricingPath = useMemo(() => record ? hasUsedGearPendingReviewPricingPath(record.fields) : false, [record]);
  const groupNeedsSubmissionId = useMemo(
    () => Boolean(group && group.records.length > 1 && stringFieldValue(record?.fields ?? {}, 'Submission Group ID').trim().length === 0),
    [group, record],
  );
  const sectionItems = useMemo<Array<{ id: PendingReviewSectionKey; key: PendingReviewSectionKey; label: string }>>(() => {
    const items: Array<{ id: PendingReviewSectionKey; key: PendingReviewSectionKey; label: string }> = [];
    if (group) {
      items.push({ id: 'group', key: 'group', label: 'Grouped Intake' });
    }
    items.push({ id: 'lot-two', key: 'lot-two', label: 'Qualify' });
    items.push({ id: 'trash', key: 'trash', label: 'Trash' });
    items.push({ id: 'snapshot', key: 'snapshot', label: 'Snapshot' });
    return items;
  }, [group]);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, sectionItems[0]?.id ?? 'lot-two');
  const sectionNav = (
    <MainPageSectionNav
      ariaLabel="Parking Lot 1 sections"
      items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionId as PendingReviewSectionKey}
      onSelect={(sectionKey) => scrollToSection(sectionKey)}
    />
  );

  const backToQueue = () => {
    navigate({ pathname: '/parking-lot-1', search: location.search, hash: '#used-gear-pending-review' });
  };

  const handleAccept = async () => {
    if (!record) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await acceptPendingReviewRecord(record.id, currentUserName, {
        acceptedStatus: acceptStatus,
        qualificationNotes,
      });
      backToQueue();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to accept this parking-lot row into Lot 2.');
      setSaving(false);
    }
  };

  const handleUnqualify = async () => {
    if (!record) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await markPendingReviewUnqualified(record.id, unqualifiedReason);
      navigate({ pathname: '/trash-review', search: location.search, hash: '#used-gear-trash' });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to move this parking-lot row into trash.');
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading parking-lot review..." />;
  }

  if (!record) {
    return <ErrorSurface title="Unable to load parking-lot review" message={error ?? 'The selected Parking Lot 1 record could not be loaded.'} />;
  }

  const acceptRouteDescription = ACCEPT_ROUTE_OPTIONS.find((option) => option.value === acceptStatus)?.description;
  const intakeSnapshot = buildUsedGearIntakeSnapshot(record);

  return (
    <WorkflowRecordPageLayout
      eyebrow="Parking Lot 1"
      title={displayInventoryValue(record.fields.SKU)}
      belowHeader={sectionNav}
      actions={<BackToolbarButton label="Back to Parking Lot 1" onClick={backToQueue} />}
    >
      <div className="space-y-6">

        {error ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        ) : null}

        {group ? (
          <section id="group" className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-4 text-sm text-sky-100 scroll-mt-28">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <AppSectionTitle title="Grouped Intake" className="border-b-sky-300/25 pt-0" titleClassName="text-lg text-sky-50" />
                <p className="mt-3 max-w-2xl leading-6">
                  This row belongs to {group.label} with {group.records.length} intake rows. Use the group page when pricing, allocation, or routing should be managed together.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-sky-300/40 bg-white/5 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/10"
                onClick={() => navigate(`/parking-lot-1/group/${encodeURIComponent(group.id)}${location.search}`)}
              >
                Open Group Review
              </button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6">
          <section id="lot-two" className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 scroll-mt-28">
            <AppSectionTitle title="Qualify Into Lot 2" titleClassName="text-lg" className="pt-0" />
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Choose the correct Lot 2 destination and leave the qualification note that explains why this intake should stay in the sellable workflow.</p>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Lot 2 Route</span>
                <select
                  className={inputClassName}
                  value={acceptStatus}
                  onChange={(event) => setAcceptStatus(event.currentTarget.value as UsedGearPendingReviewAcceptedStatus)}
                >
                  {ACCEPT_ROUTE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {acceptRouteDescription ? <p className="mt-1 text-xs text-[var(--muted)]/80">{acceptRouteDescription}</p> : null}
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Qualification Notes</span>
                <textarea
                  className={inputClassName}
                  rows={5}
                  value={qualificationNotes}
                  onChange={(event) => setQualificationNotes(event.currentTarget.value)}
                  placeholder="Required before routing this item into Lot 2"
                />
              </label>
              <NoteTemplateRow
                legend="Quick templates"
                templateGroup="qualification"
                onApplyTemplate={(templateValue) => {
                  setQualificationNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                }}
              />
              {groupNeedsSubmissionId ? (
                <p className="m-0 text-sm text-amber-300">This grouped intake still needs a Submission Group ID before it can be accepted into Lot 2.</p>
              ) : null}
              {!hasPricingPath ? (
                <p className="m-0 text-sm text-amber-300">Offer amount, paid amount, or confirmed grand total is required before this row can enter Lot 2.</p>
              ) : null}
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleAccept();
                }}
                disabled={saving || qualificationNotes.trim().length === 0 || !hasPricingPath || groupNeedsSubmissionId}
              >
                {saving ? 'Saving...' : 'Accept Into Lot 2'}
              </button>
            </div>
          </section>
        </div>

        <UsedGearTrashRouteCard
          sectionId="trash"
          description="Capture the reason clearly so downstream review can see why this intake was stopped before Lot 2."
          reason={unqualifiedReason}
          onReasonChange={setUnqualifiedReason}
          onApplyTemplate={(templateValue) => {
            setUnqualifiedReason((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
          }}
          onSubmit={() => {
            void handleUnqualify();
          }}
          disabled={saving || unqualifiedReason.trim().length === 0}
          textareaClassName={inputClassName}
          isSaving={saving}
        />

        <IntakeSnapshotSection
          sectionId="snapshot"
          className="scroll-mt-28"
          fields={intakeSnapshot.fields}
          cards={intakeSnapshot.cards}
          actions={<CompactIconActionButton label="Edit Intake" variant="small-secondary" icon="edit" onClick={() => onOpenManualIntake(record.id)} />}
        />

      </div>

    </WorkflowRecordPageLayout>
  );
}