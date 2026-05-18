import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { smallPrimaryActionButtonClass } from '@/components/app/buttonStyles';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';
import { buildUsedGearIntakeSnapshot } from '@/components/tabs/usedGearIntakeSnapshot';
import { useConfirmationDialog } from '@/hooks/useConfirmationDialog';
import {
  hasUsedGearPendingReviewPricingPath,
  loadUsedGearOperationalRecordContext,
  permanentlyDeleteTrashRecord,
  requalifyTrashRecord,
  restoreTrashRecord,
  type UsedGearPendingReviewAcceptedStatus,
  type UsedGearOperationalRecordContext,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';

interface UsedGearTrashReviewRecordPageProps {
  currentUserName: string;
  recordId: string;
  onOpenManualIntake: (recordId: string) => void;
}

type TrashReviewSectionKey = 'group' | 'restore' | 'requalify' | 'snapshot' | 'delete';

const REQUALIFY_ROUTE_OPTIONS: Array<{
  value: UsedGearPendingReviewAcceptedStatus;
  label: string;
}> = [
  { value: 'Accepted - Awaiting Arrival', label: 'Awaiting Arrival' },
  { value: 'Accepted - Arrived, Awaiting SKU', label: 'Arrived, Awaiting SKU' },
  { value: 'Accepted - Arrived, Awaiting Missing Item', label: 'Arrived, Awaiting Missing Item' },
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

function QualificationTemplateRow({ onApplyTemplate }: { onApplyTemplate: (templateValue: string) => void }) {
  const templates = getUsedGearWorkflowNoteTemplates('qualification');

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="self-center text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100/70">Quick templates</span>
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className="rounded-full border border-emerald-200/20 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100 transition hover:border-emerald-200/50 hover:bg-white/10"
          onClick={() => onApplyTemplate(template.value)}
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}

export function UsedGearTrashReviewRecordPage({
  currentUserName,
  recordId,
  onOpenManualIntake,
}: UsedGearTrashReviewRecordPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState<UsedGearOperationalRecordContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requalifyStatus, setRequalifyStatus] = useState<UsedGearPendingReviewAcceptedStatus>('Accepted - Awaiting Arrival');
  const [requalifyNotes, setRequalifyNotes] = useState('');
  const { requestConfirmation, confirmationModal } = useConfirmationDialog();

  useEffect(() => {
    let cancelled = false;

    const loadRecord = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContext = await loadUsedGearOperationalRecordContext(recordId);
        if (!cancelled) {
          setContext(nextContext);
          setRequalifyStatus(
            nextContext.record.fields['Workflow Status'] === 'Accepted - Arrived, Awaiting SKU'
              || nextContext.record.fields['Workflow Status'] === 'Accepted - Arrived, Awaiting Missing Item'
              ? nextContext.record.fields['Workflow Status'] as UsedGearPendingReviewAcceptedStatus
              : 'Accepted - Awaiting Arrival',
          );
          setRequalifyNotes(stringFieldValue(nextContext.record.fields, 'Qualification Notes'));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected trash-review row.');
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
  const intakeSnapshot = useMemo(() => (record ? buildUsedGearIntakeSnapshot(record) : null), [record]);
  const sectionItems = useMemo<Array<{ id: TrashReviewSectionKey; key: TrashReviewSectionKey; label: string }>>(() => {
    const items: Array<{ id: TrashReviewSectionKey; key: TrashReviewSectionKey; label: string }> = [];
    if (group) {
      items.push({ id: 'group', key: 'group', label: 'Group' });
    }
    items.push({ id: 'restore', key: 'restore', label: 'Restore' });
    items.push({ id: 'requalify', key: 'requalify', label: 'Re-qualify' });
    if (intakeSnapshot) {
      items.push({ id: 'snapshot', key: 'snapshot', label: 'Snapshot' });
    }
    items.push({ id: 'delete', key: 'delete', label: 'Delete' });
    return items;
  }, [group, intakeSnapshot]);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, sectionItems[0]?.id ?? 'restore');
  const sectionNav = (
    <MainPageSectionNav
      ariaLabel="Trash review sections"
      items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionId as TrashReviewSectionKey}
      onSelect={(sectionKey) => scrollToSection(sectionKey)}
    />
  );

  const backToTrash = () => {
    navigate({ pathname: '/trash-review', search: location.search, hash: '#used-gear-trash' });
  };

  const handleRestore = async () => {
    if (!record) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await restoreTrashRecord(record.id);
      navigate({ pathname: '/parking-lot-1', search: location.search, hash: '#used-gear-pending-review' });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to restore this trash row to Parking Lot 1.');
      setSaving(false);
    }
  };

  const handleRequalify = async () => {
    if (!record) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await requalifyTrashRecord(record.id, currentUserName, {
        acceptedStatus: requalifyStatus,
        qualificationNotes: requalifyNotes,
      });
      navigate({ pathname: '/parking-lot-2', search: location.search });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to re-qualify this trash row into Lot 2.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!record) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Delete trash record?',
      message: 'This permanently removes the record from the workflow and it will not return to Trash Review, Parking Lot 1, or Parking Lot 2.',
      confirmLabel: 'Delete Permanently',
      cancelLabel: 'Keep Record',
      tone: 'danger',
      bullets: [
        'This action cannot be undone from the app.',
        'Any current workflow routing for this row will be removed.',
      ],
    });

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await permanentlyDeleteTrashRecord(record.id);
      backToTrash();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to permanently delete this trash row.');
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading trash review..." />;
  }

  if (!record) {
    return <ErrorSurface title="Unable to load trash review" message={error ?? 'The selected Trash Review record could not be loaded.'} />;
  }

  return (
    <WorkflowRecordPageLayout
      eyebrow="Trash Review"
      title={displayInventoryValue(record.fields.SKU)}
      belowHeader={sectionNav}
      actions={<BackToolbarButton label="Back to Trash Review" onClick={backToTrash} />}
    >
      <div className="space-y-6">

        {error ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        ) : null}

        {group ? (
          <section id="group" className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-5 py-4 text-sm text-[var(--muted)] scroll-mt-28">
            <AppSectionTitle title="Related Intake Group" titleClassName="text-lg" className="pt-0" />
            <p className="mt-2 mb-0">This trash row is grouped under {group.label} with {group.records.length} related intake rows.</p>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]">
          <section id="restore" className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 scroll-mt-28">
            <AppSectionTitle title="Restore To Parking Lot 1" titleClassName="text-lg" className="pt-0" />
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use restore when the row was trashed in error and should return to the standard Parking Lot 1 review queue.</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleRestore();
              }}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Restore To Lot 1'}
            </button>
          </section>

          <section id="requalify" className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 scroll-mt-28">
            <AppSectionTitle title="Re-qualify Into Lot 2" titleClassName="text-lg" className="pt-0" />
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use this when the item should return to the active sellable workflow and continue from the correct Lot 2 stage.</p>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Lot 2 Route</span>
                <select
                  className={inputClassName}
                  value={requalifyStatus}
                  onChange={(event) => setRequalifyStatus(event.currentTarget.value as UsedGearPendingReviewAcceptedStatus)}
                >
                  {REQUALIFY_ROUTE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Qualification Notes</span>
                <textarea
                  className={inputClassName}
                  rows={5}
                  value={requalifyNotes}
                  onChange={(event) => setRequalifyNotes(event.currentTarget.value)}
                  placeholder="Required before re-qualifying this item into Lot 2"
                />
              </label>
              <QualificationTemplateRow
                onApplyTemplate={(templateValue) => {
                  setRequalifyNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                }}
              />
              {!hasPricingPath ? (
                <p className="m-0 text-sm text-amber-200">Offer amount, paid amount, or confirmed grand total is still required before this row can be re-qualified into Lot 2.</p>
              ) : null}
              <button
                type="button"
                className={smallPrimaryActionButtonClass}
                onClick={() => {
                  void handleRequalify();
                }}
                disabled={saving || requalifyNotes.trim().length === 0 || !hasPricingPath}
              >
                {saving ? 'Saving...' : 'Re-qualify Into Lot 2'}
              </button>
            </div>
          </section>
        </div>

        {intakeSnapshot ? (
          <IntakeSnapshotSection
            sectionId="snapshot"
            className="scroll-mt-28"
            fields={intakeSnapshot.fields}
            cards={intakeSnapshot.cards}
            actions={<CompactIconActionButton label="Edit Intake" variant="small-secondary" icon="edit" onClick={() => onOpenManualIntake(record.id)} />}
          />
        ) : null}

        <section id="delete" className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-5 scroll-mt-28">
          <AppSectionTitle title="Delete From Workflow" titleClassName="text-lg text-white" className="border-b-rose-300/20 pt-0" />
          <p className="mt-2 text-sm leading-6 text-rose-100/80">Delete only when the row should leave the workflow entirely and should not return to Parking Lot 1 or Lot 2.</p>
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-rose-300/35 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-50 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void handleDelete();
            }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Delete Permanently'}
          </button>
        </section>
        {confirmationModal}

      </div>
    </WorkflowRecordPageLayout>
  );
}