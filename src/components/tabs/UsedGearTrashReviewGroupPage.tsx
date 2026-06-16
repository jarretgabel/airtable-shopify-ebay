import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { useConfirmationDialog } from '@/hooks/useConfirmationDialog';
import {
  dangerSectionActionClass,
  dangerSectionBodyClass,
  dangerSectionSurfaceClass,
  dangerSectionTitleClass,
  successInlineBannerClass,
  tabSectionPrimaryActionClass,
  tabSectionSurfaceClass,
  warningInlineBannerClass,
} from '@/components/tabs/uiClasses';
import {
  hasUsedGearPendingReviewPricingPath,
  loadTrashGroup,
  permanentlyDeleteTrashRecord,
  requalifyTrashRecord,
  restoreTrashRecord,
  type UsedGearPendingReviewAcceptedStatus,
  type UsedGearWorkflowGroup,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearTrashReviewGroupPageProps {
  currentUserName: string;
  groupId: string;
  onOpenManualIntake: (recordId: string) => void;
}

type TrashReviewGroupSectionKey = 'review' | 'restore' | 'requalify' | 'delete';

const REQUALIFY_ROUTE_OPTIONS: Array<{
  value: UsedGearPendingReviewAcceptedStatus;
  label: string;
}> = [
  { value: 'Accepted - Awaiting Arrival', label: 'Awaiting Arrival' },
  { value: 'Accepted - Arrived, Awaiting SKU', label: 'Arrived, Awaiting SKU' },
  { value: 'Accepted - Arrived, Awaiting Missing Item', label: 'Arrived, Awaiting Missing Item' },
];

function stringFieldValue(record: AirtableRecord, fieldName: string): string {
  const value = record.fields[fieldName];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function intakeTimestamp(record: AirtableRecord): number {
  const arrivalDate = stringFieldValue(record, 'Arrival Date');
  const parsedArrival = arrivalDate ? Date.parse(arrivalDate) : Number.NaN;
  if (Number.isFinite(parsedArrival)) {
    return parsedArrival;
  }

  const createdTime = Date.parse(record.createdTime);
  return Number.isFinite(createdTime) ? createdTime : Number.POSITIVE_INFINITY;
}

function sortGroupRecords(records: AirtableRecord[]): AirtableRecord[] {
  return [...records].sort((left, right) => {
    const timestampDelta = intakeTimestamp(left) - intakeTimestamp(right);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    const makeDelta = stringFieldValue(left, 'Make').localeCompare(stringFieldValue(right, 'Make'));
    if (makeDelta !== 0) {
      return makeDelta;
    }

    return stringFieldValue(left, 'Model').localeCompare(stringFieldValue(right, 'Model'));
  });
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

export function UsedGearTrashReviewGroupPage({
  currentUserName,
  groupId,
  onOpenManualIntake,
}: UsedGearTrashReviewGroupPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [group, setGroup] = useState<UsedGearWorkflowGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'restore' | 'requalify' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requalifyStatus, setRequalifyStatus] = useState<UsedGearPendingReviewAcceptedStatus>('Accepted - Awaiting Arrival');
  const [requalifyNotes, setRequalifyNotes] = useState('');
  const { requestConfirmation, confirmationModal } = useConfirmationDialog();

  useEffect(() => {
    let cancelled = false;

    const loadGroup = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextGroup = await loadTrashGroup(groupId);
        if (!cancelled) {
          const sortedRecords = sortGroupRecords(nextGroup.records);
          setGroup({ ...nextGroup, records: sortedRecords });
          setRequalifyNotes(stringFieldValue(sortedRecords[0] ?? nextGroup.records[0]!, 'Qualification Notes'));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected Trash Review group.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadGroup();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const records = useMemo(() => group?.records ?? [], [group]);
  const sectionItems = useMemo<Array<{ id: TrashReviewGroupSectionKey; key: TrashReviewGroupSectionKey; label: string }>>(() => [
    { id: 'review', key: 'review', label: 'Group Review' },
    { id: 'restore', key: 'restore', label: 'Restore' },
    { id: 'requalify', key: 'requalify', label: 'Re-qualify' },
    { id: 'delete', key: 'delete', label: 'Delete' },
  ], []);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, 'review');
  const sectionNav = (
    <MainPageSectionNav
      ariaLabel="Trash review group sections"
      items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionId as TrashReviewGroupSectionKey}
      onSelect={(sectionKey) => scrollToSection(sectionKey)}
    />
  );
  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
  const hasPricingCoverage = useMemo(() => records.every((record) => hasUsedGearPendingReviewPricingPath(record.fields)), [records]);

  const backToTrash = () => {
    navigate({ pathname: '/trash-review', search: location.search, hash: '#used-gear-trash' });
  };

  const handleRestoreGroup = async () => {
    if (records.length === 0) {
      return;
    }

    setSaving('restore');
    setError(null);
    setSuccessMessage(null);

    try {
      await Promise.all(records.map((record) => restoreTrashRecord(record.id)));
      navigate({ pathname: '/parking-lot', search: location.search, hash: '#used-gear-parking-lot' });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to restore this Trash Review group to Parking Lot.');
      setSaving(null);
    }
  };

  const handleRequalifyGroup = async () => {
    if (records.length === 0 || requalifyNotes.trim().length === 0 || !hasPricingCoverage) {
      return;
    }

    setSaving('requalify');
    setError(null);
    setSuccessMessage(null);

    try {
      await Promise.all(records.map((record) => requalifyTrashRecord(record.id, currentUserName, {
        acceptedStatus: requalifyStatus,
        qualificationNotes: requalifyNotes,
      })));
      navigate({ pathname: '/parking-lot', search: location.search, hash: '#used-gear-parking-lot' });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to re-qualify this Trash Review group into Parking Lot.');
      setSaving(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (records.length === 0) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Delete trash group?',
      message: 'This permanently removes every record in this grouped Trash Review set from the workflow.',
      confirmLabel: 'Delete Permanently',
      cancelLabel: 'Keep Records',
      tone: 'danger',
      bullets: [
        'This action cannot be undone from the app.',
        'All grouped rows in this Trash Review set will be removed together.',
      ],
    });

    if (!confirmed) {
      return;
    }

    setSaving('delete');
    setError(null);
    setSuccessMessage(null);

    try {
      await Promise.all(records.map((record) => permanentlyDeleteTrashRecord(record.id)));
      backToTrash();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to permanently delete this Trash Review group.');
      setSaving(null);
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading trash review group..." />;
  }

  if (!group) {
    return <ErrorSurface title="Unable to load trash review group" message={error ?? 'The selected Trash Review group could not be loaded.'} />;
  }

  return (
    <WorkflowRecordPageLayout
      eyebrow="Trash"
      title={`Trash ${group.label}`}
      belowHeader={sectionNav}
      actions={<BackToolbarButton label="Back to Trash" onClick={backToTrash} />}
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]">
          <section id="restore" className={`${tabSectionSurfaceClass} scroll-mt-28`}>
            <AppSectionTitle title="Restore To Parking Lot" titleClassName="text-lg" className="pt-0" />
            <button
              type="button"
              className={`mt-3 ${tabSectionPrimaryActionClass}`}
              onClick={() => {
                void handleRestoreGroup();
              }}
              disabled={saving !== null}
            >
              {saving === 'restore' ? 'Saving...' : 'Restore To Parking Lot'}
            </button>
          </section>

          <section id="requalify" className={`${tabSectionSurfaceClass} scroll-mt-28`}>
            <AppSectionTitle title="Re-qualify Into Parking Lot" titleClassName="text-lg" className="pt-0" />
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Parking Lot Status</span>
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
                  placeholder="Required before re-qualifying this grouped set into Parking Lot"
                />
              </label>
              <QualificationTemplateRow
                onApplyTemplate={(templateValue) => {
                  setRequalifyNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                }}
              />
              {!hasPricingCoverage ? (
                <p className="m-0 text-sm text-amber-200">Offer amount, paid amount, or confirmed grand total is still required before this grouped set can be re-qualified into Parking Lot.</p>
              ) : null}
              <button
                type="button"
                className={tabSectionPrimaryActionClass}
                onClick={() => {
                  void handleRequalifyGroup();
                }}
                disabled={saving !== null || requalifyNotes.trim().length === 0 || !hasPricingCoverage}
              >
                {saving === 'requalify' ? 'Saving...' : 'Re-qualify Into Parking Lot'}
              </button>
            </div>
          </section>
        </div>

        <section id="review" className="space-y-4 scroll-mt-28">
          <div className="grid gap-3 md:grid-cols-2">
            {records.map((record) => (
              <article key={record.id} className={`h-full ${tabSectionSurfaceClass}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="m-0 text-lg font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</p>
                    <div className="mt-3 border-t border-[var(--line)]/70 pt-3 text-sm text-[var(--muted)]">
                      <div>SKU: {displayInventoryValue(record.fields.SKU)}</div>
                      <div className="mt-1">Reason: {displayInventoryValue(record.fields['Unqualified Reason'])}</div>
                    </div>
                  </div>
                  <CompactIconActionButton label="Edit Intake" variant="compact-secondary" icon="edit" onClick={() => onOpenManualIntake(record.id)} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="delete" className={`${dangerSectionSurfaceClass} scroll-mt-28`}>
          <AppSectionTitle title="Delete From Workflow" titleClassName={dangerSectionTitleClass} className="pt-0" />
          <p className={`mt-2 ${dangerSectionBodyClass}`}>Permanently remove every row in this grouped Trash Review set when the batch should not return to workflow.</p>
          <button
            type="button"
            className={`mt-4 ${dangerSectionActionClass}`}
            onClick={() => {
              void handleDeleteGroup();
            }}
            disabled={saving !== null}
          >
            {saving === 'delete' ? 'Saving...' : 'Delete Group Permanently'}
          </button>
        </section>
        {confirmationModal}
      </div>
    </WorkflowRecordPageLayout>
  );
}