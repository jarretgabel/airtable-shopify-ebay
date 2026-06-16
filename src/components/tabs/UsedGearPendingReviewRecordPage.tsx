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
import { DatePickerField } from '@/components/tabs/date-picker-field';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';
import { buildUsedGearIntakeSnapshot } from '@/components/tabs/usedGearIntakeSnapshot';
import {
  groupedIntakeNoticeActionClass,
  groupedIntakeNoticeSectionClass,
  successInlineBannerClass,
  tabFormControlBaseClass,
  tabFormControlClass,
  tabFormDateButtonClass,
  tabSectionPrimaryActionClass,
  tabSectionSurfaceClass,
  tabTemplatePillClass,
  warningInlineBannerClass,
} from '@/components/tabs/uiClasses';
import {
  acceptPendingReviewRecord,
  completeProcessingStage,
  hasUsedGearPendingReviewPricingPath,
  loadUsedGearOperationalRecordContext,
  markPendingReviewUnqualified,
  savePendingReviewRecordReview,
  type UsedGearOperationalRecordContext,
  type UsedGearPendingReviewAcceptedStatus,
} from '@/services/usedGearQueue';
import { getUsedGearRecordItemTitle } from '@/services/usedGearItemTitle';
import { resolveUsedGearOperationalPath } from '@/services/usedGearOperationalRouting';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';

interface UsedGearPendingReviewRecordPageProps {
  currentUserName: string;
  recordId: string;
  onOpenManualIntake: (recordId: string) => void;
}

type PendingReviewSectionKey = 'group' | 'lot-two' | 'trash' | 'snapshot';

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

function dateFieldValue(fields: Record<string, unknown>, fieldName: string): string {
  const value = stringFieldValue(fields, fieldName).trim();
  return value ? value.slice(0, 10) : '';
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
            className={tabTemplatePillClass}
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
  const currentPathname = location.pathname ?? `/parking-lot/${encodeURIComponent(recordId)}`;
  const [context, setContext] = useState<UsedGearOperationalRecordContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'save' | 'move' | 'trash' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [acceptStatus, setAcceptStatus] = useState<UsedGearPendingReviewAcceptedStatus | null>(null);
  const [qualificationNotes, setQualificationNotes] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [sku, setSku] = useState('');
  const [unqualifiedReason, setUnqualifiedReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRecord = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContext = await loadUsedGearOperationalRecordContext(recordId);
        if (!cancelled) {
          const nextPath = resolveUsedGearOperationalPath(nextContext.record.id, nextContext.record.fields);
          if (nextPath !== currentPathname) {
            navigate({ pathname: nextPath, search: location.search }, { replace: true });
            return;
          }

          setContext(nextContext);
          setQualificationNotes(stringFieldValue(nextContext.record.fields, 'Qualification Notes'));
          setArrivalDate(dateFieldValue(nextContext.record.fields, 'Arrival Date'));
          setSku(stringFieldValue(nextContext.record.fields, 'SKU'));
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
  }, [currentPathname, location.search, navigate, recordId]);

  const record = context?.record ?? null;
  const group = context?.group ?? null;
  const inputClassName = tabFormControlBaseClass;
  const dateButtonClassName = tabFormDateButtonClass;

  const hasPricingPath = useMemo(() => record ? hasUsedGearPendingReviewPricingPath(record.fields) : false, [record]);
  const groupNeedsPickupId = useMemo(
    () => Boolean(group && group.records.length > 1 && stringFieldValue(record?.fields ?? {}, 'Pick Up ID').trim().length === 0),
    [group, record],
  );
  const handoffFieldsReady = arrivalDate.trim().length > 0 && sku.trim().length > 0;
  const canMoveToTesting = hasPricingPath && !groupNeedsPickupId && handoffFieldsReady;
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
      ariaLabel="Parking Lot sections"
      items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionId as PendingReviewSectionKey}
      onSelect={(sectionKey) => scrollToSection(sectionKey)}
    />
  );

  const backToQueue = () => {
    navigate({ pathname: '/parking-lot', search: location.search, hash: '#used-gear-parking-lot' });
  };

  const handleSaveReview = async () => {
    if (!record) {
      return;
    }

    setSaving('save');
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedRecord = await savePendingReviewRecordReview(record.id, {
        qualificationNotes,
        arrivalDate,
        sku,
      });
      if (acceptStatus !== null) {
        await acceptPendingReviewRecord(record.id, currentUserName, {
          acceptedStatus: acceptStatus,
          qualificationNotes,
        });
        navigate({ pathname: '/parking-lot', search: location.search, hash: '#used-gear-parking-lot' });
        return;
      }
      setContext((current) => current ? { ...current, record: updatedRecord } : current);
      setQualificationNotes(stringFieldValue(updatedRecord.fields, 'Qualification Notes'));
      setArrivalDate(dateFieldValue(updatedRecord.fields, 'Arrival Date'));
      setSku(stringFieldValue(updatedRecord.fields, 'SKU'));
      setSuccessMessage('Saved pending-review fields.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the pending-review fields.');
    } finally {
      setSaving(null);
    }
  };

  const handleMoveToTesting = async () => {
    if (!record || !canMoveToTesting) {
      return;
    }

    setSaving('move');
    setError(null);
    setSuccessMessage(null);

    try {
      const savedRecord = await savePendingReviewRecordReview(record.id, {
        qualificationNotes,
        arrivalDate,
        sku,
      });
      setContext((current) => current ? { ...current, record: savedRecord } : current);
      await acceptPendingReviewRecord(record.id, currentUserName, {
        acceptedStatus: 'Accepted - Arrived, Awaiting SKU',
        qualificationNotes,
      });
      const updatedRecord = await completeProcessingStage(record.id, currentUserName);
      navigate(resolveUsedGearOperationalPath(updatedRecord.id, updatedRecord.fields));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to move this parking-lot row into testing.');
      setSaving(null);
    }
  };

  const handleUnqualify = async () => {
    if (!record) {
      return;
    }

    setSaving('trash');
    setError(null);
    setSuccessMessage(null);

    try {
      await markPendingReviewUnqualified(record.id, unqualifiedReason);
      navigate({ pathname: '/trash-review', search: location.search, hash: '#used-gear-trash' });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to move this parking-lot row into trash.');
      setSaving(null);
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading parking-lot review..." />;
  }

  if (!record) {
    return <ErrorSurface title="Unable to load parking-lot review" message={error ?? 'The selected Parking Lot record could not be loaded.'} />;
  }

  const intakeSnapshot = buildUsedGearIntakeSnapshot(record);

  return (
    <WorkflowRecordPageLayout
      eyebrow="Parking Lot"
      title={getUsedGearRecordItemTitle(record.fields, record.id)}
      belowHeader={sectionNav}
      actions={<BackToolbarButton label="Back to Parking Lot" onClick={backToQueue} />}
    >
      <div className="space-y-6">

        {error ? (
          <div className={warningInlineBannerClass}>
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className={successInlineBannerClass}>
            {successMessage}
          </div>
        ) : null}

        {group ? (
          <section id="group" className={groupedIntakeNoticeSectionClass}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <AppSectionTitle title="Grouped Intake" className="border-b-sky-300/25 pt-0" titleClassName="text-lg text-sky-50" />
                <p className="mt-3 max-w-2xl leading-6">
                  This row belongs to {group.label} with {group.records.length} intake rows. Use the group page when pricing, allocation, or routing should be managed together.
                </p>
              </div>
              <button
                type="button"
                className={groupedIntakeNoticeActionClass}
                onClick={() => navigate(`/parking-lot/group/${encodeURIComponent(group.id)}${location.search}`)}
              >
                Open Group Review
              </button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6">
          <section id="lot-two" className={`${tabSectionSurfaceClass} scroll-mt-28`}>
            <AppSectionTitle title="Review & Qualify" titleClassName="text-lg" className="pt-0" />
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Select a parking lot status to accept the item into the workflow, fill in arrival details to move directly to testing, or save your notes without committing.</p>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Parking Lot Status</span>
                <select
                  className={tabFormControlClass}
                  value={acceptStatus ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setAcceptStatus(value ? (value as UsedGearPendingReviewAcceptedStatus) : null);
                  }}
                >
                  <option value="">— No Status Change —</option>
                  <option value="Accepted - Awaiting Arrival">Accepted – Awaiting Arrival</option>
                  <option value="Accepted - Arrived, Awaiting SKU">Accepted – Arrived, Awaiting SKU</option>
                  <option value="Accepted - Arrived, Awaiting Missing Item">Accepted – Arrived, Awaiting Missing Item</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Qualification Notes</span>
                <textarea
                  className={inputClassName}
                  rows={5}
                  value={qualificationNotes}
                  onChange={(event) => setQualificationNotes(event.currentTarget.value)}
                  placeholder="Optional — notes about why this intake should stay in the sellable workflow"
                />
              </label>
              <NoteTemplateRow
                legend="Quick templates"
                templateGroup="qualification"
                onApplyTemplate={(templateValue) => {
                  setQualificationNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                }}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Arrival Date</span>
                  <DatePickerField
                    containerClassName="mt-2 flex gap-2"
                    inputClassName={`${inputClassName} flex-1`}
                    buttonClassName={dateButtonClassName}
                    value={arrivalDate}
                    pickerLabel="Arrival Date"
                    onValueChange={setArrivalDate}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SKU</span>
                  <input
                    type="text"
                    className={`${inputClassName} mt-2`}
                    value={sku}
                    onChange={(event) => setSku(event.currentTarget.value)}
                    placeholder="Required before this row can move to testing"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={tabSectionPrimaryActionClass}
                  onClick={() => {
                    void handleSaveReview();
                  }}
                  disabled={saving !== null}
                >
                  {saving === 'save' ? 'Saving...' : 'Save Review'}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void handleMoveToTesting();
                  }}
                  disabled={saving !== null || !canMoveToTesting}
                >
                  {saving === 'move' ? 'Moving...' : 'Move to Testing'}
                </button>
                {(!hasPricingPath || groupNeedsPickupId) ? (
                  <button
                    type="button"
                    className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20"
                    onClick={() => onOpenManualIntake(record.id)}
                  >
                    Edit Intake
                  </button>
                ) : null}
              </div>
              {!canMoveToTesting ? (
                <div className="flex flex-col gap-2">
                  {!hasPricingPath ? (
                    <p className="m-0 text-sm text-amber-300">Offer amount, paid amount, or confirmed grand total is required before this row can move to testing.</p>
                  ) : null}
                  {groupNeedsPickupId ? (
                    <p className="m-0 text-sm text-amber-300">This grouped intake still needs a Pick Up ID before it can move to testing.</p>
                  ) : null}
                  {!handoffFieldsReady && hasPricingPath && !groupNeedsPickupId ? (
                    <p className="m-0 text-sm text-amber-300">Arrival Date and SKU are required before this row can move to testing.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <UsedGearTrashRouteCard
          sectionId="trash"
          description="Capture the reason clearly so downstream review can see why this intake was stopped before accepted Parking Lot handling."
          reason={unqualifiedReason}
          onReasonChange={setUnqualifiedReason}
          onApplyTemplate={(templateValue) => {
            setUnqualifiedReason((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
          }}
          onSubmit={() => {
            void handleUnqualify();
          }}
          disabled={saving !== null || unqualifiedReason.trim().length === 0}
          textareaClassName={tabFormControlBaseClass}
          isSaving={saving === 'trash'}
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